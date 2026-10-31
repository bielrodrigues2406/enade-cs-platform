-- Prova completa da edição (SIM-1, ADR-014). A tentativa do treino parcial
-- ganha um segundo tipo: todas as objetivas publicadas de uma prova oficial,
-- na ordem original, com prazo controlado pelo servidor. Itens, revisões,
-- finalização e resultado continuam os da migration 012.
ALTER TABLE practice_attempt
  ADD COLUMN kind text NOT NULL DEFAULT 'PARTIAL' CHECK (kind IN ('PARTIAL', 'EDITION')),
  ADD COLUMN exam_source_id uuid REFERENCES source_document(id),
  ADD COLUMN deadline_at timestamptz;

ALTER TABLE practice_attempt DROP CONSTRAINT practice_attempt_size_check;
ALTER TABLE practice_attempt ADD CONSTRAINT practice_attempt_kind_shape CHECK (
  (kind = 'PARTIAL' AND size IN (10, 20, 30) AND exam_source_id IS NULL AND deadline_at IS NULL)
  OR (kind = 'EDITION' AND size BETWEEN 1 AND 60 AND area IS NULL
    AND exam_source_id IS NOT NULL AND deadline_at IS NOT NULL)
);
ALTER TABLE practice_item DROP CONSTRAINT practice_item_position_check;
ALTER TABLE practice_item ADD CONSTRAINT practice_item_position_check CHECK (position BETWEEN 1 AND 60);

-- Tipo, prova e prazo também ficam fixos depois de criada a tentativa.
CREATE OR REPLACE FUNCTION protect_practice_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state='COMPLETED'
    OR (NEW.id,NEW.owner_id,NEW.request_id,NEW.size,NEW.area,NEW.created_at,NEW.kind,NEW.exam_source_id,NEW.deadline_at)
      IS DISTINCT FROM (OLD.id,OLD.owner_id,OLD.request_id,OLD.size,OLD.area,OLD.created_at,OLD.kind,OLD.exam_source_id,OLD.deadline_at) THEN
    RAISE EXCEPTION 'Practice configuration and completed results are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.state='COMPLETED' AND (
    (SELECT count(*) FROM practice_item WHERE attempt_id=NEW.id)<>NEW.size
    OR (NEW.summary->>'total')::integer IS DISTINCT FROM NEW.size
  ) THEN
    RAISE EXCEPTION 'Practice result does not match its items' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
