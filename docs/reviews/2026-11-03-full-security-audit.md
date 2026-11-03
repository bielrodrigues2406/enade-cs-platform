# Auditoria completa de segurança e privacidade (03/11/2026)

Escopo: revisão integral linha a linha da aplicação antes da publicação no servidor do câmpus IFSP (`ADM-2`, `DEP-4`, `SEC-AUDIT`), cobrindo:
- **Backend / API** (`apps/api/src/*.ts` — 42 arquivos);
- **Frontend Angular 22** (`apps/web/src/*.{ts,html,css}` — 64 arquivos);
- **Banco de dados PostgreSQL 17** (`migrations/001` a `029`);
- **Scripts de administração, extração e conteúdo** (`scripts/**`);
- **Infraestrutura Docker, ciclo de vida e CI/CD** (`Dockerfile`, `deploy/campus/*`, `deploy/vps/*`, `.github/workflows/*`).

Complementa a [revisão preliminar de privilégios e manutenção (`SEC-UI1`, PR #43)](2026-11-03-security-privileges.md).

---

## 1. Resumo executivo

| Severidade | Encontrados | Corrigidos no código | Mitigados / operacionais |
| --- | --- | --- | --- |
| **P0 — Crítica** | **0** | — | — |
| **P1 — Alta** | **5** (`SEC-01`..`SEC-05`) | **5** | — |
| **P2 — Média** | **5** (`SEC-06`..`SEC-10`) | **4** (`SEC-06`, `SEC-07`, `SEC-08`, `SEC-10` parcial) | **1** (`SEC-09` isolado em `deploy/campus/`; checklist de banco em `SEC-10`) |
| **P3 — Baixa / Hardening** | **5** (`SEC-11`..`SEC-15`) | **5** | — |

Não foram encontradas vulnerabilidades críticas (`P0`), injeção SQL, execução remota de comandos (`execFile`/`spawn` usam arrays de argumentos fixos sem shell), XSS em templates Angular ou vazamento de gabarito de objetivas antes do envio. Todos os cinco achados de alta severidade (`P1`) — incluindo bloqueio em cascata sob NAT compartilhado do câmpus, *cookie tossing* entre subdomínios `*.ifsp.edu.br`, enumeração de prontuário, exaustão de memória na importação de PDFs e exclusão LGPD de conta/estudo — foram corrigidos e cobertos por testes automatizados nesta entrega.

---

## 2. Controles já verificados na base

1. **Consultas SQL parametrizadas em 100% da API e scripts** (`$1, $2, ...`), sem interpolação de entrada do usuário.
2. **Senhas com `scrypt` (`N=131072, r=8, p=1`, 128 MiB por derivação)**, sal aleatório de 16 bytes, comparação em tempo constante (`timingSafeEqual`) e validação de formato por `CHECK` no PostgreSQL (`migrations/002_accounts.sql:23`).
3. **Tokens de sessão opacos de 256 bits** (`randomBytes(32)`), persistidos apenas como SHA-256 em `browser_session.token_hash` (`apps/api/src/session.ts:80-84`).
4. **Primeiro administrador exclusivamente via CLI no servidor** (`admin:role grant`), sem elevação automática por e-mail em cadastro público (`apps/api/src/roles.ts`).
5. **Autorização antes de alocação em uploads**: `ImportAdminGuard` (`apps/api/src/exam-imports.ts:116`) valida `ADMIN` antes do `Multer` ler o corpo `multipart/form-data`; imagens editoriais validam assinatura mágica real via `identify` e recodificam para WebP (`apps/api/src/question-images.ts`).
6. **Cabeçalhos HTTP de defesa em profundidade** (`apps/api/src/serve.ts`): `Content-Security-Policy` estrito (`default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`), `HSTS` em HTTPS, `X-Content-Type-Options: nosniff` e `Referrer-Policy: strict-origin-when-cross-origin`.
7. **Ausência de `innerHTML` inseguro ou `bypassSecurityTrust*`** em toda a SPA Angular; tokens de sessão nunca ficam em `localStorage`/`sessionStorage` (`HttpOnly`).

---

## 3. Achados detalhados e correções aplicadas

### P1 — Alta severidade

#### `SEC-01` · Bloqueio coletivo (DoS) sob NAT compartilhado do câmpus e fila zero no `scrypt`
- **Onde:** `apps/api/src/auth.ts`, `apps/api/src/password.ts`, `apps/api/src/request-limit.ts`, `apps/api/src/session.ts`.
- **Risco:** no câmpus IFSP, dezenas de computadores de laboratório saem pelo mesmo IPv4 público (NAT). O limitador de autenticação somava tentativas válidas e inválidas no mesmo teto de `50/15 min` por IP sem reembolso após acerto, derrubando uma turma inteira no login. Além disso, mapas de rate limit em `10.000` entradas respondiam `503` global (ou limpavam todas as janelas com `windows.clear()`), endereços IPv6 rotacionavam sufixos de privacidade fora do `/64` e o semáforo `scrypt` rejeitava imediatamente a 3ª derivação concorrente com `503`.
- **Correção aplicada:**
  - Adicionado `AuthThrottle.refund(req, email)` após senha válida e teto por IP ajustado para `150/15 min` mantendo `10/15 min` estritos por conta/e-mail (`apps/api/src/auth.ts`, `account-profile.ts`, `admin-accounts.ts`);
  - Substituído bloqueio global/`clear()` por despejo FIFO $O(1)$ da entrada mais antiga nos mapas de limite (`auth.ts`, `request-limit.ts`);
  - Normalização de IPv4 mapeado (`::ffff:`) e agrupamento por prefixo `/64` em IPv6 (`normalizeIpForLimit` em `session.ts`);
  - Fila FIFO limitada (`MAX_CONCURRENT = 2`, `MAX_QUEUED = 16`, timeout de `5 s`) em `password.ts`.

#### `SEC-02` · *Cookie tossing* entre subdomínios irmãos (`*.ifsp.edu.br`) e validação `Sec-Fetch-Site`
- **Onde:** `apps/api/src/session.ts`, `apps/api/src/main.ts`.
- **Risco:** como a aplicação rodará sob um subdomínio institucional (ex.: `enade.pep.ifsp.edu.br`), outro serviço comprometido em subdomínio irmão poderia gravar `Domain=.pep.ifsp.edu.br; Path=/api` com nome `enade_session`. O leitor anterior pegava a primeira ocorrência com `.find()`, permitindo fixação de sessão de visitante ou negação de autenticação. Requisições sem cabeçalho `Origin` dependiam apenas de tipo de conteúdo.
- **Correção aplicada:**
  - Em produção (`NODE_ENV=production`), o cookie passa a usar prefixo **`__Host-enade_session`** (`Path=/; Secure; HttpOnly; SameSite=Strict`), que obriga navegadores a recusar qualquer cookie com atributo `Domain` vindo de subdomínios irmãos;
  - Se a requisição trouxer mais de um cookie de sessão válido (`matches.length !== 1`), o servidor recusa ambos (`401`);
  - `main.ts` passa a bloquear mutações com `Sec-Fetch-Site: cross-site` ou `Sec-Fetch-Site: same-site` (subdomínio irmão) mesmo quando `Origin` vier omitido.

#### `SEC-03` · Enumeração de prontuário (`enrollment`) expondo presença de colegas e contaminando painel da turma
- **Onde:** `apps/api/src/account-profile.ts`, `apps/api/src/lessons.ts`, `apps/api/src/class-dashboard.ts`, `apps/web/src/profile.component.{ts,html}`.
- **Risco:** prontuários seguem formato sequencial (`PE301xxxx`). Qualquer conta podia trocar livremente o próprio `enrollment` em `PUT /api/me/profile` sem reautenticar e consultar `GET /api/my/lessons` para ler faltas/presenças daquele prontuário, além de vincular seu próprio histórico de questões ao agregado da turma caso o docente tivesse importado a lista.
- **Correção aplicada:**
  - Alterar ou limpar um prontuário já salvo em `PUT /api/me/profile` agora exige `currentPassword` (com `AuthThrottle` e auditoria); omitir `enrollment` preserva o valor atual;
  - `lessons.ts` (`classDetail` e `myLessons`) e `class-dashboard.ts` exigem `(m.email IS NULL OR lower(m.email) = lower(a.email))` ao cruzar `class_member` com `account`, impedindo que uma conta com e-mail divergente assuma prontuário listado com e-mail institucional.

#### `SEC-04` · Contenção de memória e disco na importação de PDFs (`IMP-1`)
- **Onde:** `apps/api/src/exam-imports.ts`, `scripts/import-exam.mjs`, `deploy/campus/docker-compose.yml`.
- **Risco:** disparo concorrente de múltiplos processos `import-exam.mjs` sem teto de heap, páginas PDF com dimensões arbitrárias no `pdftoppm` e acúmulo indefinido de PNGs em `/tmp/enade-import-pages`.
- **Correção aplicada:**
  - Bloqueio de upload concorrente enquanto houver lote `PROCESSING` recente (`409` em `exam-imports.ts`);
  - Heap do worker limitado com `--max-old-space-size=384`;
  - Validação de `1..120` páginas e dimensões máximas `2000 × 2500 pt` em `scripts/import-exam.mjs`, além de `-scale-to 2000` e timeout de `30 s` no `pdftoppm`;
  - Limpeza automática de PNGs com mais de 1 hora em `/tmp/enade-import-pages` e montagem `tmpfs` (`128m,noexec,nosuid,nodev`) + `pids_limit: 128` em `deploy/campus/docker-compose.yml`.

#### `SEC-05` · Cumprimento da exclusão de conta e dados de estudo (LGPD)
- **Onde:** `apps/api/src/admin-accounts.ts`, `scripts/admin-role.ts`, `apps/web/src/admin.component.{ts,html}`, `apps/api/src/roles.ts`.
- **Risco:** os avisos de privacidade em `account.component.html` e `profile.component.html` orientam o titular a pedir exclusão da conta e dos dados de estudo à administração, mas não havia rota administrativa nem comando de servidor que removesse os dados respeitando as chaves estrangeiras de auditoria/autoria.
- **Correção aplicada:**
  - Implementado `eraseAccountData` exposto em `POST /api/admin/accounts/:id/delete` (exigindo `adminPassword` + confirmação `EXCLUIR` no modal `Gerenciar`) e no CLI `admin:role delete-account <e-mail>`;
  - Contas de estudantes sem autoria institucional têm `browser_session`, `answer`, `account` e `study_identity` removidos fisicamente (em cascata sobre `practice_attempt`, `answer_event`, `discursive_response`, `study_goal`, `achievement_unlock`, `flashcard_*` e `answer_reflection`), higienizando o e-mail em `activity_log` e `role_event`;
  - Contas docentes/editoriais com vínculos institucionais (`lesson`, `editorial_event`, etc.) têm todos os dados pessoais e de estudo apagados e o registro `account` irreversivelmente anonimizado (`excluida-...@anon.invalid`), oculto da listagem ativa.

---

### P2 — Média severidade

- **`SEC-06` · Vazamento antecipado de `standardUrl` em discursivas avulsas (`apps/api/src/discursive.ts`):** `GET /api/discursive/:id` expunha a URL oficial do padrão de resposta antes do envio da resposta escrita. **Corrigido:** `standardUrl` agora retorna `null` até o envio (`submitted_at IS NOT NULL`) e passa a ser entregue na resposta de `POST /api/discursive/:id/submit`.
- **`SEC-07` · `POST /api/auth/logout` sem limite para anônimos e limpeza de `browser_session` expiradas (`apps/api/src/auth.ts`, `apps/api/src/activity.ts`):** **Corrigido:** `logout` aplica `GuestThrottle` quando não há sessão válida e evita consulta desnecessária ao banco; a rotina diária de retenção em `activity.ts` agora também remove `browser_session WHERE expires_at <= now()`.
- **`SEC-08` · Corridas `23505` e atomicidade em perfil, senha e importação de chamada (`account-profile.ts`, `admin-accounts.ts`, `lessons.ts`):** **Corrigido:** `updateProfile`, `changePassword` e `importMembers` rodam em transação (`BEGIN`/`COMMIT`/`ROLLBACK`), validam existência da turma (`404`), limitam a chamada a `300` linhas por envio e convertem `23505` em `409`.
- **`SEC-09` · Confiança em `X-Forwarded-For` em rede Docker compartilhada:** em `deploy/vps/` (cenário antigo de VPS dividida), qualquer contêiner na rede externa `proxy` alcançaria a porta interna `3000`. **Mitigado para o câmpus:** `deploy/campus/docker-compose.yml` usa exclusivamente uma rede bridge interna isolada (`internal`) e publica `127.0.0.1:3000` apenas no loopback do host para o proxy reverso institucional.
- **`SEC-10` · Ações de CI/CD sem hash imutável e privilégio DDL em tempo de execução:**
  - **Corrigido no CI:** `docker/setup-buildx-action`, `docker/login-action` e `docker/build-push-action` em `.github/workflows/publicar.yml` foram fixados por commit SHA completo;
  - **Nota arquitetural para próximas equipes (Fábrica de Software):** hoje o contêiner `app` executa `migrate.mjs` na subida com o mesmo usuário PostgreSQL (`enade`). Como não há interpolação SQL e o banco fica isolado na rede interna, o risco imediato é baixo; em evolução futura, pode-se separar `enade_migrator` (DDL na subida) de `enade_app` (apenas DML).

---

### P3 — Baixa severidade / Hardening

- **`SEC-11` · Limites de processos e `/tmp` não executável no contêiner:** **Corrigido** em `deploy/campus/docker-compose.yml` (`pids_limit: 128` em `db` e `app`, `tmpfs: /tmp:size=128m,mode=1777,noexec,nosuid,nodev`).
- **`SEC-12` · Autorrevisão intermediária com 3 curadores (`curation.ts`, `sources.ts`):** se A criasse, B editasse e C editasse depois, B deixava de ser `lastEditor` e podia revisar/publicar versão que ele mesmo editou. **Corrigido:** `curation.ts` e `sources.ts` agora consultam `editorial_event` e `source_event` para impedir revisão por qualquer pessoa que tenha criado ou editado aquela versão/fonte anteriormente.
- **`SEC-13` · Injeção de fórmula em CSV de presença (`lessons.ts`):** nomes começando com `=`, `+`, `-`, `@`, `\t` ou `\r` eram exportados crus para Excel/LibreOffice. **Corrigido:** `exportCsv` prefixa `'` e coloca entre aspas células com `;`, `,`, `"`, `\r` ou `\n`.
- **`SEC-14` · `Clear-Site-Data` no logout em computadores de laboratório e `noreferrer` em links externos:** **Corrigido:** `POST /api/auth/logout` envia `Clear-Site-Data: "cache"` em produção e `discursive.component.html` usa `rel="noopener noreferrer"`.
- **`SEC-15` · Higiene de `.env.*` no Git e criptografia de backups externos:** **Corrigido:** `.gitignore` agora bloqueia `.env.*` (preservando `.env.example` e `deploy/**/.env.example`), e `deploy/campus/README.md` orienta permissões `0600` e criptografia ao copiar backups para fora do servidor.

---

## 4. Checklist rápido para quem for subir no servidor do câmpus IFSP

1. Copiar `deploy/campus/.env.example` para `deploy/campus/.env`, aplicar `chmod 600 .env` e preencher `POSTGRES_PASSWORD` forte (`openssl rand -base64 32`) e `APP_ORIGIN=https://<subdominio-oficial-do-campus>`.
2. Manter `APP_BIND=127.0.0.1` para que a porta `3000` nunca fique aberta diretamente na rede do câmpus — todo acesso externo deve passar pelo proxy reverso HTTPS institucional (`deploy/campus/nginx.conf.example`), repassando `Host`, `X-Forwarded-Proto https` e `X-Forwarded-For`.
3. Subir com `docker compose up -d --build` em `deploy/campus/`, criar a própria conta pela web e conceder o primeiro `ADMIN` via `docker compose exec app node dist/admin/admin-role.mjs grant <email>`.
4. Agendar `/opt/enade-cs-platform/deploy/campus/backup.sh` no `cron` diário e, ao encerrar o período de uso em novembro, desligar com `./desligar.sh` (nunca `docker compose down -v`).
