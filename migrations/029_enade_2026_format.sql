-- SIM26-1: montagem autoral com itens históricos. A edição oficial de 2026
-- não é uma fonte importada. Cada tentativa fixa 45 objetivas e uma discursiva.
ALTER TABLE practice_attempt DROP CONSTRAINT practice_attempt_kind_check;
ALTER TABLE practice_attempt ADD CONSTRAINT practice_attempt_kind_check
  CHECK (kind IN ('PARTIAL','EDITION','FORMAT'));
ALTER TABLE practice_attempt ADD COLUMN format_year integer;
ALTER TABLE practice_attempt DROP CONSTRAINT practice_attempt_kind_shape;
ALTER TABLE practice_attempt ADD CONSTRAINT practice_attempt_kind_shape CHECK (
  (kind='PARTIAL' AND size BETWEEN 1 AND 30 AND exam_source_id IS NULL AND format_year IS NULL)
  OR (kind='EDITION' AND size BETWEEN 1 AND 60 AND area IS NULL AND exam_source_id IS NOT NULL
      AND deadline_at IS NOT NULL AND format_year IS NULL)
  OR (kind='FORMAT' AND size=45 AND area IS NULL AND exam_source_id IS NULL AND format_year IS NOT NULL AND format_year=2026
      AND deadline_at IS NOT NULL)
);

CREATE TABLE practice_discursive (
  attempt_id uuid PRIMARY KEY REFERENCES practice_attempt(id) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES discursive_question(id),
  -- Projeção tipada em practice-discursive.ts: título, fontes, critérios e crédito.
  -- A cópia impede que uma edição posterior altere a prova já iniciada.
  content jsonb NOT NULL CHECK (jsonb_typeof(content)='object'
    AND content ? 'criteria' AND valid_criteria(content->'criteria')),
  body text NOT NULL DEFAULT '' CHECK (char_length(body)<=6000),
  revision integer NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 1000000),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  assessment jsonb CHECK (assessment IS NULL OR (jsonb_typeof(assessment)='object'
    AND jsonb_typeof(assessment->'levels')='array' AND (assessment->>'score')::numeric BETWEEN 0 AND 10))
);
CREATE TABLE practice_discursive_image (
  attempt_id uuid NOT NULL REFERENCES practice_discursive(attempt_id) ON DELETE CASCADE,
  part text NOT NULL CHECK (part IN ('PROMPT','STANDARD')),
  position integer NOT NULL CHECK (position BETWEEN 1 AND 20),
  asset_sha256 text NOT NULL REFERENCES question_asset(sha256),
  source_page integer NOT NULL CHECK (source_page>0),
  box numeric(8,2)[] NOT NULL CHECK (cardinality(box)=4 AND box[1]>=0 AND box[2]>=0 AND box[3]>box[1] AND box[4]>box[2]),
  dpi integer NOT NULL CHECK (dpi BETWEEN 72 AND 600),
  PRIMARY KEY(attempt_id,part,position)
);

CREATE FUNCTION protect_format_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.format_year IS DISTINCT FROM OLD.format_year THEN
    RAISE EXCEPTION 'Practice format is fixed' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER practice_format_fixed BEFORE UPDATE ON practice_attempt
  FOR EACH ROW EXECUTE FUNCTION protect_format_configuration();

CREATE FUNCTION protect_practice_discursive() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt practice_attempt;
BEGIN
  SELECT * INTO attempt FROM practice_attempt
    WHERE id=CASE WHEN TG_OP='INSERT' THEN NEW.attempt_id ELSE OLD.attempt_id END FOR UPDATE;
  IF NOT FOUND AND TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_OP='DELETE' OR attempt.kind IS DISTINCT FROM 'FORMAT' THEN
    RAISE EXCEPTION 'Practice discursive is fixed' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    IF attempt.state<>'IN_PROGRESS' OR NEW.body<>'' OR NEW.revision<>0 OR NEW.assessment IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid initial practice discursive' USING ERRCODE='23514';
    END IF;
  ELSE
    IF (NEW.attempt_id,NEW.question_id,NEW.content) IS DISTINCT FROM (OLD.attempt_id,OLD.question_id,OLD.content)
      OR (attempt.state='IN_PROGRESS' AND (NEW.revision<>OLD.revision+1 OR NEW.assessment IS NOT NULL))
      OR (attempt.state='COMPLETED' AND (NEW.body,NEW.revision) IS DISTINCT FROM (OLD.body,OLD.revision)) THEN
      RAISE EXCEPTION 'Practice discursive identity and completed answer are immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER practice_discursive_guard BEFORE INSERT OR UPDATE OR DELETE ON practice_discursive
  FOR EACH ROW EXECUTE FUNCTION protect_practice_discursive();

CREATE FUNCTION protect_practice_discursive_image() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM practice_discursive WHERE attempt_id=OLD.attempt_id) THEN RETURN OLD; END IF;
  IF TG_OP<>'INSERT' OR NOT EXISTS(
    SELECT 1 FROM practice_discursive p JOIN practice_attempt a ON a.id=p.attempt_id
      JOIN discursive_image i ON i.question_id=p.question_id
    WHERE p.attempt_id=NEW.attempt_id AND a.state='IN_PROGRESS' AND i.part=NEW.part AND i.position=NEW.position
      AND (i.asset_sha256,i.source_page,i.box,i.dpi)=(NEW.asset_sha256,NEW.source_page,NEW.box,NEW.dpi)
  ) THEN
    RAISE EXCEPTION 'Practice discursive images are fixed' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER practice_discursive_image_guard BEFORE INSERT OR UPDATE OR DELETE ON practice_discursive_image
  FOR EACH ROW EXECUTE FUNCTION protect_practice_discursive_image();

CREATE FUNCTION validate_format_selection() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt practice_attempt;
BEGIN
  SELECT * INTO attempt FROM practice_attempt WHERE id=NEW.id;
  IF NOT FOUND OR attempt.kind<>'FORMAT' THEN RETURN NULL; END IF;
  IF attempt.deadline_at IS DISTINCT FROM attempt.created_at + interval '4 hours'
    OR (SELECT count(*) FROM practice_item i JOIN question_version q ON q.id=i.version_id
      JOIN source_document s ON s.id=q.exam_source_id
      WHERE i.attempt_id=attempt.id AND q.origin='OFFICIAL' AND NOT q.demonstration
        AND q.reviewed_at IS NOT NULL AND s.status='VERIFIED' AND s.year<2026
        AND s.modality IN ('BACHARELADO','COMUM') AND s.area IN ('Computação','Ciência da Computação')
        AND (SELECT count(*) FROM question_option o WHERE o.question_id=q.id)=5)<>45
    OR (SELECT count(*) FROM practice_item i JOIN question_version q ON q.id=i.version_id
        WHERE i.attempt_id=attempt.id AND q.topic='Formação Geral')<>15
    OR (SELECT count(*) FROM practice_discursive WHERE attempt_id=attempt.id)<>1
    OR NOT EXISTS(SELECT 1 FROM practice_discursive p JOIN discursive_question q ON q.id=p.question_id
      JOIN source_document e ON e.id=q.exam_source_id JOIN source_document s ON s.id=q.standard_source_id
      WHERE p.attempt_id=attempt.id AND q.area<>'Formação Geral' AND q.year<2026
        AND q.modality IN ('BACHARELADO','COMUM') AND e.status='VERIFIED' AND s.status='VERIFIED'
        AND e.year=q.year AND s.year=q.year AND e.modality=q.modality AND s.modality=q.modality
        AND e.area IN ('Computação','Ciência da Computação'))
    OR NOT EXISTS(SELECT 1 FROM practice_discursive_image WHERE attempt_id=attempt.id AND part='PROMPT')
    OR NOT EXISTS(SELECT 1 FROM practice_discursive_image WHERE attempt_id=attempt.id AND part='STANDARD') THEN
    RAISE EXCEPTION 'Format needs 15 general, 30 specific and one reviewed discursive' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER practice_format_exact_selection AFTER INSERT ON practice_attempt
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_format_selection();
