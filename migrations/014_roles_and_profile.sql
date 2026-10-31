-- Papéis e perfil (ROLE-1, D13/D14). O administrador autoriza o e-mail de um
-- professor; quando a conta existe (ou é criada depois), o papel é atribuído.
-- O primeiro administrador vem de um comando no servidor. Tudo fica auditado.

-- Nome e prontuário são opcionais: servem para ligar a conta à lista da turma.
ALTER TABLE account
  ADD COLUMN display_name text
    CHECK (display_name IS NULL OR char_length(btrim(display_name)) BETWEEN 2 AND 120),
  ADD COLUMN enrollment text
    CHECK (enrollment IS NULL OR enrollment ~ '^[A-Z]{2}[0-9]{6,8}X?$');
CREATE UNIQUE INDEX account_enrollment_unique ON account(enrollment) WHERE enrollment IS NOT NULL;

CREATE TABLE account_role (
  identity_id uuid NOT NULL REFERENCES account(identity_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('ADMIN', 'PROFESSOR')),
  granted_by uuid REFERENCES account(identity_id), -- nulo: comando no servidor
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (identity_id, role)
);

CREATE TABLE role_invitation (
  email text NOT NULL CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254),
  role text NOT NULL CHECK (role IN ('ADMIN', 'PROFESSOR')),
  invited_by uuid NOT NULL REFERENCES account(identity_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email, role)
);

CREATE TABLE role_event (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN', 'PROFESSOR')),
  action text NOT NULL CHECK (action IN ('INVITED', 'GRANTED', 'REVOKED', 'INVITATION_CANCELLED')),
  actor_id uuid REFERENCES account(identity_id), -- nulo: comando no servidor
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX role_event_email_idx ON role_event(email, created_at);
