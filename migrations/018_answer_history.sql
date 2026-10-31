-- Histórico de respostas (HIST-1). `answer` guarda só a resposta atual de cada
-- questão; aqui fica cada envio, sem alteração posterior, para medir a primeira
-- tentativa e a evolução. O registro só sai junto com o dono ou a questão.
CREATE TABLE answer_event (
  id bigserial PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES study_identity(id) ON DELETE CASCADE,
  version_id text NOT NULL,
  option_id text NOT NULL,
  correct boolean NOT NULL,
  -- BACKFILL: resposta que já existia antes do histórico; é a última escolha,
  -- não necessariamente a primeira.
  origin text NOT NULL CHECK (origin IN ('STUDY','BACKFILL')),
  answered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(version_id,option_id) REFERENCES question_option(question_id,id) ON DELETE CASCADE
);
CREATE INDEX answer_event_owner ON answer_event(owner_id,version_id,answered_at,id);

CREATE FUNCTION reject_answer_event_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Answer history is append-only' USING ERRCODE='23514';
END $$;
CREATE TRIGGER answer_event_append_only BEFORE UPDATE ON answer_event
  FOR EACH ROW EXECUTE FUNCTION reject_answer_event_update();

INSERT INTO answer_event(owner_id,version_id,option_id,correct,origin,answered_at)
  SELECT a.owner_id,a.question_id,a.option_id,a.option_id=v.correct_option_id,'BACKFILL',a.updated_at
  FROM answer a JOIN question_version v ON v.id=a.question_id;
