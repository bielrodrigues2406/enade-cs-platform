-- Separate durable study ownership from expiring browser credentials, preserving
-- every existing guest token and answer from migration 001.
ALTER TABLE visitor RENAME TO study_identity;
ALTER TABLE answer RENAME COLUMN visitor_id TO owner_id;

CREATE TABLE browser_session (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  identity_id uuid NOT NULL REFERENCES study_identity(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
INSERT INTO browser_session(token_hash, identity_id, expires_at)
  SELECT token_hash, id, expires_at FROM study_identity;
ALTER TABLE study_identity DROP COLUMN token_hash, DROP COLUMN expires_at;
CREATE INDEX browser_session_identity_idx ON browser_session(identity_id);
CREATE INDEX browser_session_expiry_idx ON browser_session(expires_at);

CREATE TABLE account (
  identity_id uuid PRIMARY KEY REFERENCES study_identity(id),
  email text NOT NULL UNIQUE CHECK (
    email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254
  ),
  password_hash text NOT NULL CHECK (
    password_hash ~ '^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{64}$'
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);
