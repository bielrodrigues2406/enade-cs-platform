ALTER TABLE source_document
  ADD COLUMN acquisition_method text NOT NULL DEFAULT 'DIRECT'
    CHECK (acquisition_method IN ('DIRECT','MIRROR','LOCAL')),
  ADD COLUMN retrieval_url text,
  DROP CONSTRAINT source_document_official_url_check,
  DROP CONSTRAINT source_document_kind_check,
  DROP CONSTRAINT source_document_modality_check;
ALTER TABLE source_document
  ADD CONSTRAINT source_document_official_url_check CHECK (
    official_url ~ '^https://(download\.inep\.gov\.br/(enade/|pnd/|educacao_superior/enade/|download/(enade/|Enade2008_RNP/))|www\.gov\.br/inep/).+\.pdf$'
  ),
  ADD CONSTRAINT source_document_kind_check CHECK (kind IN ('EXAM','ANSWER_KEY','RESPONSE_STANDARD','EXAM_MAP')),
  ADD CONSTRAINT source_document_modality_check CHECK (modality IN ('BACHARELADO','LICENCIATURA','CST','COMUM')),
  ADD CONSTRAINT source_document_acquisition_check CHECK (
    (acquisition_method IN ('DIRECT','LOCAL') AND retrieval_url IS NULL)
    OR (acquisition_method='MIRROR' AND retrieval_url IS NOT NULL
      AND retrieval_url ~ '^https://raw\.githubusercontent\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/[a-f0-9]{40}/[^?#]+\.pdf$')
  );

CREATE OR REPLACE FUNCTION protect_source_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='VERIFIED' OR NEW.id<>OLD.id OR NEW.sha256<>OLD.sha256
    OR NEW.official_url<>OLD.official_url OR NEW.byte_size<>OLD.byte_size
    OR NEW.page_count<>OLD.page_count OR NEW.imported_by IS DISTINCT FROM OLD.imported_by
    OR NEW.acquisition_method<>OLD.acquisition_method
    OR NEW.retrieval_url IS DISTINCT FROM OLD.retrieval_url THEN
    RAISE EXCEPTION 'Source artifacts and verified metadata are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
