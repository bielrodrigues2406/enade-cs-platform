-- Pausa da prova completa (SIM-1, ADR-014). O prazo original continua fixo;
-- o tempo pausado se acumula em paused_ms e empurra o prazo efetivo. Pausada,
-- a prova não expira e não aceita respostas.
ALTER TABLE practice_attempt
  ADD COLUMN paused_at timestamptz,
  ADD COLUMN paused_ms bigint NOT NULL DEFAULT 0 CHECK (paused_ms >= 0),
  ADD CONSTRAINT practice_attempt_pause_edition CHECK (
    (paused_at IS NULL AND paused_ms = 0) OR (kind = 'EDITION' AND (paused_at IS NULL OR state = 'IN_PROGRESS'))
  );
