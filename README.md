# Caderno de Computação · ENADE

Base de desenvolvimento de uma plataforma de estudo de Ciência da Computação. Interface em português, Angular 22.2.3, API NestJS 12.2.0 e PostgreSQL 17.6, com versões diretas e lockfile fixados.

## O que funciona

- Página inicial em `/` com a situação do estudante: semanas até a prova, questões para retomar e para resolver, andamento salvo, formato da prova de 2026 e origem das questões com contagens reais; o banco fica em `/questoes`.
- Catálogo com busca, filtros por área/assunto/ano, total real e páginas de 20 sem truncar o acervo em 50. Seleção retomável pelo endereço, histórico do navegador e retorno após resolver; contagens do início também consideram todo o acervo publicado.
- Resolução com alternativas identificadas, feedback após confirmação, alteração e retomada da resposta.
- Persistência PostgreSQL com prática anônima ou conta por e-mail/senha.
- Cadastro preserva as respostas da sessão atual; login em outro navegador recupera o histórico da conta.
- Sessões de 30 dias, rotação de tokens ao autenticar e saída com revogação no servidor.
- Revisões de resposta: retry idempotente e rejeição de gravações antigas/conflitantes.
- Curadoria de questões autorais: rascunho, revisão por outra pessoa, devolução, publicação e nova versão.
- Versões publicadas e feedback histórico preservados; conflitos não sobrescrevem alterações. Edições não salvas da curadoria são protegidas ao sair ou recarregar.
- Caderno de erros com filtro por assunto, paginação e nova resolução; resumo por questão distinta, sem multiplicar contagens por edições ou versões.
- Tabela por assunto no caderno de erros (a retomar e respondidas) com ação de retomar cada assunto; no catálogo, quantas questões da seleção têm resposta salva; na resolução, posição na seleção e "Próxima questão" após o feedback.
- Interface com paleta "caderno" em tokens (contraste conferido), fontes auto-hospedadas e transições de tela que respeitam movimento reduzido ([design](docs/DESIGN-QUALITY.md)).
- Registro de PDFs por download oficial, cópia pública fixada em commit ou arquivo local, com SHA-256 e conferência independente na seção Fontes.
- Catálogo de todos os anos localizados: 61 referências; 28 PDFs individuais obtidos/cadastrados e 33 documentos recentes ainda pendentes. Cadernos compartilhados, Licenciatura e PND têm identificação própria.
- Curadoria de questões oficiais com prova, página, número original e gabarito definitivo conferidos; procedência pública e comentário editorial com crédito próprio.
- Extração assistida de PDFs catalogados, incluindo OCR com modelo local e formatos históricos compartilhados; relatórios identificam alertas e lacunas de numeração.
- Recuperação Unicode de 2014/2017 em cópia temporária, preservando o PDF original, com mapa e dependência Python fixados.
- Recortes WebP do original, apresentação por imagem com ampliação e alternativas por letra; publicação assistida exige conferência independente vinculada aos hashes exatos.
- Fila privada de questões importadas, com análise assistida identificada, correção auditada, proteção contra sobrescrita e encaminhamento para rascunho editorial após conferir as fontes.
- Três questões iniciais **autorais demonstrativas**; nenhuma questão oficial publicada nesta entrega. Conteúdo pendente não é acessível pela API de estudo.

Esta entrega cobre partes dos incrementos A/B e o início de C, não a conclusão deles. Não inclui lote oficial aprovado, simulados nem tutor de IA. OCR e análise assistida exigem conferência; os itens importados permanecem privados até cumprir a revisão editorial. Contas ainda não possuem confirmação de e-mail nem recuperação/troca de senha; essas limitações são informadas ao cadastrar. Entrar em conta existente não mescla respostas anônimas. Apagar um cookie anônimo continua perdendo o acesso àquele histórico.

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

O importador administrativo registra e arquiva o PDF; não extrai nem publica questões. Os 27 documentos históricos da cópia catalogada estão em IMPORTED, aguardando conferência. O [inventário de todos os anos](docs/OFFICIAL-SOURCES.md) descreve cobertura, hashes e os 33 arquivos ainda pendentes. Exemplo para a prova de Computação de 2021:

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
Para execução fria na nuvem, `npm run test:e2e -- --timeout=60000` define o limite padrão em 60 segundos; os fluxos longos continuam com seus limites específicos.

Os E2E iniciam API e web, ou reutilizam servidores locais já iniciados fora de CI. Por padrão usam `/usr/bin/chromium`; `CHROMIUM_PATH` permite indicar outro Chromium instalado. Não é necessário baixar um navegador via Playwright no ambiente da nuvem. `npm test` cria e remove apenas seus próprios visitantes e conteúdo temporário. Os testes de contas removem somente seus próprios registros temporários. Os E2E de estudo usam sessões novas e deixam dados anônimos de demonstração no banco de desenvolvimento. Nunca executar contra produção.

Build, 127 testes API/PostgreSQL/utilitários e 39 fluxos Chromium passaram localmente na base atual. Além dos contratos de conta, estudo, curadoria e fontes, a suíte cobre preservação dos PDFs, recibos Unicode, quarentena auxiliar, vínculos de prova/gabarito, geometria dos recortes, bloqueios materiais e finalidade do gabarito. Os fluxos Chromium verificam também mais de 50 questões no catálogo, filtros/URL/histórico, falhas na troca de página, totais e sugestões globais do início, apresentação por imagem, teclado e larguras 320/390/768/1440. Isso não certifica conformidade WCAG nem compatibilidade com WebKit/Firefox.

O [CI do PR #13](https://github.com/bielrodrigues2406/enade-cs-platform/actions/runs/40387694387) também aprovou build, testes com PostgreSQL, E2E e imagem de produção em 26/10/2026. Localmente, o fluxo de conta foi repetido após reiniciar o Vite, cujo overlay de erro havia interceptado o primeiro clique durante a atualização das dependências.

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
- [Questões por imagem e importação de prova + gabarito — proposta e medições](docs/QUESTION-IMAGES-AND-IMPORT.md)
- [Análise por perspectivas simuladas de alunos/professores e pendências](docs/reviews/2026-10-28-product-perspectives.md)
- [Auditoria atual com agentes: simulados, áreas e prontidão das telas](docs/reviews/2026-10-29-study-readiness.md)
- [Continuidade do Claude: recuperação de texto e qualidade das questões](docs/reviews/derived-text-quality.md)
- [Colaboração entre agentes](docs/COLLABORATION.md), [quadro de trabalho](docs/WORKBOARD.md) e [plano de design e motion](docs/DESIGN-QUALITY.md)

Próxima entrega: ampliar a conferência independente do lote oficial e publicar somente os recortes aprovados. Imagens, visualizador e publicação assistida do PR #16 já foram integrados; upload de prova + gabarito e editor de recortes continuam pendentes. Nenhuma conferência assistida é rotulada como humana. Repetição espaçada, plano de estudos e tendências ainda não estão implementados. Recuperação/verificação de contas e requisitos operacionais são necessários antes de produção.

## Importação de questões

Depois de cadastrar os PDFs e gerar os relatórios, importe os itens para a fila privada:

```sh
npm run import:questions -- --file .local/import-review/historical/enade-2021-bacharelado-exam.questions.json --review data/question-reviews/2021-review.json
```

Abra **Curadoria → Importação** com uma conta autorizada. Corrija texto e páginas, associe o gabarito e justifique a resolução das pendências. Reimportações idênticas não duplicam itens nem sobrescrevem edições da curadoria. Importar não concede papéis, confere fontes ou publica questões. Veja [ADR 009](docs/ADR-009-question-intake.md) e o [inventário e revisão do conteúdo](docs/OFFICIAL-SOURCES.md).

Há 605 ocorrências na fila privada deste ambiente, incluindo repetições e fontes auxiliares. A recuperação de 2014/2017 preservou todos os IDs e evidências iniciais; 548 das 551 objetivas possuem grupos estruturados, quatro ainda com algum texto de alternativa vazio. Essa contagem não certifica a qualidade. Nesta passagem foram rechecados 16 itens; a conferência dos recortes exatos de 2021 Q1–Q8 aprovou seis e bloqueou Q5/Q8 por ressalvas materiais. Nenhum item oficial foi publicado nesta passagem. Veja os [achados e limites](docs/reviews/derived-text-quality.md) e a [validação histórica](docs/reviews/legacy-options-validation.md).

A conferência posterior de [2021 Q9–Q16](docs/reviews/2021-crop-batch-2.md) aprovou Q9/Q10/Q11/Q15/Q16 e reteve Q12/Q13/Q14. O acumulado de recortes conferidos de Q1–Q16 é 11 APPROVED e cinco BLOCKED. Os diagramas de Q11/Q16 estão completos na imagem; a transcrição auxiliar conserva pendências. Não houve publicação nesta etapa.

Para recuperar o texto das quatro provas de 2014/2017 (opcional, exige Python 3.9+, Poppler e os originais catalogados):

```sh
python3 -m venv .local/pdf-venv
.local/pdf-venv/bin/pip install --require-hashes -r scripts/requirements-pdf.txt
npm run extract:questions -- --id enade-2014-bacharelado-exam \
  --directory enade-pdfs --output .local/question-drafts \
  --repair-calibri --python .local/pdf-venv/bin/python
```

`--crops .local/question-crops` acrescenta os recortes do original e requer ImageMagick. O antigo `--text-copy` foi substituído por geração interna; as imagens nunca vêm da cópia de texto. Os comandos administrativos de publicação e o lote conferido estão em [data/agent-reviews](data/agent-reviews/README.md).
