#!/usr/bin/env bash
# Backup atômico do banco PostgreSQL e do volume /data (PDFs oficiais e recortes).
#
# Uso:
#   ./backup.sh [diretório-destino]
# Exemplo no cron (diariamente às 03:00, mantendo 30 dias):
#   0 3 * * * /srv/enade-cs-platform/deploy/campus/backup.sh /var/backups/enade >> /var/backups/enade/backup.log 2>&1
set -euo pipefail
umask 077

pasta_compose="$(cd "$(dirname "$0")" && pwd)"
destino="${1:-/var/backups/enade}"
nome="enade"

mkdir -p "$destino"
temporario="$(mktemp -d "$destino/.$nome-$(date +%Y-%m-%d-%H%M%S)-XXXXXX")"
trap 'rm -rf -- "$temporario"' EXIT
arquivo="$destino/$(basename "$temporario" | cut -c2-)"

docker compose --project-directory "$pasta_compose" exec -T db \
  sh -c 'pg_dump --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$temporario/database.sql.gz"

docker compose --project-directory "$pasta_compose" exec -T app \
  tar -C /data -czf - . > "$temporario/data.tar.gz"

(cd "$temporario" && sha256sum database.sql.gz data.tar.gz > SHA256SUMS)
mv -- "$temporario" "$arquivo"

find "$destino" -mindepth 1 -maxdepth 1 -type d -name "$nome-*" -mtime +30 -exec rm -rf -- {} +

echo "$(date '+%Y-%m-%d %H:%M') $nome: backup concluído em $arquivo"
