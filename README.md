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
- Caderno de erros com filtro por assunto, paginação e nova resolução; resumo por questão distinta, sem multiplicar contagens por edições ou versões.
- Registro de PDFs por download oficial, cópia pública fixada em commit ou arquivo local, com SHA-256 e conferência independente na seção Fontes.
- Catálogo de todos os anos localizados: 61 referências; 27 PDFs históricos obtidos/cadastrados e 34 documentos recentes ainda pendentes. Cadernos compartilhados, Licenciatura e PND têm identificação própria.
- Curadoria de questões oficiais com prova, página, número original e gabarito definitivo conferidos; procedência pública e comentário editorial com crédito próprio.
- Três questões iniciais **autorais demonstrativas**; nenhuma questão oficial publicada nesta entrega. Conteúdo pendente não é acessível pela API de estudo.

Esta entrega cobre partes dos incrementos A/B e o início de C, não a conclusão deles. Não inclui lote oficial revisado, extração automática de questões de PDF, simulados, IA nem infraestrutura de produção. Contas ainda não possuem confirmação de e-mail nem recuperação/troca de senha; essas limitações são informadas ao cadastrar. Entrar em conta existente não mescla respostas anônimas. Apagar um cookie anônimo continua perdendo o acesso àquele histórico.

## Preparação local

Requisitos: Node **24.19.0** (`.node-version`), npm 11 e Docker com Compose v2. Chromium instalado para os testes de navegador. A importação de fontes exige `curl` e `pdfinfo` (pacote `poppler-utils`). A API escuta apenas no loopback; o servidor de desenvolvimento web escuta na porta 4200. Não expor esse ambiente como produção.

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

A curadoria aceita questões autorais e oficiais. Questões oficiais exigem fontes conferidas; o crédito da questão é Inep e o comentário editorial tem crédito separado. HTML é exibido como texto. Para corrigir conteúdo publicado, crie nova versão: a anterior continua disponível e as respostas existentes mantêm seu gabarito.

## Fontes oficiais

O importador administrativo registra e arquiva o PDF; não extrai nem publica questões. Os 27 documentos históricos da cópia catalogada estão em IMPORTED, aguardando conferência. O [inventário de todos os anos](docs/OFFICIAL-SOURCES.md) descreve cobertura, hashes e os 34 arquivos ainda pendentes. Exemplo para a prova de Computação de 2021:

```sh
npm run import:source -- \
  --url https://download.inep.gov.br/enade/provas_e_gabaritos/2021_PV_bacharelado_ciencia_computacao.pdf \
  --kind EXAM --year 2021 --area 'Ciência da Computação' \
  --modality BACHARELADO --title 'ENADE 2021 · Ciência da Computação · Prova'
```

`--mirror-url <url-fixada-em-commit>` obtém uma cópia pública preservando a referência oficial. `--file <caminho>` recebe arquivo local; `--sha256 <hash>` exige correspondência. Não combine mirror e file. A forma de obtenção fica registrada e não é aprovação de procedência. `COMUM` identifica os cadernos compartilhados; `EXAM_MAP`, mapas que não são gabaritos.

`--actor <identity-uuid>` atribui a importação a uma conta de curadoria existente. Sem ele, o evento é administrativo, sem identidade de revisão humana. O registro nasce IMPORTED; outro curador confere origem, edição e integridade na seção Fontes. Para gabarito, também confirma que é definitivo. Fontes conferidas são imutáveis; uma correção documental recebe novo arquivo/hash. Reimportar o mesmo PDF preserva o registro e restaura um arquivo ausente/corrompido.

Arquivos ficam em `.local/sources/<sha256>.pdf`, ignorados pelo Git. `SOURCE_ARCHIVE_DIR` permite configurar armazenamento persistente fora do checkout. Preserve o arquivo junto ao banco em backups; a publicação verifica novamente seu hash. O download arquivado exige papel de curadoria. A fonte oficial pública permanece identificada pela URL do Inep. Veja [procedência e limites](docs/ADR-004-official-sources.md) e o [inventário](docs/OFFICIAL-SOURCES.md).

Para baixar todos os documentos no PC (sem banco ou npm install):

```sh
node scripts/download-sources.mjs
```

Requer Node 24 e curl. O padrão inclui todos os anos/famílias do catálogo, cria pastas por ano e um recibo; não substitui arquivos existentes. Após transportar os arquivos para o ambiente, `npm run import:sources -- --directory enade-pdfs` importa os PDFs locais e reporta ausências/falhas. Veja o inventário para retomada, cópias históricas, quarentena e limites.

## Validação

Com o banco preparado:

```sh
npm run build
npm test
npm run test:e2e
```

Neste ambiente, execute as suítes API e E2E em sequência: a execução simultânea atingiu timeouts de autenticação.

Os E2E iniciam API e web, ou reutilizam servidores locais já iniciados fora de CI. Por padrão usam `/usr/bin/chromium`; `CHROMIUM_PATH` permite indicar outro Chromium instalado. Não é necessário baixar um navegador via Playwright no ambiente da nuvem. `npm test` cria e remove apenas seus próprios visitantes e conteúdo temporário. Os testes de contas removem somente seus próprios registros temporários. Os E2E de estudo usam sessões novas e deixam dados anônimos de demonstração no banco de desenvolvimento. Nunca executar contra produção.

Build e testes foram executados no ambiente de onboarding: 47 testes API/PostgreSQL/utilitários e 18 testes Chromium, incluindo downloads com TLS, redirecionamentos, cópias locais/compartilhadas, quarentena e caminhos de pacotes, caderno de erros, contagem por questão/versão, ordenação de gravações concorrentes, paginação, fontes oficiais sintéticas, procedência e integridade de arquivos, curadoria, revisão independente, publicação concorrente, imutabilidade/histórico, cadastro/login/logout, histórico entre navegadores, concorrência com logout, sincronização entre abas, teclado, falha de rede, retry, reload e larguras 320/390/768/1440. Capturas desktop/mobile foram inspecionadas. Isso não certifica conformidade WCAG nem compatibilidade com WebKit/Firefox.

Para encerrar o banco sem apagar dados: `docker compose stop db`. API e web podem ser encerradas com Ctrl+C. Produção usa a imagem do `Dockerfile`, em que a API serve também a aplicação web; configuração, checklist de segurança e escolha de provedor estão em [deploy e segurança](docs/DEPLOY.md). O CI do GitHub roda auditoria de dependências, build, `npm test`, E2E e o build da imagem em cada PR.

## Documentação e próximos incrementos

- [Produto e sequência de entregas](docs/MASTER-SPEC.md)
- [Experiência de uso](docs/UX-DESIGN-SPEC.md)
- [Arquitetura](docs/ARCHITECTURE.md) e [decisão sobre persistência](docs/ADR-001-initial-persistence.md)
- [Contas e sessões](docs/ADR-002-account-sessions.md)
- [Curadoria e versões](docs/ADR-003-editorial-versions.md)
- [Fontes oficiais e procedência](docs/ADR-004-official-sources.md) e [inventário inicial](docs/OFFICIAL-SOURCES.md)
- [Caderno de erros e contagens](docs/ADR-005-error-notebook.md)
- [Cópias, arquivos locais e cadernos compartilhados](docs/ADR-006-source-acquisition.md)
- [Contrato da API](docs/API.md)
- [Deploy e segurança](docs/DEPLOY.md) e [decisão de hospedagem](docs/ADR-008-deployment.md)
- [Engenharia e validação](docs/ENGINEERING-AND-DELIVERY.md)
- [Avaliação das skills candidatas](docs/SKILLS-ASSESSMENT.md)
- [Colaboração entre agentes](docs/COLLABORATION.md), [quadro de trabalho](docs/WORKBOARD.md) e [plano de design e motion](docs/DESIGN-QUALITY.md)

Próxima entrega: transcrição e revisão humana do lote oficial inicial, incluindo imagens e itens anulados quando necessário. O registro de documentos e o fluxo de publicação oficial estão disponíveis; nenhum item oficial foi publicado automaticamente. Repetição espaçada, plano de estudos e tendências ainda não estão implementados. Recuperação/verificação de contas e requisitos operacionais são necessários antes de produção. As nove skills candidatas dos documentos não foram carregadas; a skill usada nesta tarefa foi `cloud-environment-onboarding:setup`.
