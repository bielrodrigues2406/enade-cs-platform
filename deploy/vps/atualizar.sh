#!/bin/bash
# Baixa a imagem da versão do .env (VERSAO) e sobe o que mudou. As migrations
# e a carga do conteúdo rodam ao iniciar o contêiner. Para voltar a uma versão
# anterior, troque VERSAO no .env e rode de novo.
set -euo pipefail
cd "$(dirname "$0")"

docker compose pull
docker compose up -d --remove-orphans
docker image prune -f > /dev/null
docker compose ps
