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
| `TRUST_PROXY` | `1` quando há um proxy reverso do provedor à frente (caso de Railway, Render e similares). Sem isso, o limite de tentativas de login trataria todos os acessos como um único IP | Não |
| `PORT` | Normalmente definido pelo provedor; padrão 3000 | Não |
| `SOURCE_ARCHIVE_DIR` | Padrão `/data/sources`; monte um volume persistente nesse caminho para os PDFs arquivados | Não |

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
| Render | Fluxo parecido com Dockerfile, Postgres gerenciado e disco persistente | Postgres gratuito expira em 30 dias; disco só em plano pago |

Com as regras da seção 3, o risco residual de um novo vazamento de variáveis é a URL do banco, que não funciona fora da rede privada. Recomendação: se escolher Railway, aplique a seção 3 inteira antes de cadastrar usuários reais e acompanhe o relatório final do incidente.

## 5. Passo a passo (genérico)

1. Criar projeto no provedor a partir do repositório GitHub, usando o `Dockerfile`.
2. Adicionar PostgreSQL 17 na rede privada; **desativar acesso público**.
3. Definir `DATABASE_URL` (referência interna do provedor), `APP_ORIGIN` e `TRUST_PROXY=1`.
4. Montar volume persistente em `/data/sources`.
5. Configurar health check em `/api/health` e domínio com HTTPS.
6. Publicar. As migrations rodam no início; conferir o log `Migration aplicada: …` e `/api/health`.
7. Opcional: conteúdo autoral demonstrativo com `node dist/admin/seed.mjs` no shell do serviço.
8. Curadoria: após a pessoa criar a conta pelo site e a identidade ser conferida, `node dist/admin/curator-role.mjs grant <identity-uuid>` no shell do serviço.

Importação de PDFs oficiais em produção ainda não está empacotada na imagem (depende de `curl`/`pdfinfo`, trilha de fontes do Codex). Até lá, não importe fontes direto no banco de produção a partir de máquinas pessoais; isso exigiria abrir o banco publicamente.

## 6. Reverter

Migrations só avançam. Para reverter código, publique a imagem anterior; se uma migration nova tiver sido aplicada, ela continua válida para a versão anterior somente se foi aditiva (regra de revisão das migrations). Para dano em dados, restaure o backup mais recente em um banco novo e aponte `DATABASE_URL` para ele.

## 7. Pendências antes de usuários reais

- Ensaiar backup e restauração (item 7).
- Separar papel do banco para migrations (dono do schema) e para a aplicação (só leitura/escrita de dados).
- Recuperação de conta por e-mail (D2) ou manter a limitação já informada no cadastro.
- Limitador de login compartilhado se houver mais de uma instância.
