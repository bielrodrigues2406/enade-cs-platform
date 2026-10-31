-- Discursivas (DISC-1, ADR-013). Ficam fora do modelo das objetivas, que exige
-- alternativas e gabarito: a discursiva tem o recorte do enunciado, o recorte
-- do padrão de resposta publicado pelo Inep e os itens de avaliação com valor.
-- Entram pelo importador, conferidas por um administrador (revisão IMPORT).

-- Importação: PDF do padrão de resposta (opcional no lote) e, por discursiva,
-- as caixas no padrão e os itens de avaliação.
ALTER TABLE exam_import
  ADD COLUMN standard_url text CHECK (standard_url IS NULL OR
    standard_url ~ '^https://(download\.inep\.gov\.br/|www\.gov\.br/inep/).+\.pdf$'),
  ADD COLUMN standard_sha256 text CHECK (standard_sha256 IS NULL OR standard_sha256 ~ '^[a-f0-9]{64}$'),
  ADD COLUMN standard_page_sizes jsonb,
  ADD CONSTRAINT exam_import_standard_pair CHECK ((standard_url IS NULL) = (standard_sha256 IS NULL));

-- Item de avaliação: {"label": "a" | null, "points": 0.5–10}.
CREATE FUNCTION valid_criteria(criteria jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(criteria) = 'array' AND jsonb_array_length(criteria) BETWEEN 1 AND 6
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(criteria) c
      WHERE jsonb_typeof(c->'points') <> 'number' OR (c->>'points')::numeric NOT BETWEEN 0.5 AND 10
        OR NOT (c->'label' = 'null'::jsonb OR (c->>'label') ~ '^[a-f]$'))
$$;

ALTER TABLE exam_import_item
  ADD COLUMN standard_boxes jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN criteria jsonb NOT NULL DEFAULT '[]';
ALTER TABLE exam_import_item DROP CONSTRAINT exam_import_item_check;
ALTER TABLE exam_import_item ADD CONSTRAINT exam_import_item_confirmable CHECK (
  status <> 'CONFIRMED' OR (
    area IS NOT NULL AND jsonb_array_length(boxes) > 0 AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL
    AND (
      (kind = 'OBJECTIVE' AND answer IN ('A', 'B', 'C', 'D', 'E'))
      OR (kind = 'DISCURSIVE' AND answer IS NULL AND jsonb_array_length(standard_boxes) > 0 AND valid_criteria(criteria))
    )
  )
);

CREATE TABLE discursive_question (
  id text PRIMARY KEY CHECK (id ~ '^discursive-[a-f0-9]{12}-[qd][0-9]{1,3}$'),
  exam_source_id uuid NOT NULL REFERENCES source_document(id),
  standard_source_id uuid NOT NULL REFERENCES source_document(id),
  year integer NOT NULL CHECK (year BETWEEN 2004 AND 2100),
  modality text NOT NULL CHECK (modality IN ('BACHARELADO', 'LICENCIATURA', 'CST', 'COMUM')),
  number integer NOT NULL CHECK (number BETWEEN 1 AND 1000),
  area text NOT NULL,
  subject text CHECK (subject IS NULL OR char_length(btrim(subject)) BETWEEN 1 AND 80),
  criteria jsonb NOT NULL CHECK (valid_criteria(criteria)),
  reviewed_by uuid NOT NULL REFERENCES account(identity_id),
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_source_id, number)
);

-- PROMPT: enunciado na prova; STANDARD: padrão de resposta.
CREATE TABLE discursive_image (
  question_id text NOT NULL REFERENCES discursive_question(id) ON DELETE CASCADE,
  part text NOT NULL CHECK (part IN ('PROMPT', 'STANDARD')),
  position integer NOT NULL CHECK (position BETWEEN 1 AND 20),
  asset_sha256 text NOT NULL REFERENCES question_asset(sha256),
  source_page integer NOT NULL CHECK (source_page > 0),
  box numeric(8, 2)[] NOT NULL CHECK (
    cardinality(box) = 4 AND box[1] >= 0 AND box[2] >= 0 AND box[3] > box[1] AND box[4] > box[2]
  ),
  dpi integer NOT NULL CHECK (dpi BETWEEN 72 AND 600),
  PRIMARY KEY (question_id, part, position)
);
CREATE INDEX discursive_image_asset_idx ON discursive_image(asset_sha256);

-- Resposta do aluno: rascunho salvo, depois enviada (o texto não muda mais) e
-- autoavaliada item a item. A autoavaliação não é nota oficial.
CREATE TABLE discursive_response (
  owner_id uuid NOT NULL REFERENCES study_identity(id) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES discursive_question(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) <= 6000),
  revision integer NOT NULL CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  submitted_at timestamptz,
  -- {"levels": [0|1|2 por item], "score": 0–10}
  assessment jsonb,
  PRIMARY KEY (owner_id, question_id),
  CHECK (submitted_at IS NOT NULL OR assessment IS NULL),
  CHECK (submitted_at IS NULL OR char_length(btrim(body)) > 0)
);

CREATE FUNCTION protect_submitted_response() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.submitted_at IS NOT NULL AND (NEW.body IS DISTINCT FROM OLD.body
    OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at) THEN
    RAISE EXCEPTION 'Submitted discursive answers are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER discursive_response_submitted BEFORE UPDATE ON discursive_response
  FOR EACH ROW EXECUTE FUNCTION protect_submitted_response();
