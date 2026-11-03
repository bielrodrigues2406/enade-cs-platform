#!/usr/bin/env bash
# Hibernação segura da plataforma ao fim do ciclo de estudos (ex.: pós-prova em novembro).
#
# O que este script faz:
#   1. Gera um backup completo (banco + /data + SHA256SUMS) enquanto os contêineres estão ativos;
#   2. Confere o SHA-256 dos arquivos gerados antes de desligar;
#   3. Para e remove apenas os contêineres (`docker compose down`, NUNCA `-v`),
#      liberando memória/CPU no servidor do câmpus e mantendo os volumes `pgdata` e `data` intactos.
#
# Uso:
#   ./desligar.sh [diretório-destino-do-backup]
set -euo pipefail

pasta_compose="$(cd "$(dirname "$0")" && pwd)"
destino="${1:-/var/backups/enade}"

cd "$pasta_compose"

if docker compose ps --status running --services | grep -q '^db$'; then
  echo "1/3 Gerando backup final antes de desligar..."
  saida_backup="$("$pasta_compose/backup.sh" "$destino")"
  echo "$saida_backup"
  pasta_gerada="${saida_backup##*backup concluído em }"
  echo "2/3 Conferindo integridade (SHA256SUMS)..."
  (cd "$pasta_gerada" && sha256sum -c SHA256SUMS)
else
  echo "Aviso: contêiner db não está em execução; pulando backup pré-desligamento." >&2
fi

echo "3/3 Parando contêineres (volumes enade_pgdata e enade_data permanecem preservados)..."
docker compose down

cat <<EOF

Plataforma desligada com segurança.
- Para religar no MESMO servidor (com os volumes preservados):
    cd "$pasta_compose" && ./atualizar.sh
- Se o servidor for formatado ou migrado para outra VM / Fábrica de Software:
    copie o backup gerado em "$destino" e o arquivo .env (em canal seguro separado),
    e rode: ./restaurar.sh <pasta-do-backup>
EOF
