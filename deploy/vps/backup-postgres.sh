#!/bin/bash
# Backup do banco e dos PDFs/recortes: um diretório completo por execução em
# /srv/backups/<aplicação>, mantendo 30 dias. No cron, uma linha por aplicação:
#   0 3 * * * /srv/apps/enade/backup-postgres.sh /srv/apps/enade >> /srv/backups/backup.log 2>&1
# Restauração em instalação de ensaio vazia: docs/DEPLOY.md §5.4.
set -euo pipefail
# Backups têm todos os dados: só o dono lê.
umask 077

aplicacao="${1:?informe a pasta da aplicação, como /srv/apps/enade}"
nome="$(basename "$aplicacao")"
destino="/srv/backups/$nome"
mkdir -p "$destino"
# Só a renomeação final publica o par banco+arquivos. Um backup interrompido
# não fica misturado aos conjuntos completos, mesmo com duas execuções juntas.
temporario="$(mktemp -d "$destino/.$nome-$(date +%Y-%m-%d-%H%M%S)-XXXXXX")"
trap 'rm -rf -- "$temporario"' EXIT
arquivo="$destino/$(basename "$temporario" | cut -c2-)"

docker compose --project-directory "$aplicacao" exec -T db \
  sh -c 'pg_dump --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$temporario/database.sql.gz"
# Os ativos são imutáveis por hash e são gravados antes de sua referência no
# banco. Copiá-los depois do dump inclui os arquivos referenciados nele.
docker compose --project-directory "$aplicacao" exec -T app \
  tar -C /data -czf - . > "$temporario/data.tar.gz"
(cd "$temporario" && sha256sum database.sql.gz data.tar.gz > SHA256SUMS)
mv -- "$temporario" "$arquivo"
# Preserva também a retenção dos backups antigos que continham só o banco.
find "$destino" -maxdepth 1 -type f -name "$nome-*.sql.gz" -mtime +30 -delete
find "$destino" -mindepth 1 -maxdepth 1 -type d -name "$nome-*" -mtime +30 -exec rm -rf -- {} +

echo "$(date '+%Y-%m-%d %H:%M') $nome: backup em $arquivo"
