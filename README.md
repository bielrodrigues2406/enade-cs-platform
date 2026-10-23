# Caderno de Computação · ENADE

Base de desenvolvimento de uma plataforma de estudo de Ciência da Computação. Interface em português, Angular 22.2.3, API NestJS 12.2.0 e PostgreSQL 17.6, com versões diretas e lockfile fixados.

## O que funciona

- Catálogo com busca, filtro por assunto e indicação de resposta salva.
- Resolução com alternativas identificadas, feedback após confirmação, alteração e retomada da resposta.
- Persistência PostgreSQL com prática anônima ou conta por e-mail/senha.
- Cadastro preserva as respostas da sessão atual; login em outro navegador recupera o histórico da conta.
- Sessões de 30 dias, rotação de tokens ao autenticar e saída com revogação no servidor.
- Revisões de resposta: retry idempotente e rejeição de gravações antigas/conflitantes.
- Curadoria de questões autorais: rascunho, revisão por outra pessoa, devolução, publicação e nova versão.
- Versões publicadas e feedback histórico preservados; conflitos não sobrescrevem alterações.
- Três questões iniciais **autorais demonstrativas**; nenhuma questão oficial importada. Conteúdo pendente não é acessível pela API de estudo.

Esta entrega é uma fatia inicial dos incrementos A/B, não a conclusão deles. Não inclui lote oficial revisado, importador de PDF, simulados, IA nem infraestrutura de produção. Contas ainda não possuem confirmação de e-mail nem recuperação/troca de senha; essas limitações são informadas ao cadastrar. Entrar em conta existente não mescla respostas anônimas. Apagar um cookie anônimo continua perdendo o acesso àquele histórico.

## Preparação local

Requisitos: Node **24.19.0** (`.node-version`), npm 11 e Docker com Compose v2. Chromium instalado para os testes de navegador. A API escuta apenas no loopback; o servidor de desenvolvimento web escuta na porta 4200. Não expor esse ambiente como produção.

Na raiz do repositório:

```sh
npm ci
npm run db:up
npm run db:migrate
npm run db:seed
```

`db:up` gera `.env` ignorado, com senha aleatória para o banco **local de desenvolvimento**, somente se o arquivo não existir. Preserve esse arquivo se reutilizar o volume. Não copie credenciais de produção. O banco é exposto somente em `127.0.0.1:5432`. Migrations são transacionais, verificadas por checksum e serializadas; seed repetido não altera versões existentes. Não editar migrations já aplicadas.

Em dois terminais, ambos na raiz:

```sh
npm run dev:api
```

```sh
npm run dev:web
```

A web usa proxy `/api` para a API na porta 3000. `APP_ORIGIN` no `.env` deve corresponder à origem usada pelo navegador (padrão `http://localhost:4200`). Para verificar internamente a prontidão: `curl --fail http://127.0.0.1:3000/api/health`; a resposta deve informar `status: ok` e `database: ok`.

## Acesso à curadoria

Crie contas pelo fluxo normal. Um administrador com acesso local ao banco deve conferir a identidade e a responsabilidade editorial antes de conceder papel por UUID:

```sh
npm run curator:role -- grant <identity-uuid>
npm run curator:role -- revoke <identity-uuid>
```

O UUID pertence a `account.identity_id`. Consulte-o no banco administrativo local após verificar a conta; o e-mail não verificado não é autorização. O comando não cria contas nem senhas. Não há papel privilegiado automático, endpoint público de concessão ou usuário padrão. Depois da concessão, recarregue a aplicação para aparecer a navegação Curadoria. Publicação exige outra conta de curadoria que não tenha criado nem sido a última editora da versão.

A curadoria aceita apenas questões autorais e informa crédito e versão ao estudante. HTML é exibido como texto; não há importação oficial habilitada. Para corrigir conteúdo publicado, crie nova versão: a anterior continua disponível e as respostas existentes mantêm seu gabarito.

## Validação

Com o banco preparado:

```sh
npm run build
npm test
npm run test:e2e
```

Os E2E iniciam API e web, ou reutilizam servidores locais já iniciados fora de CI. Por padrão usam `/usr/bin/chromium`; `CHROMIUM_PATH` permite indicar outro Chromium instalado. Não é necessário baixar um navegador via Playwright no ambiente da nuvem. `npm test` cria e remove apenas seus próprios visitantes e conteúdo temporário. Os testes de contas removem somente seus próprios registros temporários. Os E2E de estudo usam sessões novas e deixam dados anônimos de demonstração no banco de desenvolvimento. Nunca executar contra produção.

Build e testes foram executados no ambiente de onboarding: 23 testes API/PostgreSQL e 12 testes Chromium, incluindo curadoria, revisão independente, publicação concorrente, imutabilidade/histórico, cadastro/login/logout, histórico entre navegadores, concorrência com logout, sincronização entre abas, teclado, falha de rede, retry, reload e larguras 320/390/768/1440. Capturas desktop/mobile foram inspecionadas. Isso não certifica conformidade WCAG nem compatibilidade com WebKit/Firefox.

Para encerrar o banco sem apagar dados: `docker compose stop db`. API e web podem ser encerradas com Ctrl+C. O build da API pode ser iniciado na raiz com `node dist/api/serve.js`; o build web fica em `dist/web/browser`. Servir esse build em produção exige HTTPS, proxy, gestão e recuperação de contas, limites operacionais e demais medidas descritas nos documentos.

## Documentação e próximos incrementos

- [Produto e sequência de entregas](docs/MASTER-SPEC.md)
- [Experiência de uso](docs/UX-DESIGN-SPEC.md)
- [Arquitetura](docs/ARCHITECTURE.md) e [decisão sobre persistência](docs/ADR-001-initial-persistence.md)
- [Contas e sessões](docs/ADR-002-account-sessions.md)
- [Curadoria e versões](docs/ADR-003-editorial-versions.md)
- [Contrato da API](docs/API.md)
- [Engenharia e validação](docs/ENGINEERING-AND-DELIVERY.md)
- [Avaliação das skills candidatas](docs/SKILLS-ASSESSMENT.md)

Próxima entrega: modelo de documentos/fontes oficiais e importação conferida do lote inicial. A revisão editorial autoral já está disponível; publicação oficial permanece bloqueada. Recuperação/verificação de contas e requisitos operacionais são necessários antes de produção. Não habilitar publicação oficial antes de implementar procedência e revisão. As nove skills candidatas dos documentos não foram carregadas; a skill usada nesta tarefa foi `cloud-environment-onboarding:setup`.
