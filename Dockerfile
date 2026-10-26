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
    SOURCE_ARCHIVE_DIR=/data/sources
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY scripts/migrate.mjs ./scripts/migrate.mjs
RUN mkdir -p /data/sources && chown node:node /data/sources
USER node
EXPOSE 3000
# Migrations são transacionais e serializadas por advisory lock; depois a API
# substitui o shell para receber os sinais de encerramento.
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node dist/api/serve.js"]
