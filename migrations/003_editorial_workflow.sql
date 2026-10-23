CREATE TABLE curator_role (
  identity_id uuid PRIMARY KEY REFERENCES account(identity_id)
);

CREATE TABLE editorial_question (
  id text PRIMARY KEY,
  origin text NOT NULL CHECK (origin IN ('AUTHOR_CREATED','OFFICIAL','AI_GENERATED')),
  current_version_id text,
  UNIQUE(id,origin)
);
INSERT INTO editorial_question(id,origin,current_version_id)
  SELECT id,origin,CASE WHEN editorial_status='PUBLISHED' THEN id ELSE NULL END FROM question_version;

ALTER TABLE question_version
  ADD COLUMN question_id text,
  ADD COLUMN version_number integer NOT NULL DEFAULT 1 CHECK (version_number > 0),
  ADD COLUMN editorial_revision integer NOT NULL DEFAULT 1 CHECK (editorial_revision > 0),
  ADD COLUMN author_credit text NOT NULL DEFAULT 'Crédito não informado (registro legado)',
  ADD COLUMN created_by uuid REFERENCES account(identity_id),
  ADD COLUMN last_editor_id uuid REFERENCES account(identity_id),
  ADD COLUMN reviewed_by uuid REFERENCES account(identity_id),
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN demonstration boolean NOT NULL DEFAULT false;
UPDATE question_version SET question_id=id;
UPDATE question_version SET demonstration=true,author_credit='Conteúdo demonstrativo da base'
  WHERE id IN ('demo-sql-v1','demo-search-v1','demo-network-v1');
-- Flush the existing deferred answer-key FK events before further ALTERs.
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE question_version ALTER COLUMN question_id SET NOT NULL;
ALTER TABLE question_version DROP CONSTRAINT question_version_editorial_status_check;
ALTER TABLE question_version ADD CONSTRAINT question_version_editorial_status_check
  CHECK (editorial_status IN ('DRAFT','IN_REVIEW','REJECTED','PUBLISHED'));
ALTER TABLE question_version ADD CONSTRAINT question_version_parent_fk
  FOREIGN KEY(question_id,origin) REFERENCES editorial_question(id,origin) ON DELETE CASCADE;
ALTER TABLE question_version ADD CONSTRAINT question_version_sequence_unique UNIQUE(question_id,version_number);
ALTER TABLE question_version ADD CONSTRAINT question_version_parent_id_unique UNIQUE(question_id,id);
ALTER TABLE editorial_question ADD CONSTRAINT editorial_question_current_fk
  FOREIGN KEY(id,current_version_id) REFERENCES question_version(question_id,id)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE question_version ADD CONSTRAINT question_version_independent_review CHECK (
  editorial_status <> 'PUBLISHED' OR demonstration OR (
    created_by IS NOT NULL AND last_editor_id IS NOT NULL AND reviewed_by IS NOT NULL
    AND reviewed_by <> created_by AND reviewed_by <> last_editor_id AND reviewed_at IS NOT NULL
  )
);
CREATE UNIQUE INDEX question_version_one_open ON question_version(question_id)
  WHERE editorial_status IN ('DRAFT','IN_REVIEW','REJECTED');
ALTER TABLE question_option DROP CONSTRAINT question_option_question_id_fkey;
ALTER TABLE question_option ADD CONSTRAINT question_option_question_id_fkey
  FOREIGN KEY(question_id) REFERENCES question_version(id) ON DELETE CASCADE;

CREATE TABLE editorial_event (
  id bigserial PRIMARY KEY,
  question_id text NOT NULL REFERENCES editorial_question(id) ON DELETE CASCADE,
  version_id text NOT NULL REFERENCES question_version(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES account(identity_id),
  event_type text NOT NULL CHECK(event_type IN ('CREATED','EDITED','SUBMITTED','REJECTED','PUBLISHED','VERSION_CREATED')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX editorial_event_version_idx ON editorial_event(version_id,id DESC);

CREATE FUNCTION protect_published_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.editorial_status='PUBLISHED' THEN
    -- Administrative removal of a whole logical question may cascade. There is
    -- deliberately no HTTP deletion route; partial historical edits are forbidden.
    IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM editorial_question WHERE id=OLD.question_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Published question versions are immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER question_version_immutable BEFORE UPDATE OR DELETE ON question_version
  FOR EACH ROW EXECUTE FUNCTION protect_published_version();

CREATE FUNCTION protect_published_options() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_id text; new_id text;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id=OLD.question_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_id=NEW.question_id; END IF;
  IF EXISTS(SELECT 1 FROM question_version WHERE id IN (old_id,new_id) AND editorial_status='PUBLISHED') THEN
    RAISE EXCEPTION 'Published alternatives are immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER question_option_immutable BEFORE INSERT OR UPDATE OR DELETE ON question_option
  FOR EACH ROW EXECUTE FUNCTION protect_published_options();

CREATE FUNCTION validate_current_question_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.current_version_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM question_version WHERE id=NEW.current_version_id AND question_id=NEW.id AND editorial_status='PUBLISHED'
  ) THEN
    RAISE EXCEPTION 'Current question version must be published' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER editorial_question_current_published BEFORE INSERT OR UPDATE ON editorial_question
  FOR EACH ROW EXECUTE FUNCTION validate_current_question_version();
