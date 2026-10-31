# Imagem de produção independente de provedor. Ver docs/DEPLOY.md.
FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:admin

FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    WEB_DIST=/app/dist/web/browser \
    SOURCE_ARCHIVE_DIR=/data/sources \
    QUESTION_ASSET_DIR=/data/question-assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Importação de provas (IMP-1): leitura e recorte de PDF no servidor; curl
# baixa as provas oficiais na carga de conteúdo (bootstrap-content).
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils imagemagick curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY data ./data
COPY scripts/migrate.mjs scripts/import-exam.mjs ./scripts/
COPY scripts/lib ./scripts/lib
RUN mkdir -p /data/sources /data/question-assets && chown -R node:node /data
USER node
EXPOSE 3000
# Migrations são transacionais e serializadas por advisory lock. Depois, a
# carga do conteúdo commitado (idempotente; BOOTSTRAP_CONTENT=0 desliga) — uma
# falha nela, como o Inep fora do ar, não impede a API de subir. Por fim a API
# substitui o shell para receber os sinais de encerramento.
CMD ["sh", "-c", "node scripts/migrate.mjs && { [ \"$BOOTSTRAP_CONTENT\" = 0 ] || node dist/admin/bootstrap-content.mjs || echo 'Carga de conteúdo falhou; a API sobe mesmo assim.'; } && exec node dist/api/serve.js"]
