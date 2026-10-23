CREATE TABLE source_document (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  official_url text NOT NULL CHECK (official_url ~ '^https://(download\.inep\.gov\.br/enade/|www\.gov\.br/inep/).+\.pdf$'),
  kind text NOT NULL CHECK (kind IN ('EXAM','ANSWER_KEY','RESPONSE_STANDARD')),
  year integer NOT NULL CHECK (year BETWEEN 2004 AND 2100),
  area text NOT NULL CHECK (char_length(area) BETWEEN 1 AND 120),
  modality text NOT NULL CHECK (modality IN ('BACHARELADO','LICENCIATURA','CST')),
  sha256 text NOT NULL UNIQUE CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 5 AND 10485760),
  page_count integer NOT NULL CHECK (page_count BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'IMPORTED' CHECK (status IN ('IMPORTED','VERIFIED','REJECTED')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  imported_by uuid REFERENCES account(identity_id),
  last_editor_id uuid REFERENCES account(identity_id),
  reviewed_by uuid REFERENCES account(identity_id),
  reviewed_at timestamptz,
  note text,
  is_final boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'VERIFIED' OR (
    reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
    AND reviewed_by IS DISTINCT FROM imported_by
    AND reviewed_by IS DISTINCT FROM last_editor_id
    AND (kind <> 'ANSWER_KEY' OR is_final)
  ))
);
CREATE TABLE source_event (
  id bigserial PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES source_document(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES account(identity_id),
  event_type text NOT NULL CHECK (event_type IN ('IMPORTED','EDITED','VERIFIED','REJECTED')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION protect_source_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='VERIFIED' OR NEW.id<>OLD.id OR NEW.sha256<>OLD.sha256
    OR NEW.official_url<>OLD.official_url OR NEW.byte_size<>OLD.byte_size
    OR NEW.page_count<>OLD.page_count OR NEW.imported_by IS DISTINCT FROM OLD.imported_by THEN
    RAISE EXCEPTION 'Source artifacts and verified metadata are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER source_document_immutable BEFORE UPDATE ON source_document
  FOR EACH ROW EXECUTE FUNCTION protect_source_document();

ALTER TABLE editorial_question ADD COLUMN official_exam_id uuid REFERENCES source_document(id),
  ADD COLUMN official_question_number integer CHECK (official_question_number BETWEEN 1 AND 1000),
  ADD CONSTRAINT official_question_identity UNIQUE(official_exam_id,official_question_number),
  ADD CONSTRAINT official_question_origin CHECK (
    (origin='OFFICIAL' AND official_exam_id IS NOT NULL AND official_question_number IS NOT NULL)
    OR (origin<>'OFFICIAL' AND official_exam_id IS NULL AND official_question_number IS NULL)
  );
ALTER TABLE question_version
  ADD COLUMN exam_source_id uuid REFERENCES source_document(id),
  ADD COLUMN key_source_id uuid REFERENCES source_document(id),
  ADD COLUMN source_page integer,
  ADD COLUMN source_question_number integer,
  ADD COLUMN key_page integer,
  ADD COLUMN explanation_credit text;
ALTER TABLE question_version DROP CONSTRAINT question_version_check;
CREATE FUNCTION validate_official_provenance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE exam source_document%ROWTYPE; answer_key source_document%ROWTYPE; parent editorial_question%ROWTYPE;
BEGIN
  IF NEW.origin <> 'OFFICIAL' THEN
    IF NEW.exam_source_id IS NOT NULL OR NEW.key_source_id IS NOT NULL OR NEW.source_page IS NOT NULL
      OR NEW.source_question_number IS NOT NULL OR NEW.key_page IS NOT NULL THEN
      RAISE EXCEPTION 'Only official versions have official provenance' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO exam FROM source_document WHERE id=NEW.exam_source_id;
  SELECT * INTO answer_key FROM source_document WHERE id=NEW.key_source_id;
  SELECT * INTO parent FROM editorial_question WHERE id=NEW.question_id;
  IF exam.id IS NULL OR answer_key.id IS NULL OR exam.kind<>'EXAM' OR answer_key.kind<>'ANSWER_KEY'
    OR exam.status<>'VERIFIED' OR answer_key.status<>'VERIFIED' OR NOT answer_key.is_final
    OR exam.year<>answer_key.year OR exam.area<>answer_key.area OR exam.modality<>answer_key.modality
    OR NEW.source_page IS NULL OR NEW.source_page NOT BETWEEN 1 AND exam.page_count
    OR NEW.key_page IS NULL OR NEW.key_page NOT BETWEEN 1 AND answer_key.page_count
    OR NEW.source_question_number IS NULL OR NEW.source_question_number NOT BETWEEN 1 AND 1000
    OR NEW.exam_source_id IS DISTINCT FROM parent.official_exam_id
    OR NEW.source_question_number IS DISTINCT FROM parent.official_question_number
    OR NEW.author_credit<>'Inep' OR COALESCE(length(btrim(NEW.explanation_credit)),0) NOT BETWEEN 1 AND 160
    OR NEW.demonstration THEN
    RAISE EXCEPTION 'Official versions require matching verified source documents and attribution' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER question_version_official_provenance BEFORE INSERT OR UPDATE ON question_version
  FOR EACH ROW EXECUTE FUNCTION validate_official_provenance();

CREATE FUNCTION protect_official_question_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.origin<>OLD.origin OR NEW.official_exam_id IS DISTINCT FROM OLD.official_exam_id
    OR NEW.official_question_number IS DISTINCT FROM OLD.official_question_number THEN
    RAISE EXCEPTION 'Logical question origin and official identity are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER editorial_question_official_identity BEFORE UPDATE ON editorial_question
  FOR EACH ROW EXECUTE FUNCTION protect_official_question_identity();
