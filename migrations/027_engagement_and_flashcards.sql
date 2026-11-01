-- Engajamento (ENG-1): meta diária, conquistas e ranking de constância.
-- Flashcards (FLASH-1): estado de repetição espaçada (FSRS-5) por pessoa.
-- O conteúdo dos cartões e das fichas fica em data/ (versionado); aqui só o
-- que é da pessoa.

-- Meta de questões por dia; sem linha, vale o padrão de 5.
CREATE TABLE study_goal (
  identity_id uuid PRIMARY KEY REFERENCES study_identity(id) ON DELETE CASCADE,
  daily_target integer NOT NULL DEFAULT 5 CHECK (daily_target BETWEEN 1 AND 50),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Conquista desbloqueada uma vez; seen_at marca que o aviso animado já foi mostrado.
CREATE TABLE achievement_unlock (
  identity_id uuid NOT NULL REFERENCES study_identity(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[a-z0-9-]{2,40}$'),
  unlocked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  seen_at timestamptz,
  PRIMARY KEY (identity_id, code)
);

-- Ranking de constância: a conta aparece por padrão e pode sair a qualquer momento.
ALTER TABLE account ADD COLUMN ranking_visible boolean NOT NULL DEFAULT true;

-- Estado de cada cartão para a pessoa (modelo DSR do FSRS: dificuldade, estabilidade e prazo).
CREATE TABLE flashcard_state (
  identity_id uuid NOT NULL REFERENCES study_identity(id) ON DELETE CASCADE,
  card_id text NOT NULL CHECK (card_id ~ '^[a-z0-9-]{3,80}$'),
  stability double precision NOT NULL CHECK (stability > 0),
  difficulty double precision NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
  reps integer NOT NULL DEFAULT 0 CHECK (reps >= 0),
  lapses integer NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  last_review timestamptz NOT NULL,
  due timestamptz NOT NULL,
  PRIMARY KEY (identity_id, card_id)
);
CREATE INDEX flashcard_state_due ON flashcard_state(identity_id, due);

-- Cada resposta a um cartão (1 errei, 2 difícil, 3 bom, 4 fácil): histórico para
-- constância, conquistas e, no futuro, otimizar os parâmetros do FSRS.
CREATE TABLE flashcard_review (
  id bigserial PRIMARY KEY,
  identity_id uuid NOT NULL REFERENCES study_identity(id) ON DELETE CASCADE,
  card_id text NOT NULL CHECK (card_id ~ '^[a-z0-9-]{3,80}$'),
  grade smallint NOT NULL CHECK (grade BETWEEN 1 AND 4),
  reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX flashcard_review_owner ON flashcard_review(identity_id, reviewed_at);
