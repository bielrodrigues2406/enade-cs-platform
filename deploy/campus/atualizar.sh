#!/usr/bin/env bash
# Sobe ou atualiza a plataforma no servidor do câmpus IFSP.
#
# Modos de uso (execute dentro de deploy/campus/):
#   ./atualizar.sh          # constrói a imagem localmente a partir do checkout Git atual (padrão recomendado no câmpus)
#   ./atualizar.sh --pull   # baixa a imagem pré-construída do GHCR (usa VERSAO do .env)
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Arquivo .env não encontrado em $(pwd). Copie .env.example para .env, preencha POSTGRES_PASSWORD e APP_ORIGIN e aplique chmod 600 .env." >&2
  exit 1
fi

if [ "${1:-}" = "--pull" ]; then
  docker compose pull app db
  docker compose up -d --no-build --remove-orphans
else
  docker compose pull db
  docker compose up -d --build --remove-orphans
fi

docker image prune -f > /dev/null
docker compose ps
