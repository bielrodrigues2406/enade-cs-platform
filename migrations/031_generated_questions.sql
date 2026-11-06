-- Questões geradas por IA (GEN-1), autorizadas por Gabriel em 06/11/2026.
-- Ficam separadas das oficiais: origem AI_GENERATED, publicação pelo caminho
-- GENERATED (o gerador identificado e a conferência registrada, sem conta de
-- pessoa como revisora) e fora do treino, das provas e do desempenho oficial.

ALTER TABLE question_version DROP CONSTRAINT question_version_review_origin_check;
ALTER TABLE question_version ADD CONSTRAINT question_version_review_origin_check
  CHECK (review_origin IN ('HUMAN', 'ASSISTED', 'IMPORT', 'GENERATED'));

ALTER TABLE question_version DROP CONSTRAINT question_version_independent_review;
ALTER TABLE question_version ADD CONSTRAINT question_version_independent_review CHECK (
  editorial_status <> 'PUBLISHED' OR demonstration OR (
    review_origin = 'HUMAN' AND assisted_extractor IS NULL AND assisted_reviewer IS NULL
    AND created_by IS NOT NULL AND last_editor_id IS NOT NULL AND reviewed_by IS NOT NULL
    AND reviewed_by <> created_by AND reviewed_by <> last_editor_id AND reviewed_at IS NOT NULL
  ) OR (
    review_origin = 'ASSISTED' AND origin = 'OFFICIAL'
    AND assisted_extractor IS NOT NULL AND assisted_reviewer IS NOT NULL
    AND assisted_extractor <> assisted_reviewer
    AND reviewed_by IS NULL AND reviewed_at IS NOT NULL
  ) OR (
    review_origin = 'IMPORT' AND origin = 'OFFICIAL'
    AND assisted_extractor IS NULL AND assisted_reviewer IS NULL
    AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
  ) OR (
    review_origin = 'GENERATED' AND origin = 'AI_GENERATED'
    AND assisted_extractor IS NOT NULL AND assisted_reviewer IS NOT NULL
    AND reviewed_by IS NULL AND reviewed_at IS NOT NULL
  )
);

-- O que a geração registra de cada versão: tipo, formato, conceitos do núcleo,
-- resumo do conteúdo publicado (para republicar só o que mudou) e a nota da
-- conferência por nova resolução.
CREATE TABLE generated_question (
  version_id text PRIMARY KEY REFERENCES question_version(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ESPELHO', 'LACUNA', 'QUENTE')),
  item_format text NOT NULL CHECK (item_format IN ('SIMPLES', 'ITENS', 'ASSERCAO')),
  concept_ids text[] NOT NULL CHECK (cardinality(concept_ids) BETWEEN 1 AND 4),
  content_digest text NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  check_note text NOT NULL CHECK (char_length(btrim(check_note)) BETWEEN 1 AND 600)
);
CREATE INDEX generated_question_concepts ON generated_question USING gin (concept_ids);
