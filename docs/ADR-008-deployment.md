# ADR 008 — Um contêiner, mesma origem e segredos mínimos

Data: 26/10/2026. Estado: adotada para R1. Guia operacional em [DEPLOY.md](DEPLOY.md).

A API NestJS passa a servir também o build da aplicação web quando `WEB_DIST` está definido. Em produção há um único contêiner e uma única origem HTTPS. Isso mantém o cookie de sessão `SameSite=Strict` restrito a `/api`, dispensa CORS e permite uma CSP sem fontes externas nem conteúdo inline. Rotas desconhecidas da web recebem o `index.html`; arquivos inexistentes e rotas de `/api` seguem para 404. Arquivos com hash no nome têm cache imutável; o `index.html` e as respostas da API não são reaproveitados sem revalidação.

A imagem é construída pelo `Dockerfile` da raiz, com base Node fixada por digest, dependências só de produção e usuário sem privilégios. Scripts administrativos usados em produção (seed e papel de curadoria) são empacotados com esbuild no build, sem levar `tsx` para a imagem. Ao iniciar, o contêiner aplica as migrations pendentes antes de abrir a porta; o runner já é transacional e serializado por advisory lock. A otimização de produção não insere CSS crítico inline, porque isso exigiria `unsafe-inline` ou handler inline na CSP.

`TRUST_PROXY` informa explicitamente quantos proxies estão à frente. Sem esse valor, cabeçalhos de encaminhamento continuam ignorados. Em produção a API recusa iniciar sem `APP_ORIGIN` HTTPS, `TRUST_PROXY` inválido ou `WEB_DIST` sem `index.html`.

Após o incidente de variáveis de ambiente do Railway (21/10/2026), a regra é tratar qualquer variável no provedor como passível de vazamento: R1 guarda apenas `DATABASE_URL`, e o banco não deve ter acesso público. O código não depende de provedor; a escolha permanece com Gabriel (D1).

Consequências: uma instância por enquanto, porque o limite de login é em memória; importação de PDFs ainda não roda dentro da imagem; papéis separados de banco para migrations e aplicação ficam como pendência antes de usuários reais.
