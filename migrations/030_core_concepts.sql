-- Núcleo por área (NUC-1): autoavaliação de cada conceito pela própria pessoa.
-- O conteúdo do núcleo fica versionado em data/core-concepts; aqui só a
-- resposta da pessoa: 0 não sei, 1 mais ou menos, 2 sei explicar.
CREATE TABLE core_concept_rating (
  identity_id uuid NOT NULL REFERENCES study_identity(id) ON DELETE CASCADE,
  concept_id text NOT NULL CHECK (concept_id ~ '^[a-z0-9-]{3,80}$'),
  level smallint NOT NULL CHECK (level BETWEEN 0 AND 2),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (identity_id, concept_id)
);
