-- Treinos montados do histórico da pessoa (pedido de Gabriel em 31/10):
-- ERRORS = erros do estudo livre prontos para revisão ("Treinar meus erros");
-- RETRY = as erradas e em branco de um treino ou prova já finalizado
-- ("Refazer as erradas"), apontando a tentativa de origem enquanto ela existir.
-- O tamanho é o que a seleção encontrar (até 30).
ALTER TABLE practice_attempt
  ADD COLUMN focus text CHECK (focus IN ('ERRORS', 'RETRY')),
  ADD COLUMN retry_of uuid REFERENCES practice_attempt(id) ON DELETE SET NULL,
  ADD CONSTRAINT practice_attempt_focus_shape CHECK (
    (focus IS NULL AND retry_of IS NULL)
    OR (focus = 'ERRORS' AND kind = 'PARTIAL' AND area IS NULL AND retry_of IS NULL)
    OR (focus = 'RETRY' AND kind = 'PARTIAL' AND area IS NULL)
  );
