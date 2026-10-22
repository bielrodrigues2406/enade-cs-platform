CREATE TABLE visitor (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE question_version (
  id text PRIMARY KEY,
  title text NOT NULL,
  topic text NOT NULL,
  prompt text NOT NULL,
  origin text NOT NULL CHECK (origin IN ('AUTHOR_CREATED', 'OFFICIAL', 'AI_GENERATED')),
  editorial_status text NOT NULL CHECK (editorial_status IN ('DRAFT', 'PUBLISHED')),
  explanation text NOT NULL,
  correct_option_id text NOT NULL,
  CHECK (origin <> 'OFFICIAL' OR editorial_status <> 'PUBLISHED')
  -- Official publication is deliberately unavailable until provenance/review are implemented.
);
CREATE TABLE question_option (
  question_id text NOT NULL REFERENCES question_version(id),
  id text NOT NULL,
  text text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (question_id, id),
  UNIQUE (question_id, position)
);
ALTER TABLE question_version ADD CONSTRAINT correct_option_exists
  FOREIGN KEY (id, correct_option_id) REFERENCES question_option(question_id, id)
  DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE answer (
  visitor_id uuid NOT NULL REFERENCES visitor(id),
  question_id text NOT NULL REFERENCES question_version(id),
  option_id text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visitor_id, question_id),
  FOREIGN KEY (question_id, option_id) REFERENCES question_option(question_id, id)
);
