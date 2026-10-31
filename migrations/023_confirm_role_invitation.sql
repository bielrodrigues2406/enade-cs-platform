-- Convite de papel com confirmação (auditoria de 31/10, C1; decisão de Gabriel).
-- O e-mail do cadastro não é confirmado: quem cadastrasse primeiro um e-mail
-- convidado recebia o papel. Agora o cadastro só "reivindica" o convite e o
-- administrador confirma vendo nome e prontuário.
ALTER TABLE role_invitation
  ADD COLUMN claimed_by uuid REFERENCES account(identity_id) ON DELETE SET NULL,
  ADD COLUMN claimed_at timestamptz,
  ADD CONSTRAINT role_invitation_claim_pair CHECK ((claimed_by IS NULL) = (claimed_at IS NULL));
ALTER TABLE role_event DROP CONSTRAINT role_event_action_check;
ALTER TABLE role_event ADD CONSTRAINT role_event_action_check
  CHECK (action IN ('INVITED', 'CLAIMED', 'GRANTED', 'REVOKED', 'INVITATION_CANCELLED'));
