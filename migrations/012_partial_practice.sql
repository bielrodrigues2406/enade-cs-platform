-- Treino parcial (SIM-P1 / ADR-007). Identidade e conteúdo editorial existentes
-- são reutilizados; cada tentativa fixa versões e alternativas por identidade.
CREATE TABLE practice_attempt (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES study_identity(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  size integer NOT NULL CHECK (size IN (10,20,30)),
  area text CHECK (area IN (
    'Formação Geral','Algoritmos','Programação','Teoria da computação','Compiladores',
    'Matemática','Arquitetura de computadores','Sistemas operacionais','Redes',
    'Sistemas distribuídos','Banco de dados','Engenharia de software',
    'Interação humano-computador','Inteligência artificial','Computação gráfica',
    'Segurança','Sistemas de informação','Sociedade e ética'
  )),
  state text NOT NULL DEFAULT 'IN_PROGRESS' CHECK (state IN ('IN_PROGRESS','COMPLETED')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  summary jsonb,
  UNIQUE(owner_id,request_id),
  CHECK (
    (state='IN_PROGRESS' AND finished_at IS NULL AND summary IS NULL)
    OR (state='COMPLETED' AND finished_at IS NOT NULL AND summary IS NOT NULL AND jsonb_typeof(summary)='object')
  )
);
CREATE UNIQUE INDEX practice_attempt_one_active ON practice_attempt(owner_id)
  WHERE state='IN_PROGRESS';
CREATE INDEX practice_attempt_recent ON practice_attempt(owner_id,finished_at DESC,id DESC)
  WHERE state='COMPLETED';

CREATE TABLE practice_item (
  attempt_id uuid NOT NULL REFERENCES practice_attempt(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 30),
  question_id text NOT NULL,
  version_id text NOT NULL,
  option_id text,
  marked boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 1000000),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(attempt_id,position),
  UNIQUE(attempt_id,question_id),
  FOREIGN KEY(question_id,version_id) REFERENCES question_version(question_id,id),
  FOREIGN KEY(version_id,option_id) REFERENCES question_option(question_id,id)
);
CREATE INDEX practice_item_version ON practice_item(version_id);

CREATE FUNCTION protect_practice_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt practice_attempt;
BEGIN
  SELECT * INTO attempt FROM practice_attempt
    WHERE id=CASE WHEN TG_OP='INSERT' THEN NEW.attempt_id ELSE OLD.attempt_id END FOR UPDATE;
  IF NOT FOUND AND TG_OP='DELETE' THEN RETURN OLD; END IF;
  -- Só a remoção administrativa da tentativa/proprietário pode retirar itens.
  IF TG_OP='DELETE' OR attempt.state IS DISTINCT FROM 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'Practice items are fixed and completed answers are immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.position>attempt.size OR NEW.option_id IS NOT NULL OR NEW.marked OR NEW.revision<>0
      OR NOT EXISTS(SELECT 1 FROM question_version WHERE id=NEW.version_id AND editorial_status='PUBLISHED') THEN
      RAISE EXCEPTION 'Invalid initial practice item' USING ERRCODE='23514';
    END IF;
  ELSE
    IF (NEW.attempt_id,NEW.position,NEW.question_id,NEW.version_id)
      IS DISTINCT FROM (OLD.attempt_id,OLD.position,OLD.question_id,OLD.version_id)
      OR NEW.revision<>OLD.revision+1 THEN
      RAISE EXCEPTION 'Practice identity and revisions are fixed' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER practice_item_guard BEFORE INSERT OR UPDATE OR DELETE ON practice_item
  FOR EACH ROW EXECUTE FUNCTION protect_practice_item();

CREATE FUNCTION protect_practice_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state='COMPLETED'
    OR (NEW.id,NEW.owner_id,NEW.request_id,NEW.size,NEW.area,NEW.created_at)
      IS DISTINCT FROM (OLD.id,OLD.owner_id,OLD.request_id,OLD.size,OLD.area,OLD.created_at) THEN
    RAISE EXCEPTION 'Practice configuration and completed results are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.state='COMPLETED' AND (
    (SELECT count(*) FROM practice_item WHERE attempt_id=NEW.id)<>NEW.size
    OR (NEW.summary->>'total')::integer IS DISTINCT FROM NEW.size
  ) THEN
    RAISE EXCEPTION 'Practice result does not match its items' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER practice_attempt_guard BEFORE UPDATE ON practice_attempt
  FOR EACH ROW EXECUTE FUNCTION protect_practice_attempt();

-- Uma tentativa não pode ser confirmada incompleta: o start insere todos os
-- itens na mesma transação. Posições únicas em 1..size também impedem lacunas.
CREATE FUNCTION validate_practice_size() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected integer;
BEGIN
  SELECT size INTO expected FROM practice_attempt WHERE id=NEW.id;
  IF FOUND AND (SELECT count(*) FROM practice_item WHERE attempt_id=NEW.id)<>expected THEN
    RAISE EXCEPTION 'Practice needs its exact number of distinct items' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER practice_attempt_exact_size AFTER INSERT ON practice_attempt
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_practice_size();
