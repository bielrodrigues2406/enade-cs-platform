-- Discursivas conferidas por agente (DISC-2), como as objetivas da publicação
-- assistida (ADR-011): sem conta humana como revisora, mas com quem extraiu e
-- quem conferiu registrados. As importadas pela tela seguem exigindo a conta.
ALTER TABLE discursive_question
  ALTER COLUMN reviewed_by DROP NOT NULL,
  ADD COLUMN review_origin text NOT NULL DEFAULT 'IMPORT' CHECK (review_origin IN ('IMPORT', 'ASSISTED')),
  ADD COLUMN assisted_extractor text CHECK (assisted_extractor IS NULL OR assisted_extractor ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  ADD COLUMN assisted_reviewer text CHECK (assisted_reviewer IS NULL OR assisted_reviewer ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  ADD COLUMN review_note text CHECK (review_note IS NULL OR char_length(btrim(review_note)) BETWEEN 1 AND 400),
  ADD CONSTRAINT discursive_review_origin CHECK (
    (review_origin = 'IMPORT' AND reviewed_by IS NOT NULL AND assisted_reviewer IS NULL)
    OR (review_origin = 'ASSISTED' AND reviewed_by IS NULL AND assisted_reviewer IS NOT NULL AND assisted_extractor IS NOT NULL)
  );
