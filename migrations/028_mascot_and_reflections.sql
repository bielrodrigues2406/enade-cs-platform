ALTER TABLE account ADD COLUMN mascot_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE answer_reflection (
  owner_id uuid NOT NULL REFERENCES study_identity(id) ON DELETE CASCADE,
  version_id text NOT NULL REFERENCES question_version(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) <= 600),
  revision integer NOT NULL CHECK (revision BETWEEN 1 AND 1000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, version_id)
);
