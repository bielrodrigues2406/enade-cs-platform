-- Origem das questões de um treino parcial (pedido de Gabriel em 07/11):
-- OFFICIAL = provas do Inep e autorais (como antes); GENERATED = só questões
-- geradas por IA; MIXED = as duas, com cada gerada marcada na tela.
-- Prova da edição, formato 2026 e treinos de erros continuam só com OFFICIAL.
ALTER TABLE practice_attempt
  ADD COLUMN source text NOT NULL DEFAULT 'OFFICIAL' CHECK (source IN ('OFFICIAL', 'GENERATED', 'MIXED')),
  ADD CONSTRAINT practice_attempt_source_shape CHECK (source = 'OFFICIAL' OR (kind = 'PARTIAL' AND focus IS NULL));
