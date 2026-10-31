#!/bin/bash
# Backup do banco de uma aplicação: um .sql.gz por execução em
# /srv/backups/<aplicação>, mantendo 30 dias. No cron, uma linha por aplicação:
#   0 3 * * * /srv/apps/enade/backup-postgres.sh /srv/apps/enade >> /srv/backups/backup.log 2>&1
# Restaurar (apaga os dados atuais daquele banco):
#   gunzip -c <arquivo>.sql.gz | docker compose -f <app>/docker-compose.yml exec -T db \
#     sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
set -euo pipefail
# Backups têm todos os dados: só o dono lê.
umask 077

aplicacao="${1:?informe a pasta da aplicação, como /srv/apps/enade}"
nome="$(basename "$aplicacao")"
destino="/srv/backups/$nome"
mkdir -p "$destino"
arquivo="$destino/$nome-$(date +%Y-%m-%d-%H%M%S).sql.gz"
# Temporário próprio: dois backups ao mesmo tempo (o do cron e um manual) não
# se atropelam, e um backup interrompido não deixa arquivo pela metade.
temporario="$(mktemp "$destino/.$nome-XXXXXX")"
trap 'rm -f "$temporario"' EXIT

docker compose --project-directory "$aplicacao" exec -T db \
  sh -c 'pg_dump --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$temporario"
mv "$temporario" "$arquivo"
find "$destino" -name "$nome-*.sql.gz" -mtime +30 -delete

echo "$(date '+%Y-%m-%d %H:%M') $nome: backup em $arquivo"
