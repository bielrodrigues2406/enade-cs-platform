-- A status check must serialize with concurrent publication. Otherwise an option
-- insert can observe IN_REVIEW, wait at its FK, and resume after publication.
CREATE OR REPLACE FUNCTION protect_published_options() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_id text; new_id text; version_row record;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id=OLD.question_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_id=NEW.question_id; END IF;
  FOR version_row IN
    SELECT id,editorial_status FROM question_version
      WHERE id IN (old_id,new_id) ORDER BY id FOR SHARE
  LOOP
    IF version_row.editorial_status='PUBLISHED' THEN
      RAISE EXCEPTION 'Published alternatives are immutable' USING ERRCODE='23514';
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
