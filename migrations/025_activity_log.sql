-- Registro de atividades (pedido de Gabriel em 31/10): acessos, bloqueios,
-- contas, papéis, conteúdo e turmas, para a administração acompanhar o uso e
-- investigar abusos. O IP só é guardado em acessos e eventos de segurança.
-- Entradas com mais de 180 dias são apagadas pelo servidor (activity.ts).
CREATE TABLE activity_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL CHECK (category IN ('ACCESS', 'SECURITY', 'ACCOUNT', 'ROLE', 'CONTENT', 'CLASS')),
  action text NOT NULL CHECK (action ~ '^[A-Z_]{2,40}$'),
  actor_id uuid REFERENCES study_identity(id) ON DELETE SET NULL,
  subject text CHECK (length(subject) <= 300),
  detail text CHECK (length(detail) <= 500),
  ip text CHECK (length(ip) <= 64)
);
CREATE INDEX activity_log_at ON activity_log (at DESC);
CREATE INDEX activity_log_category_at ON activity_log (category, at DESC);
