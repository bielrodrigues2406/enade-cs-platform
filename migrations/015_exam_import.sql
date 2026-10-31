-- Importação de provas futuras pela interface (IMP-1). O administrador envia a
-- prova e o gabarito, o processo de extração propõe as caixas de cada questão,
-- a pessoa confere e ajusta na tela, e só o confirmado vira questão publicada.
-- Diferente do caminho ASSISTED (agentes), aqui quem confere é uma conta com
-- papel de administrador: a revisão IMPORT registra essa conta.

CREATE TABLE exam_import (
  id uuid PRIMARY KEY,
  year integer NOT NULL CHECK (year BETWEEN 2004 AND 2100),
  modality text NOT NULL CHECK (modality IN ('BACHARELADO', 'LICENCIATURA', 'CST', 'COMUM')),
  exam_url text NOT NULL CHECK (exam_url ~ '^https://(download\.inep\.gov\.br/|www\.gov\.br/inep/).+\.pdf$'),
  key_url text NOT NULL CHECK (key_url ~ '^https://(download\.inep\.gov\.br/|www\.gov\.br/inep/).+\.pdf$'),
  exam_sha256 text NOT NULL CHECK (exam_sha256 ~ '^[a-f0-9]{64}$'),
  key_sha256 text NOT NULL CHECK (key_sha256 ~ '^[a-f0-9]{64}$' AND key_sha256 <> exam_sha256),
  page_count integer CHECK (page_count BETWEEN 1 AND 1000),
  page_sizes jsonb, -- [{width,height}] em pontos do PDF, por página
  state text NOT NULL DEFAULT 'PROCESSING'
    CHECK (state IN ('PROCESSING', 'READY', 'FAILED', 'PUBLISHED')),
  failure text CHECK (failure IS NULL OR char_length(failure) <= 500),
  created_by uuid NOT NULL REFERENCES account(identity_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE exam_import_item (
  import_id uuid NOT NULL REFERENCES exam_import(id) ON DELETE CASCADE,
  question_key text NOT NULL CHECK (question_key ~ '^[QD][0-9]{1,3}$'),
  number integer NOT NULL CHECK (number BETWEEN 1 AND 1000),
  kind text NOT NULL CHECK (kind IN ('OBJECTIVE', 'DISCURSIVE')),
  answer text CHECK (answer IS NULL OR answer IN ('A', 'B', 'C', 'D', 'E', 'ANULADA')),
  -- Caixas em pontos do PDF, origem no canto superior esquerdo, em ordem de leitura.
  boxes jsonb NOT NULL DEFAULT '[]',
  prompt text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'EXCLUDED')),
  area text,
  subject text CHECK (subject IS NULL OR char_length(btrim(subject)) BETWEEN 1 AND 80),
  warnings text[] NOT NULL DEFAULT '{}',
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  confirmed_by uuid REFERENCES account(identity_id),
  confirmed_at timestamptz,
  PRIMARY KEY (import_id, question_key),
  CHECK (status <> 'CONFIRMED' OR (kind = 'OBJECTIVE' AND answer IN ('A', 'B', 'C', 'D', 'E')
    AND area IS NOT NULL AND jsonb_array_length(boxes) > 0 AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
);

-- Fontes e versões publicadas por importação conferida por um administrador.
ALTER TABLE source_document DROP CONSTRAINT source_document_verification_origin_check;
ALTER TABLE source_document ADD CONSTRAINT source_document_verification_origin_check
  CHECK (verification_origin IN ('HUMAN', 'ASSISTED', 'IMPORT'));
ALTER TABLE source_document DROP CONSTRAINT source_document_verified_review;
ALTER TABLE source_document ADD CONSTRAINT source_document_verified_review CHECK (
  status <> 'VERIFIED' OR (
    reviewed_at IS NOT NULL AND (kind <> 'ANSWER_KEY' OR is_final) AND (
      (verification_origin = 'HUMAN' AND assisted_verifier IS NULL
        AND reviewed_by IS NOT NULL AND reviewed_by IS DISTINCT FROM imported_by
        AND reviewed_by IS DISTINCT FROM last_editor_id)
      OR (verification_origin = 'ASSISTED' AND assisted_verifier IS NOT NULL AND reviewed_by IS NULL)
      OR (verification_origin = 'IMPORT' AND assisted_verifier IS NULL AND reviewed_by IS NOT NULL)
    )
  )
);

ALTER TABLE question_version DROP CONSTRAINT question_version_review_origin_check;
ALTER TABLE question_version ADD CONSTRAINT question_version_review_origin_check
  CHECK (review_origin IN ('HUMAN', 'ASSISTED', 'IMPORT'));
ALTER TABLE question_version DROP CONSTRAINT question_version_independent_review;
ALTER TABLE question_version ADD CONSTRAINT question_version_independent_review CHECK (
  editorial_status <> 'PUBLISHED' OR demonstration OR (
    review_origin = 'HUMAN' AND assisted_extractor IS NULL AND assisted_reviewer IS NULL
    AND created_by IS NOT NULL AND last_editor_id IS NOT NULL AND reviewed_by IS NOT NULL
    AND reviewed_by <> created_by AND reviewed_by <> last_editor_id AND reviewed_at IS NOT NULL
  ) OR (
    review_origin = 'ASSISTED' AND origin = 'OFFICIAL'
    AND assisted_extractor IS NOT NULL AND assisted_reviewer IS NOT NULL
    AND assisted_extractor <> assisted_reviewer
    AND reviewed_by IS NULL AND reviewed_at IS NOT NULL
  ) OR (
    review_origin = 'IMPORT' AND origin = 'OFFICIAL'
    AND assisted_extractor IS NULL AND assisted_reviewer IS NULL
    AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
  )
);
