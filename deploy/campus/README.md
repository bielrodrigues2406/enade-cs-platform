# Operação no servidor do câmpus IFSP (`deploy/campus/`)

Este diretório concentra a configuração Docker e os scripts operacionais para subir, atualizar, fazer backup, desligar ao fim do ciclo e religar ou migrar a plataforma **sem perda de dados**. Foi preparado para a equipe de TI do câmpus e para as próximas equipes (Fábrica de Software).

Documentação completa de arquitetura e segurança de produção: [`docs/DEPLOY.md`](../../docs/DEPLOY.md) (§5.1 e §5.2).

---

## Arquivos deste diretório

| Arquivo | Função |
| --- | --- |
| `docker-compose.yml` | Sobe `db` (PostgreSQL 17 em rede interna isolada, sem porta no host) e `app` (Node 24 em `127.0.0.1:3000`, `cap_drop: ALL`, `no-new-privileges`, `pids_limit: 128`, `/tmp` em `tmpfs` `noexec`). |
| `.env.example` | Modelo de configuração (`POSTGRES_PASSWORD`, `APP_ORIGIN`, `APP_BIND`, `APP_PORT`, `TRUST_PROXY`, `BACKUP_DIR`). Copie para `.env` com `chmod 600 .env`. |
| `nginx.conf.example` | Exemplo pronto de proxy reverso HTTPS no Nginx institucional (`client_max_body_size 35m`, `proxy_read_timeout 120s`, `X-Forwarded-Proto`). |
| `Caddyfile.ec2.example` | Publicação de `cadernocc.com.br` com Caddy no host, HTTPS automático e compressão zstd/gzip, encaminhando ao mesmo app em loopback. |
| `atualizar.sh` | Atualiza a aplicação preservando os volumes (`pgdata` e `data`), aplica migrations novas automaticamente e confere `/api/health`. |
| `backup.sh` | Gera backup atômico em `backups/<timestamp>/` contendo `database.sql.gz` + `data.tar.gz` + `SHA256SUMS` (`umask 077`, retenção padrão de 30 dias). |
| `desligar.sh` | Executa `backup.sh`, confere `sha256sum -c SHA256SUMS` e só então para os contêineres (`docker compose down`, **sem** `-v`), preservando os volumes no disco. |
| `restaurar.sh` | Restaura banco (`--single-transaction --set ON_ERROR_STOP=on`) e volume `/data` a partir de uma pasta de backup verificada por SHA-256. |

---

## 1. Subir pela primeira vez

```bash
cd /opt/enade-cs-platform/deploy/campus
cp .env.example .env
chmod 600 .env
# Gere uma senha forte (caracteres especiais são suportados via PGPASSWORD):
# openssl rand -base64 32
nano .env

# Compila a imagem localmente a partir do repositório e sobe banco + app:
docker compose up -d --build
```

Na primeira subida, o contêiner `app` executa automaticamente as migrations SQL e publica o acervo inicial (`246` questões objetivas e `39` discursivas). Acompanhe até aparecer `Listening on` e `healthy`:

```bash
docker compose logs -f app
curl -fsS http://127.0.0.1:3000/api/health
```

### Criar o primeiro administrador

1. Acesse o endereço HTTPS da plataforma e crie sua conta normalmente em **Criar conta**.
2. No servidor, conceda o papel `ADMIN` pelo comando interno:

```bash
docker compose exec app node dist/admin/admin-role.mjs grant seu.email@ifsp.edu.br
```

Outros comandos administrativos de servidor (úteis se um administrador esquecer a própria senha ou pedir exclusão de conta):

```bash
# Redefinir senha de qualquer conta (inclusive ADMIN) e encerrar sessões:
docker compose exec app node dist/admin/admin-role.mjs reset-password seu.email@ifsp.edu.br

# Remover papel ADMIN:
docker compose exec app node dist/admin/admin-role.mjs revoke seu.email@ifsp.edu.br

# Excluir conta e dados de estudo (LGPD):
docker compose exec app node dist/admin/admin-role.mjs delete-account pessoa@exemplo.br
```

---

## 2. Atualizar código em produção (`atualizar.sh`)

Quando uma nova versão for publicada no repositório:

```bash
cd /opt/enade-cs-platform
git pull --ff-only
cd deploy/campus
./atualizar.sh
```

- Por padrão, `./atualizar.sh` reconstrói a imagem localmente (`docker compose up -d --build`).
- Se o servidor preferir baixar a imagem pronta do GitHub Container Registry sem compilar localmente, use `./atualizar.sh --pull` (respeita `VERSAO` do `.env`).
- Os volumes `enade_pgdata` e `enade_data` **não são tocados**; apenas migrations novas são aplicadas.

---

## 3. Backup periódico (`backup.sh`)

```bash
cd /opt/enade-cs-platform/deploy/campus
./backup.sh
```

Para agendar todo dia às `03:30` no `crontab` do servidor:

```cron
30 3 * * * /opt/enade-cs-platform/deploy/campus/backup.sh >> /var/log/enade-backup.log 2>&1
```

> **Importante:** banco (`database.sql.gz`) e arquivos (`data.tar.gz`) formam um par indivisível — o banco referencia imagens e PDFs pelo hash SHA-256 gravado em `/data`. Copie periodicamente a pasta `backups/` (ou versão criptografada com `gpg --symmetric` / `age`) para fora da VM.

---

## 4. Desligar ao fim do ciclo sem perder nada (`desligar.sh`)

Se a plataforma ficar no ar apenas durante novembro (ou precisar ser desligada nas férias):

```bash
cd /opt/enade-cs-platform/deploy/campus
./desligar.sh
```

O script:
1. Gera um backup completo atualizado;
2. Verifica a integridade (`SHA256SUMS`);
3. Executa `docker compose down` (**nunca** use `docker compose down -v` nem `docker volume prune`, pois isso apagaria os volumes).

---

## 5. Religar depois ou migrar para outro servidor (`restaurar.sh`)

### Caso A — Mesmo servidor (volumes preservados)

```bash
cd /opt/enade-cs-platform/deploy/campus
docker compose up -d
curl -fsS http://127.0.0.1:3000/api/health
```

Tudo volta exatamente do ponto em que parou (contas, turmas, chamadas, simulados, respostas e PDFs/recortes).

### Caso B — Servidor novo da Fábrica de Software / TI (a partir do backup)

1. Copie a pasta do último backup (`backups/20261201-033000/`) e recrie o `.env` (`chmod 600 .env`) no servidor novo.
2. Construa ou baixe a imagem (`docker compose build` ou `docker compose pull`).
3. Restaure banco e `/data`:

```bash
cd /opt/enade-cs-platform/deploy/campus
./restaurar.sh ./backups/20261201-033000
```

O script confere `SHA256SUMS`, pede confirmação explícita (`RESTAURAR`, ou aceita `--sim` em automação), restaura PostgreSQL em transação única e descompacta `/data`, subindo a aplicação pronta ao final.
