#!/usr/bin/env bash
# Restaura um backup completo (database.sql.gz + data.tar.gz + SHA256SUMS)
# gerado por backup.sh ou desligar.sh, no mesmo servidor ou em uma VM nova.
#
# Uso:
#   ./restaurar.sh /var/backups/enade/enade-AAAA-MM-DD-HHMMSS-XXXXXX [--sim]
set -euo pipefail

pasta_compose="$(cd "$(dirname "$0")" && pwd)"
backup_dir="${1:?Informe o caminho da pasta de backup (ex.: /var/backups/enade/enade-2026-11-30-...)}"
confirmacao="${2:-}"

if [ ! -f "$pasta_compose/.env" ]; then
  echo "Arquivo .env não encontrado em $pasta_compose. Configure POSTGRES_PASSWORD e APP_ORIGIN antes de restaurar." >&2
  exit 1
fi

for item in database.sql.gz data.tar.gz SHA256SUMS; do
  if [ ! -f "$backup_dir/$item" ]; then
    echo "Arquivo obrigatório ausente no backup: $backup_dir/$item" >&2
    exit 1
  fi
done

echo "Conferindo integridade dos arquivos do backup..."
(cd "$backup_dir" && sha256sum -c SHA256SUMS)

if [ "$confirmacao" != "--sim" ]; then
  echo "ATENÇÃO: isto substituirá o banco de dados e os arquivos em /data desta instalação."
  read -r -p "Digite RESTAURAR para confirmar: " resposta
  if [ "$resposta" != "RESTAURAR" ]; then
    echo "Operação cancelada."
    exit 1
  fi
fi

cd "$pasta_compose"
docker compose stop app || true
docker compose up -d db

echo "Aguardando PostgreSQL ficar pronto..."
for _ in $(seq 1 30); do
  if docker compose exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Restaurando banco de dados..."
gunzip -c "$backup_dir/database.sql.gz" | docker compose exec -T db \
  sh -c 'psql --single-transaction --set ON_ERROR_STOP=on -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "Restaurando PDFs e imagens em /data..."
docker compose run --rm -T --no-deps --entrypoint sh app \
  -c 'mkdir -p /data/sources /data/question-assets && find /data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -C /data -xzf -' \
  < "$backup_dir/data.tar.gz"

echo "Subindo aplicação..."
docker compose up -d app
docker compose ps
echo "Restauração concluída. Confira os logs com: docker compose logs -f app"
