-- Novidades (NEWS-1): o conteúdo fica versionado em data/news/news.json;
-- aqui só o que cada identidade (visitante ou conta) já viu, para o aviso
-- aparecer uma vez por novidade e a marca "Novo" sumir depois de lida.
CREATE TABLE news_seen (
  identity_id uuid NOT NULL REFERENCES study_identity(id) ON DELETE CASCADE,
  news_id text NOT NULL CHECK (news_id ~ '^[a-z0-9-]{3,80}$'),
  seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (identity_id, news_id)
);
