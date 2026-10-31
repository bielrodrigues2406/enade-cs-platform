# Deploy e segurança operacional

Status: guia para R1. Referência: 26/10/2026. Decisão de arquitetura em [ADR-008](ADR-008-deployment.md). A escolha do provedor (D1 em [WORKBOARD.md](WORKBOARD.md)) é de Gabriel.

## 1. O que é publicado

Um único contêiner, construído pelo `Dockerfile` da raiz, roda a API e serve a aplicação web na mesma origem. Ao iniciar, aplica as migrations pendentes (transacionais, com verificação de checksum e advisory lock) e só então abre a porta. O processo roda como usuário sem privilégios (`node`, uid 1000).

O CI (`.github/workflows/ci.yml`) roda auditoria de dependências de produção, build, testes de API com PostgreSQL, E2E em Chromium e o build da imagem em cada PR e em `main`.

## 2. Configuração

| Variável | Valor | Segredo? |
| --- | --- | --- |
| `DATABASE_URL` | URL do PostgreSQL **pela rede privada** do provedor; `?sslmode=require` se o banco exigir TLS | **Sim — o único** |
| `APP_ORIGIN` | Origem HTTPS pública, ex.: `https://caderno.exemplo.com.br`. A API não inicia em produção sem uma origem `https://` | Não |
| `ADMIN_EMAILS` | E-mail(s) do primeiro administrador: vira administrador ao ter conta, só enquanto não existir nenhum | Não |
| `TRUST_PROXY` | `1` quando há um proxy reverso do provedor à frente (caso de Railway, Render e similares). Sem isso, o limite de tentativas de login trataria todos os acessos como um único IP | Não |
| `PORT` | Normalmente definido pelo provedor; padrão 3000 | Não |
| `SOURCE_ARCHIVE_DIR` | Padrão `/data/sources`: PDFs oficiais arquivados | Não |
| `QUESTION_ASSET_DIR` | Padrão `/data/question-assets`: recortes WebP das questões em imagem, nomeados pelo SHA-256 | Não |

Os dois caminhos ficam em `/data`: monte **um** volume persistente em `/data`, gravável pelo uid 1000 (alguns provedores montam volumes como root e pedem uma opção para isso). Sem o volume, PDFs e imagens somem a cada deploy e as questões oficiais passam a responder 404 nas imagens.

`NODE_ENV=production`, `HOST=0.0.0.0` e `WEB_DIST` já vêm da imagem. Não há chave de IA, e-mail, pagamento ou outra integração externa em R1; não cadastre variáveis que o código não usa.

O limite de tentativas de login é mantido em memória: rode **uma instância**. Escalar horizontalmente exige um limitador compartilhado antes.

## 3. Segurança: o que aprendemos com o incidente do Railway

Em 21/10/2026 o Railway detectou acesso indevido aos sistemas que guardam variáveis de ambiente de clientes; segundo o relatório preliminar, parte delas pode ter sido decifrada. Deploys foram pausados e clientes orientados a rotacionar segredos. O relatório final ainda não havia sido publicado em 26/10/2026. Fontes: [GitGuardian](https://blog.gitguardian.com/railway-october-2026-incident-environment-variables/), [Brandefense](https://brandefense.io/knowledge-hub/incidents/railway-security-incident-2026/), [guia de rotação](https://aicybr.com/blog/railway-october-2026-secrets-exposure-key-rotation-recovery).

Regra adotada, em qualquer provedor: **toda variável de ambiente no provedor pode vazar**. O desenho limita o estrago:

1. **Um só segredo.** Só `DATABASE_URL` é sensível. Nenhuma chave de terceiros fica no provedor em R1.
2. **Banco sem acesso público.** Desative o proxy TCP/endereço externo do PostgreSQL e use apenas a rede privada entre serviços. Assim, uma URL vazada sozinha não abre o banco pela internet.
3. **Rotação.** Rotacione a senha do banco: ao criar o ambiente, após qualquer incidente do provedor e a cada 90 dias. Procedimento: criar a nova senha no banco → atualizar `DATABASE_URL` → redeploy → conferir `/api/health` → invalidar a senha antiga.
4. **Senhas e sessões já protegidas no próprio dado.** Senhas são guardadas só como hash scrypt; sessões só como hash SHA-256 do token. Mesmo assim, se o banco for exposto, encerre todas as sessões (`DELETE FROM browser_session`) e avise os usuários.
5. **Contas com 2FA.** Ative autenticação em dois fatores no provedor e no GitHub; dê acesso ao projeto só a quem opera o deploy.
6. **Deploy só de `main`, com CI verde.** Configure o provedor para publicar apenas `main` e proteja a branch exigindo o CI.
7. **Backups fora do provedor.** Além dos snapshots do provedor, faça `pg_dump` diário cifrado e guardado em outro lugar. Ensaie a restauração antes de R1; backup sem restauração testada não conta.
8. **Cabeçalhos e cookies.** A aplicação envia CSP estrita (sem script, estilo ou fonte de terceiros e sem inline), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`; o cookie de sessão é `HttpOnly`, `Secure` e `SameSite=Strict`, restrito a `/api`. Alterações que exijam afrouxar a CSP precisam de justificativa no PR.

## 4. Escolha do provedor (D1)

O código não depende de provedor. Qualquer serviço que construa um `Dockerfile`, ofereça PostgreSQL em rede privada, volume persistente e HTTPS serve.

| Opção | A favor | Contra |
| --- | --- | --- |
| Railway | Setup mais rápido: GitHub, Postgres, volume e HTTPS no mesmo projeto | Incidente de segredos em 21/10/2026, relatório final pendente; volume limitado a 5 GB no plano Hobby |
| Render (**escolhido, D16**) | Fluxo parecido com Dockerfile, Postgres gerenciado e disco persistente; `render.yaml` na raiz | Postgres gratuito expira em 30 dias; disco só em plano pago (~US$ 14/mês no total) |

Com as regras da seção 3, o risco residual de um novo vazamento de variáveis é a URL do banco, que não funciona fora da rede privada. Recomendação: se escolher Railway, aplique a seção 3 inteira antes de cadastrar usuários reais e acompanhe o relatório final do incidente.

## 5. Passo a passo (genérico)

1. Criar projeto no provedor a partir do repositório GitHub, usando o `Dockerfile`.
2. Adicionar PostgreSQL 17 na rede privada; **desativar acesso público**.
3. Definir `DATABASE_URL` (referência interna do provedor), `APP_ORIGIN` e `TRUST_PROXY=1`.
4. Montar volume persistente em `/data` (PDFs e imagens das questões).
5. Configurar health check em `/api/health` e domínio com HTTPS.
6. Publicar. As migrations rodam no início; conferir o log `Migration aplicada: …` e `/api/health`.
7. Opcional: conteúdo autoral demonstrativo com `node dist/admin/seed.mjs` no shell do serviço.
8. Curadoria: após a pessoa criar a conta pelo site e a identidade ser conferida, `node dist/admin/curator-role.mjs grant <identity-uuid>` no shell do serviço.

Questões oficiais conferidas por agentes (ADR-011) entram sozinhas: ao iniciar, o contêiner roda `node dist/admin/bootstrap-content.mjs` (DEP-2), que baixa e confere as fontes de cada conferência commitada e publica. Para rodar à mão, use o Shell do serviço. Não importe fontes no banco de produção a partir de máquinas pessoais; isso exigiria abrir o banco publicamente. Provas novas entram pela tela de importação (IMP-1).

## 5.1 Render (D16): passo a passo

O `render.yaml` da raiz descreve tudo: serviço web pelo `Dockerfile`, disco de 1 GB em `/data`, PostgreSQL 17 sem acesso externo e publicação só depois do CI verde em `main`. Custo de referência em 31/10/2026: ~US$ 14/mês (web starter + banco basic-256mb + disco); confira em render.com/pricing.

1. **Conta:** crie a conta no Render com 2FA e conecte o GitHub dando acesso só a este repositório.
2. **Blueprint:** New → Blueprint → escolha o repositório. O Render lê o `render.yaml` e mostra serviço, banco e disco. Ele pede `APP_ORIGIN`: use o endereço que aparece para o serviço (`https://enade-cs.onrender.com`, ou o domínio próprio se já tiver), e `ADMIN_EMAILS`: o seu e-mail. Confirme.
3. **Primeiro deploy:** o contêiner aplica as migrations e carrega o conteúdo (`bootstrap-content`): baixa do Inep a prova e o gabarito de cada conferência em `data/agent-reviews/`, confere o SHA-256 do catálogo (se o Inep falhar, usa a cópia catalogada) e publica as questões. No log aparecem `importado` e `N publicadas`. Nas inicializações seguintes, o mesmo passo só confirma (`já importado`, `sem mudança`). Conferências novas commitadas são publicadas no próximo deploy.
4. **Conferir:** abra `/api/health` e o site; o banco de questões deve mostrar 119 oficiais (2008, 2014, 2017 e 2021).
5. **Administrador:** crie sua conta pelo site **logo após o primeiro deploy**, com o e-mail de `ADMIN_EMAILS`; ela já nasce administradora (a concessão fica no histórico de papéis). A variável só cria o **primeiro** administrador: depois que existe um, ela é ignorada, e os demais são autorizados pela tela de administração. Como o e-mail ainda não é confirmado, cadastre-se antes de divulgar o endereço do site; se o cadastro disser que o e-mail já existe, alguém chegou antes: não divulgue o site e revogue pelo Shell (`node dist/admin/admin-role.mjs revoke <email>`). Alternativa sem a variável: `node dist/admin/admin-role.mjs grant seu@email` no Shell do serviço. Professores são autorizados depois pela tela de administração.
6. **Proteger `main`:** no GitHub, exija o CI verde para merge em `main`; o Render só publica depois dos checks.

Se o log mostrar `EACCES` em `/data`, o disco foi montado sem permissão para o usuário `node` (uid 1000). Abra um chamado no Render ou, como contorno, remova a linha `USER node` do Dockerfile apenas para o primeiro deploy e registre a decisão no PR.

`BOOTSTRAP_CONTENT=0` desliga a carga automática (por exemplo, para subir mais rápido quando o Inep estiver fora do ar).

## 5.2 Força bruta e negação de serviço

O que a aplicação faz sozinha (uma instância, contadores em memória):

| Ameaça | Proteção | Onde |
| --- | --- | --- |
| Adivinhar senha | 50 tentativas por IP e 10 por e-mail a cada 15 min, antes do scrypt; o scrypt (~128 MiB) roda no máximo 2 por vez | `AuthThrottle`, `password.ts` |
| Criar sessões de visitante em massa | 600 por IP a cada 15 min | `GuestThrottle` |
| Um cliente disparando requisições | 1200 por minuto por IP na API em produção (`API_RATE_LIMIT` muda; fora de produção fica desligado) | `request-limit.ts` |
| Conexões lentas de propósito | cabeçalhos em 20 s, requisição inteira em 2 min | `serve.ts` |
| Corpos grandes | JSON até 16 kB (64 kB na curadoria); PDFs só para administradores, com tamanho máximo | `main.ts`, `exam-imports.ts` |

Cada bloqueio entra uma vez por janela no registro de atividades (categoria Segurança), com o IP; a aba Atividades da administração mostra o resumo das últimas 24 horas.

O que ela **não** resolve: um ataque distribuído (muitos IPs) esgota a instância antes de qualquer contador. Para isso a proteção precisa estar na borda: o Render já filtra parte do tráfego de rede, e um proxy como o Cloudflare (plano gratuito, modo "Under Attack" quando necessário) na frente do domínio próprio cobre o resto. Os limites dependem de `TRUST_PROXY` correto: com o valor errado, todos os acessos parecem vir do mesmo IP (bloqueio geral) ou o IP pode ser forjado.

## 6. Reverter

Migrations só avançam. Para reverter código, publique a imagem anterior; se uma migration nova tiver sido aplicada, ela continua válida para a versão anterior somente se foi aditiva (regra de revisão das migrations). Para dano em dados, restaure o backup mais recente em um banco novo e aponte `DATABASE_URL` para ele.

## 7. Pendências antes de usuários reais

- Ensaiar backup e restauração (item 7).
- Separar papel do banco para migrations (dono do schema) e para a aplicação (só leitura/escrita de dados).
- Recuperação de conta por e-mail (D2) ou manter a limitação já informada no cadastro.
- Limitador de login compartilhado se houver mais de uma instância.
