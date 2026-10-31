-- Classificação em dois níveis e nota da conferência (D15, ADR-011).
-- `topic` continua sendo a área (lista fixa usada nos filtros e no treino);
-- `subject` guarda o assunto específico, livre e curto, para busca e listas.
-- `review_note` é a ressalva de conteúdo que o conferente quer que o
-- estudante leia (dado inconsistente no texto do Inep, ambiguidade, gabarito
-- discutível). Ressalva de conteúdo não bloqueia publicação; só fidelidade.
ALTER TABLE question_version
  ADD COLUMN subject text CHECK (subject IS NULL OR char_length(btrim(subject)) BETWEEN 1 AND 80),
  ADD COLUMN review_note text CHECK (review_note IS NULL OR char_length(btrim(review_note)) BETWEEN 1 AND 400);
