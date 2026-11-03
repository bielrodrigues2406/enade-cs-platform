# Deploy e segurança operacional

Status: guia para R1. Referência: 26/10/2026. Decisão de arquitetura em [ADR-008](ADR-008-deployment.md). A escolha do provedor (D1 em [WORKBOARD.md](WORKBOARD.md)) é de Gabriel.

## 1. O que é publicado

Um único contêiner, construído pelo `Dockerfile` da raiz, roda a API e serve a aplicação web na mesma origem. Ao iniciar, aplica as migrations pendentes (transacionais, com verificação de checksum e advisory lock) e só então abre a porta. O processo roda como usuário sem privilégios (`node`, uid 1000).

O CI (`.github/workflows/ci.yml`) roda auditoria de dependências de produção, build, testes de API com PostgreSQL, E2E em Chromium e o build da imagem em cada PR e em `main`.

## 2. Configuração

| Variável | Valor | Segredo? |
| --- | --- | --- |
| `DATABASE_URL` ou `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` | Conexão ao PostgreSQL **pela rede privada** do Compose ou provedor (`deploy/campus/` usa `PGPASSWORD` discreto para aceitar qualquer caractere especial) | **Sim — o único** |
| `APP_ORIGIN` | Origem HTTPS pública exata, sem barra no final (ex.: `https://enade.pep.ifsp.edu.br`). A API não inicia em produção sem `https://` | Não |
| `TRUST_PROXY` | Quantidade de proxies reversos confiáveis à frente (`1` para o proxy institucional do câmpus; `2` se houver Cloudflare/WAF + proxy local) | Não |
| `PORT` | Porta interna do contêiner; padrão `3000` | Não |
| `SOURCE_ARCHIVE_DIR` | Padrão `/data/sources`: PDFs oficiais arquivados | Não |
| `QUESTION_ASSET_DIR` | Padrão `/data/question-assets`: recortes WebP das questões em imagem, nomeados pelo SHA-256 | Não |

Os dois caminhos ficam em `/data`: monte **um** volume persistente em `/data`, gravável pelo uid 1000 (`node`). Sem o volume, PDFs e imagens somem a cada atualização e as questões oficiais passam a responder 404 nas imagens.

`NODE_ENV=production`, `HOST=0.0.0.0` e `WEB_DIST` já vêm da imagem, que também inclui `HEALTHCHECK` automático em `/api/health`. Não há chave de IA, e-mail, pagamento ou outra integração externa em R1; não cadastre variáveis que o código não usa.

O limite de tentativas de login é mantido em memória: rode **uma instância**. Escalar horizontalmente exige um limitador compartilhado antes.

## 3. Segurança operacional

Regra adotada em qualquer infraestrutura: **assuma que variáveis de ambiente podem vazar se o host for comprometido** e reduza o raio de impacto:

1. **Um só segredo.** Apenas a senha do banco (`POSTGRES_PASSWORD` / `DATABASE_URL`) é sensível.
2. **Banco sem porta externa.** Em `deploy/campus/docker-compose.yml`, o PostgreSQL fica exclusivamente na rede interna `internal` do Docker, sem `ports:` publicados no host.
3. **Aplicação restrita ao proxy reverso.** Por padrão, o contêiner `app` escuta somente em `127.0.0.1:3000` (`APP_BIND=127.0.0.1`), recebendo tráfego apenas do proxy reverso HTTPS institucional.
4. **Senhas e sessões protegidas no banco.** Senhas usam `scrypt` com salt aleatório; sessões guardam apenas o SHA-256 do token. Em caso de incidente, encerre todas as sessões (`DELETE FROM browser_session`).
5. **Backups atômicos fora do servidor.** Todo backup precisa conter **banco (`database.sql.gz`) + `/data` (`data.tar.gz`) + `SHA256SUMS`**. Guarde cópia externa cifrada em armazenamento institucional separado da VM.
6. **Cabeçalhos e cookies.** A aplicação envia CSP estrita, HSTS em produção, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`; o cookie de sessão usa `HttpOnly`, `Secure` e `SameSite=Strict`, restrito a `/api`.

## 4. Proteção contra força bruta e excesso de requisições

O que a aplicação aplica sozinha (uma instância, contadores em memória):

| Ameaça | Proteção | Onde |
| --- | --- | --- |
| Adivinhar senha | 50 tentativas por IP e 10 por e-mail a cada 15 min, antes do scrypt; o scrypt (~128 MiB) roda no máximo 2 por vez | `AuthThrottle`, `password.ts` |
| Criar sessões de visitante em massa | 600 por IP a cada 15 min | `GuestThrottle` |
| Cliente disparando requisições | 1200 por minuto por IP na API em produção (`API_RATE_LIMIT` ajusta) | `request-limit.ts` |
| Conexões lentas (slowloris) | cabeçalhos em 20 s, requisição inteira em 2 min | `serve.ts` |
| Corpos grandes | JSON até 16 kB (64 kB na curadoria); PDFs só para administradores (até 10 MB por arquivo) | `main.ts`, `exam-imports.ts` |

**Atenção à rede do câmpus (`TRUST_PROXY`):** se os computadores dos laboratórios do câmpus saírem pelo mesmo NAT institucional, configure `TRUST_PROXY` exatamente para o número de proxies reversos antes do contêiner (`1` quando há só o Nginx/Apache do servidor). Não use `TRUST_PROXY` maior que a cadeia real (permitiria forjar `X-Forwarded-For`), nem `0` atrás de proxy (faria todos os acessos parecerem `127.0.0.1`).

## 5. Servidor do câmpus IFSP — guia para a equipe de TI (`deploy/campus/`)

Caminho principal escolhido para publicação institucional. Não depende de Caddy externo nem de redes de outros projetos.

### 5.1 Subir pela primeira vez

Requisitos no servidor Linux do câmpus:
- Docker Engine + plugin `docker compose` v2;
- Proxy reverso institucional com HTTPS válido apontando para `http://127.0.0.1:3000` (há um modelo pronto de Nginx em `deploy/campus/nginx.conf.example` — **importante:** configure `client_max_body_size 35m;` e `proxy_read_timeout 120s;` para permitir importação administrativa de PDFs do Inep);
- Saída HTTPS liberada no primeiro boot para baixar as provas oficiais do Inep durante a carga inicial (ou `BOOTSTRAP_CONTENT=0` se a rede for isolada e o acervo entrar por restauração).

Passo a passo para o operador do servidor:

```bash
# 1. Clonar o repositório em pasta de serviço
git clone https://github.com/bielrodrigues2406/enade-cs-platform.git /srv/enade-cs-platform
cd /srv/enade-cs-platform/deploy/campus

# 2. Criar o .env restrito ao operador
cp .env.example .env
chmod 600 .env
# Edite .env:
#   POSTGRES_PASSWORD=<saida de: openssl rand -hex 24>
#   APP_ORIGIN=https://enade.pep.ifsp.edu.br   (sem barra no final)
#   TRUST_PROXY=1

# 3. Construir a imagem localmente e subir banco + aplicação
./atualizar.sh
# (Alternativa: se preferir baixar a imagem pronta do GHCR sem compilar na VM, use ./atualizar.sh --pull)

# 4. Acompanhar migrations, carga das 246 questões oficiais e healthcheck
docker compose logs -f app
docker compose ps   # aguarde ambos os serviços ficarem (healthy)
```

Conferência imediata após subir:
1. `curl -fsS http://127.0.0.1:3000/api/health` e `https://<dominio-do-campus>/api/health` devem responder `{"status":"ok"}`.
2. Abra o site pelo navegador, crie a conta que será administradora e conceda o papel no servidor:
   ```bash
   cd /srv/enade-cs-platform/deploy/campus
   docker compose exec app node dist/admin/admin-role.mjs grant responsavel@ifsp.edu.br
   ```
   Para recuperar a senha de um administrador caso necessário no futuro:
   ```bash
   docker compose exec app node dist/admin/admin-role.mjs reset-password responsavel@ifsp.edu.br
   ```
3. Agende o backup diário no `crontab` (mantém 30 dias em `/var/backups/enade`, com `umask 077`):
   ```cron
   0 3 * * * /srv/enade-cs-platform/deploy/campus/backup.sh /var/backups/enade >> /var/backups/enade/backup.log 2>&1
   ```
   Copie periodicamente os diretórios gerados em `/var/backups/enade/` para armazenamento externo à VM.

Para atualizar o código depois de novos commits na `main`:
```bash
cd /srv/enade-cs-platform && git pull --ff-only
cd deploy/campus && ./atualizar.sh
```

### 5.2 Como desligar ao fim de novembro e religar depois sem perder nada

Como o uso intensivo ocorre no período do ENADE (ex.: mês de novembro), a plataforma pode ficar desligada nos meses seguintes sem consumir memória ou CPU do servidor e voltar idêntica depois:

#### Passo A — Desligar com segurança (fim do ciclo)

1. Execute o script de hibernação (com os contêineres ainda ligados):
   ```bash
   cd /srv/enade-cs-platform/deploy/campus
   ./desligar.sh /var/backups/enade
   ```
   O script faz automaticamente três coisas em ordem:
   - gera um backup completo (`database.sql.gz` + `data.tar.gz` + `SHA256SUMS`);
   - confere os hashes SHA-256 dos dois arquivos gerados;
   - executa `docker compose down` (**sem `-v`**), desligando os contêineres mas **preservando os volumes `enade_pgdata` e `enade_data` no disco**.
2. **Guarde cópia externa** da pasta recém-criada em `/var/backups/enade/enade-AAAA-MM-DD-...` e guarde separadamente os valores do `deploy/campus/.env` (em cofre de senhas institucional). Assim, mesmo que a VM seja formatada ou substituída até o próximo ano, nada se perde.
3. Comente a linha do `backup.sh` no `crontab` (para não gerar erro de contêiner parado toda madrugada) e, no Nginx/Apache do câmpus, desative o virtual host ou exiba uma página estática informando que o período de preparação encerrou.
4. **O que NUNCA executar se quiser manter os dados locais:** `docker compose down -v` ou `docker volume prune` (esses comandos apagam os volumes locais).

#### Passo B — Religar depois (mesmo servidor ou servidor novo)

- **Cenário 1 — Mesmo servidor, com os volumes Docker ainda presentes (`docker volume ls | grep enade`):**
  ```bash
  cd /srv/enade-cs-platform/deploy/campus
  ./atualizar.sh
  ```
  O PostgreSQL e o volume `/data` já estão lá: todas as contas, respostas, simulados, discursivas, turmas, questões e imagens voltam imediatamente. Reative o virtual host no proxy reverso e a linha do `crontab`.

- **Cenário 2 — Servidor novo, VM reformatada ou passagem à Fábrica de Software:**
  ```bash
  git clone https://github.com/bielrodrigues2406/enade-cs-platform.git /srv/enade-cs-platform
  cd /srv/enade-cs-platform/deploy/campus
  cp .env.example .env && chmod 600 .env   # preencha POSTGRES_PASSWORD e APP_ORIGIN
  docker compose build app                 # ou docker compose pull se usar GHCR
  ./restaurar.sh /caminho/do/backup/enade-AAAA-MM-DD-HHMMSS-XXXXXX
  ```
  O `restaurar.sh` confere `SHA256SUMS`, sobe o banco limpo, restaura o SQL em transação única (`ON_ERROR_STOP=on`), extrai todos os PDFs e recortes em `/data` e sobe a aplicação. Ao terminar, confira `/api/health`, login, uma questão com imagem e uma discursiva.

## 6. Caminhos alternativos preservados no repositório

- **Render (`render.yaml` na raiz):** PaaS gerenciado com disco persistente em `/data` e PostgreSQL privado, útil caso não haja servidor institucional disponível.
- **VPS com Caddy (`deploy/vps/`):** configuração específica para VPS compartilhada com rede externa `proxy` do Caddy; ignorar na implantação do câmpus (use sempre `deploy/campus/`).

## 7. Reverter atualização de código

Migrations só avançam e são aditivas. Para voltar à versão anterior da aplicação em `deploy/campus/`: faça checkout do commit anterior validado (ou defina `VERSAO=<sha7>` no `.env` com `./atualizar.sh --pull`). Se for necessário reverter alteração destrutiva de dados, utilize `./restaurar.sh` apontando para o backup anterior ao incidente.
