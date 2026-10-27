-- Private staging preserves extraction evidence without asserting editorial review.
CREATE TABLE question_intake (
  id uuid PRIMARY KEY,
  exam_source_id uuid NOT NULL REFERENCES source_document(id),
  key_source_id uuid REFERENCES source_document(id),
  source_key text NOT NULL CHECK (source_key ~ '^[QD][0-9]{1,4}$'),
  question_number integer NOT NULL CHECK (question_number BETWEEN 1 AND 1000),
  kind text NOT NULL CHECK (kind IN ('OBJECTIVE','DISCURSIVE','UNKNOWN')),
  pages integer[] NOT NULL DEFAULT '{}',
  original_raw jsonb NOT NULL CHECK (jsonb_typeof(original_raw)='object'),
  extraction jsonb NOT NULL CHECK (jsonb_typeof(extraction)='object'),
  machine_digest text NOT NULL CHECK (machine_digest ~ '^[a-f0-9]{64}$'),
  content jsonb NOT NULL CHECK (jsonb_typeof(content)='object'),
  assisted_review jsonb NOT NULL CHECK (
    jsonb_typeof(assisted_review)='object'
    AND assisted_review->>'origin' IS NOT DISTINCT FROM 'ASSISTED'
    AND assisted_review->'humanReviewed' IS NOT DISTINCT FROM 'false'::jsonb
  ),
  flags text[] NOT NULL DEFAULT '{}',
  resolved_flags text[] NOT NULL DEFAULT '{}',
  state text NOT NULL CHECK (state IN ('PENDING','HOLD','DRAFTED')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  imported_by uuid REFERENCES account(identity_id),
  last_editor_id uuid REFERENCES account(identity_id),
  drafted_version_id text UNIQUE REFERENCES question_version(id),
  fidelity_confirmed_by uuid REFERENCES account(identity_id),
  fidelity_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_source_id,source_key),
  CHECK (cardinality(pages)<=1000 AND cardinality(flags)<=100 AND cardinality(resolved_flags)<=100),
  CHECK (resolved_flags <@ flags),
  CHECK ((state='DRAFTED')=(drafted_version_id IS NOT NULL)),
  CHECK ((state='DRAFTED')=(fidelity_confirmed_by IS NOT NULL AND fidelity_confirmed_at IS NOT NULL)),
  CHECK (state='DRAFTED' OR (fidelity_confirmed_by IS NULL AND fidelity_confirmed_at IS NULL))
);
CREATE INDEX question_intake_queue ON question_intake(state,created_at,id);
CREATE TABLE question_intake_event (
  id bigserial PRIMARY KEY,
  intake_id uuid NOT NULL REFERENCES question_intake(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES account(identity_id),
  event_type text NOT NULL CHECK (event_type IN ('IMPORTED','REEXTRACTED','EDITED','DRAFTED')),
  revision integer NOT NULL CHECK (revision>0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_type IN ('IMPORTED','REEXTRACTED') OR actor_id IS NOT NULL)
);
CREATE FUNCTION protect_question_intake() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE exam source_document%ROWTYPE; answer_key source_document%ROWTYPE; version question_version%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.state='DRAFTED' OR NEW.id<>OLD.id OR NEW.exam_source_id<>OLD.exam_source_id
      OR NEW.source_key<>OLD.source_key OR NEW.question_number<>OLD.question_number
      OR NEW.original_raw<>OLD.original_raw OR NEW.imported_by IS DISTINCT FROM OLD.imported_by
      OR NEW.created_at<>OLD.created_at OR NEW.revision<>OLD.revision+1
      OR (OLD.last_editor_id IS NOT NULL AND NEW.last_editor_id IS NULL) THEN
      RAISE EXCEPTION 'Question intake evidence and drafted items are immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  SELECT * INTO exam FROM source_document WHERE id=NEW.exam_source_id;
  IF exam.id IS NULL OR exam.kind<>'EXAM'
    OR EXISTS(SELECT 1 FROM unnest(NEW.pages) p WHERE p IS NULL OR p NOT BETWEEN 1 AND exam.page_count) THEN
    RAISE EXCEPTION 'Question intake requires an exam and valid source pages' USING ERRCODE='23514';
  END IF;
  IF NEW.key_source_id IS NOT NULL THEN
    SELECT * INTO answer_key FROM source_document WHERE id=NEW.key_source_id;
    IF answer_key.id IS NULL OR answer_key.kind<>'ANSWER_KEY' OR answer_key.year<>exam.year
      OR answer_key.area<>exam.area OR answer_key.modality<>exam.modality THEN
      RAISE EXCEPTION 'Question intake answer key must match its exam' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.state='DRAFTED' THEN
    SELECT * INTO version FROM question_version WHERE id=NEW.drafted_version_id;
    IF NEW.kind<>'OBJECTIVE' OR version.id IS NULL OR version.origin<>'OFFICIAL'
      OR version.exam_source_id IS DISTINCT FROM NEW.exam_source_id
      OR version.key_source_id IS DISTINCT FROM NEW.key_source_id
      OR version.source_question_number IS DISTINCT FROM NEW.question_number
      OR version.created_by IS DISTINCT FROM NEW.fidelity_confirmed_by
      OR version.source_page IS DISTINCT FROM NEW.pages[1]
      OR NOT NEW.flags <@ NEW.resolved_flags THEN
      RAISE EXCEPTION 'Question intake promotion requires matching official provenance and resolved holds' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER question_intake_guard BEFORE INSERT OR UPDATE ON question_intake
  FOR EACH ROW EXECUTE FUNCTION protect_question_intake();
