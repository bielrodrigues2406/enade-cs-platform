# Auditoria de segurança — 31/10/2026

Pedido de Gabriel, com o método da skill [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) em modo de revisão focada. A skill prevê vários agentes isolados; por decisão de Gabriel ("não use mais agentes"), uma só instância fez reconhecimento, caça e validação. Por isso a verificação **não é independente**, como a skill recomenda. Cobertura: rotas da API (`apps/api/src`), migrations, Dockerfile e `render.yaml`. Uma rodada não esgota o alvo.

Regras aplicadas:
- Só conta como achado o que cruza uma fronteira de confiança e tem efeito observável.
- Cada candidato foi provado com teste local, com contas e dados fictícios (`TEST ONLY`), contra o PostgreSQL de teste.
- Nada foi testado em ambiente publicado.

## Fronteiras de confiança

| Principal | Como obtém | Alcance |
| --- | --- | --- |
| Visitante | `POST /api/session` (cookie `HttpOnly`, `Secure`, `SameSite=Strict`, path `/api`) | Estudo, treino, prova e discursivas da própria identidade |
| Conta | Cadastro com e-mail **não confirmado** + senha (scrypt) | O mesmo, persistido; prontuário opcional liga à lista da turma |
| Professor | Papel concedido pelo admin (convite por e-mail) | **Todas** as turmas: lista, presença e desempenho |
| Administrador | Papel (comando no servidor ou `ADMIN_EMAILS` para o primeiro) | Contas, papéis, importação de provas |
| Curadoria | Papel próprio | Rascunhos e publicação |

## Confirmados

### C1 — Convite de papel vale para quem cadastrar o e-mail primeiro (Médio) — corrigido

- **Fronteira:** um visitante sem papel passa a professor.
- **Caminho:**
  - `POST /api/admin/roles` com e-mail sem conta grava `role_invitation`;
  - `POST /api/auth/register` chama `applyInvitations`, que concede o papel a quem cadastrar esse e-mail;
  - o e-mail não é confirmado.
- **Efeito:** com o papel de professor, a pessoa vê nomes, prontuários, presença e desempenho de todas as turmas (`GET /api/classes`, `/classes/:id`, `/classes/:id/dashboard`).
- **Prova local:** admin convida `prof-…@example.invalid`; outra pessoa cadastra esse endereço e recebe `["PROFESSOR"]`; `GET /api/classes` responde 200.
- **Pré-condição:** saber um e-mail convidado ainda sem conta e cadastrá-lo antes da pessoa. O e-mail institucional costuma ser previsível.
- **Mesmo mecanismo:** `ADMIN_EMAILS`. Foi reduzido nesta rodada: só cria o **primeiro** administrador e é ignorado quando já existe um (`grantConfiguredAdmin`, teste em `tests/roles.test.ts`).
- **Correção (aprovada por Gabriel, muda o D14; migration 023):** o cadastro com e-mail convidado só reivindica o convite (`CLAIMED` no histórico). A tela de administração mostra nome e prontuário em "Cadastros aguardando sua confirmação", e o papel vale quando o admin confirma. A correção completa continua sendo confirmar o e-mail, o que exige um serviço de envio.

### C2 — Prontuário declarado no cadastro sem conferência (Baixo) — aceito

- **Fronteira:** uma conta passa a ser associada à matrícula de outro aluno.
- **Caminho:**
  - `POST /api/auth/register` aceita qualquer `enrollment` no formato válido e único;
  - `GET /api/my/lessons` e o painel ligam a conta ao `class_member` pelo prontuário.
- **Efeito:**
  - a conta vê as aulas e a presença (P/A/F/J) do dono do prontuário;
  - o painel do professor atribui a ela o desempenho;
  - o aluno verdadeiro recebe 409 ao usar o próprio prontuário.
- **Prova local:** professor lança falta para `PE…`; outra conta se cadastra com esse prontuário e vê `status: "ABSENT"`; o cadastro com o mesmo prontuário responde 409.
- **Decisão de Gabriel:** manter como está. O risco fica registrado: se um aluno reclamar que o prontuário dá "já cadastrado", o administrador confere a conta na tela de contas.

### C3 — Criação de sessões de visitante sem limite (Baixo) — corrigido

- **Fronteira:** um cliente anônimo consome armazenamento compartilhado.
- **Caminho:** `POST /api/session` sem cookie cria `study_identity` e `browser_session` a cada chamada, sem limite por IP.
- **Prova local:** 60 chamadas paralelas geraram 60 identidades.
- **Efeito:** o banco cresce (o do Render tem 1 GB) com esforço contínuo e ganho pequeno.
- **Correção:** limite de 600 sessões novas por IP a cada 15 minutos (`GuestThrottle`), generoso para um laboratório inteiro atrás de um IP. Fica pendente a limpeza periódica de visitantes sem resposta e com sessão vencida.

## A validar (sem gravidade)

- **Disco do Render e uid 1000:** se o volume for montado como root, a gravação em `/data` falha. Só se confere no primeiro deploy (DEPLOY §5.1).
- **Memória no plano starter (512 MB):** o scrypt usa ~128 MiB por cálculo e está limitado a 2 simultâneos; a importação ainda chama `pdftoppm` e `convert` no mesmo contêiner. Pode faltar memória numa importação feita durante um pico de logins. Conferir o consumo nas métricas do Render.
- **`TRUST_PROXY=1` no Render:** o limite de login por IP depende de o proxy do Render substituir `X-Forwarded-For`. Comportamento da plataforma, fora do repositório.

## Descartados

- **Injeção de SQL:** toda entrada vai como parâmetro. Os trechos montados por concatenação (`ATTEMPT_FIELDS`, `ELIGIBLE`, `FIRST_ATTEMPTS`, `CATALOG_ORDER`, `DEADLINE_GRACE`) são constantes do código.
- **XSS:** nenhum `innerHTML` ou `bypassSecurityTrust` no web; o Angular escapa a interpolação; a CSP não permite script inline.
- **CSRF:** o cookie de sessão é `SameSite=Strict` e restrito a `/api`. Pedidos de outro site não levam a credencial, inclusive o upload multipart.
- **Acesso a tentativa de outra pessoa (treino, prova, discursiva):** toda leitura e gravação filtra por `owner_id` da sessão (`owned()`, `discursive_response` PK).
- **Padrão de resposta antes do envio:** a rota de imagens só entrega o recorte `STANDARD` a quem já enviou. Enviar qualquer texto libera o padrão, o que é o próprio desenho: o padrão é público no Inep e só a pessoa se prejudica.
- **Pausa sem limite e consulta ao banco durante a prova:** só afetam o próprio treino.
- **Fórmulas no CSV de presença:** os nomes vêm da lista colada pelo próprio professor (mesmo principal).
- **Importação de PDF (poppler, ImageMagick):** só administradores enviam arquivos. O caminho é derivado do SHA-256, e o ImageMagick só converte o PNG gerado pelo `pdftoppm`.
- **`bootstrap-content`:**
  - o download aceita só os hosts validados;
  - o SHA-256 tem de ser o do catálogo;
  - roda sem entrada externa além do repositório.
- **Login por força bruta:** limite por IP (50) e por e-mail (10) a cada 15 min antes do scrypt, que também tem limite de concorrência.

## Observação de desenho (não é vulnerabilidade)

Qualquer professor vê todas as turmas e todos os alunos. Gabriel confirmou em 31/10 que deve ser assim.
