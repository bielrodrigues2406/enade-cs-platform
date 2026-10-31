-- Importação (IMP-1): a letra lida do gabarito pode ser corrigida na tela,
-- com justificativa, e o lote guarda as inconsistências encontradas na
-- leitura para quem confere ver antes de publicar.
ALTER TABLE exam_import_item
  ADD COLUMN key_answer text CHECK (key_answer IS NULL OR key_answer IN ('A', 'B', 'C', 'D', 'E', 'ANULADA')),
  ADD COLUMN answer_note text CHECK (answer_note IS NULL OR char_length(btrim(answer_note)) BETWEEN 5 AND 500);
UPDATE exam_import_item SET key_answer = answer;
-- Letra diferente da lida no gabarito exige justificativa.
ALTER TABLE exam_import_item ADD CONSTRAINT exam_import_answer_change CHECK (
  answer IS NOT DISTINCT FROM key_answer OR answer_note IS NOT NULL
);
ALTER TABLE exam_import
  ADD COLUMN issues jsonb NOT NULL DEFAULT '[]';
