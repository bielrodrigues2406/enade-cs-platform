-- Conferência e publicação por agentes (PUB-A1, ADR-010, ADR-011). Gabriel
-- decidiu (D7) que não haverá conferência humana. O caminho ASSISTED registra
-- qual agente extraiu e qual conferiu, nunca uma conta de pessoa, e exige que
-- sejam agentes diferentes. O caminho humano continua valendo como antes.

-- Fontes: a conferência assistida confirma que o arquivo é o fixado no
-- catálogo (SHA-256) e que pertence à prova. Gabarito "final" passa a dizer
-- em que se apoia: declarado definitivo ou único publicado pelo Inep (D10).
ALTER TABLE source_document
  ADD COLUMN verification_origin text NOT NULL DEFAULT 'HUMAN'
    CHECK (verification_origin IN ('HUMAN', 'ASSISTED')),
  ADD COLUMN assisted_verifier text CHECK (assisted_verifier ~ '^[a-z][a-z0-9-]{1,39}$'),
  ADD COLUMN key_finality text CHECK (key_finality IN ('DECLARED', 'ONLY_PUBLISHED'));
ALTER TABLE source_document DROP CONSTRAINT source_document_check;
ALTER TABLE source_document ADD CONSTRAINT source_document_verified_review CHECK (
  status <> 'VERIFIED' OR (
    reviewed_at IS NOT NULL AND (kind <> 'ANSWER_KEY' OR is_final) AND (
      (verification_origin = 'HUMAN' AND assisted_verifier IS NULL
        AND reviewed_by IS NOT NULL AND reviewed_by IS DISTINCT FROM imported_by
        AND reviewed_by IS DISTINCT FROM last_editor_id)
      OR (verification_origin = 'ASSISTED' AND assisted_verifier IS NOT NULL AND reviewed_by IS NULL)
    )
  )
);
ALTER TABLE source_document ADD CONSTRAINT source_document_key_finality CHECK (
  key_finality IS NULL OR (kind = 'ANSWER_KEY' AND is_final)
);
ALTER TABLE source_event
  ADD COLUMN agent text CHECK (agent ~ '^[a-z][a-z0-9-]{1,39}$');

-- Versões: publicação assistida só para conteúdo oficial, com extrator e
-- conferente identificados e distintos, sem revisor humano registrado.
ALTER TABLE question_version
  ADD COLUMN review_origin text NOT NULL DEFAULT 'HUMAN'
    CHECK (review_origin IN ('HUMAN', 'ASSISTED')),
  ADD COLUMN assisted_extractor text CHECK (assisted_extractor ~ '^[a-z][a-z0-9-]{1,39}$'),
  ADD COLUMN assisted_reviewer text CHECK (assisted_reviewer ~ '^[a-z][a-z0-9-]{1,39}$');
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
  )
);

-- Eventos editoriais: de uma conta ou de um agente identificado, nunca de
-- ninguém. Não há rota HTTP que grave eventos de agente.
ALTER TABLE editorial_event ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE editorial_event
  ADD COLUMN agent text CHECK (agent ~ '^[a-z][a-z0-9-]{1,39}$'),
  ADD CONSTRAINT editorial_event_actor CHECK ((actor_id IS NULL) <> (agent IS NULL));

-- O que o agente conferiu em cada versão assistida: resumo do conteúdo
-- publicado (texto, gabarito, imagens), quando e com que notas. Republicar
-- o mesmo conteúdo não cria versão nova.
CREATE TABLE question_version_assisted (
  version_id text PRIMARY KEY REFERENCES question_version(id) ON DELETE CASCADE,
  assisted_digest text NOT NULL CHECK (assisted_digest ~ '^[a-f0-9]{64}$'),
  reviewed_at timestamptz NOT NULL,
  review_notes text NOT NULL DEFAULT '' CHECK (char_length(review_notes) <= 2000)
);
