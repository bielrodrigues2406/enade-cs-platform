-- Treino por área com qualquer quantidade e cronômetro opcional (SIM-1).
-- Áreas com menos de 10 questões publicadas (Redes tem 7) ficavam sem treino.
-- O tamanho deixa de ser só 10/20/30; o servidor ainda exige que haja questões
-- distintas suficientes. Treino cronometrado usa o mesmo prazo e pausa da prova.
ALTER TABLE practice_attempt DROP CONSTRAINT practice_attempt_kind_shape;
ALTER TABLE practice_attempt ADD CONSTRAINT practice_attempt_kind_shape CHECK (
  (kind = 'PARTIAL' AND size BETWEEN 1 AND 30 AND exam_source_id IS NULL)
  OR (kind = 'EDITION' AND size BETWEEN 1 AND 60 AND area IS NULL
    AND exam_source_id IS NOT NULL AND deadline_at IS NOT NULL)
);
ALTER TABLE practice_attempt DROP CONSTRAINT practice_attempt_pause_edition;
ALTER TABLE practice_attempt ADD CONSTRAINT practice_attempt_pause_timed CHECK (
  (paused_at IS NULL AND paused_ms = 0) OR (deadline_at IS NOT NULL AND (paused_at IS NULL OR state = 'IN_PROGRESS'))
);
