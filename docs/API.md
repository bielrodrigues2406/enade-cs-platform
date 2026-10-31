# Contrato da API

REST JSON, prefixo `/api`, sem CORS entre origens; a web usa proxy na mesma origem. A curadoria usa papel explícito e endpoints separados para questões e fontes oficiais. A importação de PDFs ocorre somente por ferramenta local; o treino parcial é sem cronômetro e o simulado completo permanece pendente.

| Método e caminho | Entrada | Retorno / regra |
| --- | --- | --- |
| GET /health | nenhuma | 200 `{status:"ok",database:"ok"}` após consulta real ao banco |
| POST /session | JSON; cookie opcional | 201 `{mode:"guest"}` ou `{mode:"account",email}`; cookie HttpOnly/SameSite Strict de 30 dias; sessão válida existente é reutilizada |
| GET /auth/me | cookie | 200 com modo e e-mail da própria conta quando autenticada; 401 se expirado |
| POST /auth/register | cookie anônimo; JSON `{email,password}` | 201 conta; preserva respostas da identidade atual e rotaciona token; duplicata 409 |
| POST /auth/login | cookie anônimo; JSON `{email,password}` | 200 conta e novo token; não mescla respostas anônimas; credenciais incorretas 401 genérico |
| POST /auth/logout | JSON; cookie opcional | 200 `{mode:"guest"}`; revoga token corrente e emite nova identidade anônima vazia |
| GET /catalog | cookie; `q` até 120, `topic` até 80, `area` canônica ou `unclassified`, `year` 2000–2100; `limit` 1–50 (padrão 20), `offset` 0–1.000.000 | 200 catálogo paginado com totais, filtros globais, resumo e sugestões; contrato abaixo |
| GET /questions | cookie; `q` até 120 caracteres, `topic` até 80 | 200 lista de `{id,title,topic,origin,demonstration,versionNumber,answered}`; somente ponteiros publicados atuais, ordenados por id, máximo 50; substring literal sem distinção de maiúsculas |
| GET /questions/:id | cookie | 200 `{id,title,topic,subject,prompt,origin,authorCredit,demonstration,versionNumber,options:[{id,text}],presentation,images,reviewOrigin,provenance,answer}`; gabarito/explicação ausentes até haver resposta desta sessão |
| GET /question-images/:sha256.webp | cookie | 200 `image/webp` do recorte; só se a imagem pertence a uma versão publicada (ou a sessão é de curadoria); `Cache-Control: private, max-age=31536000, immutable`, pois o nome é o hash. Bytes conferidos pelo SHA-256 a cada leitura (409 se divergirem) |
| PUT /questions/:id/answer | cookie; `{optionId,baseRevision}` | 200 `{optionId,revision,correct,correctOptionId,explanation,explanationCredit,answerKey?}`; valida alternativa da versão, persiste antes de confirmar |

`answer` é `null` antes da resposta; depois possui o mesmo formato do retorno de PUT. O servidor deriva o dono do histórico do token: IDs de identidade enviados pelo cliente não concedem acesso a dados. Nenhum endpoint retorna respostas de outra sessão.

A primeira resposta usa `baseRevision:0`; cada alteração usa a última revisão confirmada pelo servidor. Repetir a mesma operação após perda da resposta HTTP retorna o mesmo resultado se ainda corresponder à revisão vigente. Gravação antiga ou concorrente divergente retorna 409, sem sobrescrever os dados; recarregar a questão permite reconciliar. Alternativa e revisão são validadas antes da escrita. Revisão aceita é inteiro seguro de 0 até 1.000.000.

E-mail é normalizado por trim/lowercase, limitado a 254 caracteres e validado no servidor. Senha tem de 12 a 128 caracteres Unicode. Não há confirmação de e-mail nem recuperação de senha. A sessão autenticada recebe apenas modo/e-mail, nunca hash ou identificador de dono. Cadastro/login exigem sair se já houver conta autenticada (409).

Erros esperados têm `{message:string}`: 400 entrada inválida, 401 sessão ausente/expirada, 403 origem de navegador não autorizada, 404 versão inexistente/não publicada, 409 conflito de revisão/cadastro ou sessão já autenticada, 415 escrita sem JSON, 429 excesso de tentativas (Retry-After), 503 capacidade de autenticação ocupada. Erros inesperados usam 500 genérico do Nest. A UI preserva a seleção após erro; não anuncia salvamento antes do 200. Escritas exigem Content-Type application/json; corpo limitado a 16 KiB (64 KiB em /api/curation). Requisições de escrita que declarem Origin devem corresponder a APP_ORIGIN. Clientes fora do navegador precisam proteger seus próprios tokens.

Este contrato documenta a fatia entregue. OpenAPI gerado, upload/processamento de PDFs acompanhado pela interface e contratos de tentativa/finalização ainda não foram implementados. Extração assistida via CLI e fila privada já existem. Limite de autenticação é por processo (10/e-mail, 50/IP em 15 min), não compartilhado entre réplicas. Veja ADR 002 para concorrência e limitações operacionais.

### Catálogo paginado

`GET /catalog` devolve `{items,total,answeredTotal,limit,offset,facets,summary,suggestions}`. Cada item contém `{id,title,topic,origin,demonstration,versionNumber,answered,area,year,modality,questionNumber}`. Ano/modalidade/número vêm da prova associada; sem prova, são nulos. Área só é preenchida quando `topic` corresponde exatamente à lista canônica de 18 áreas de `question-areas.ts`; assuntos livres continuam preservados e entram em `area=unclassified`, sem classificação automática.

`facets` contém `{areas:[{name,count}],unclassified,topics:[string],years:[number]}`. Considera todo o acervo publicado atual, independentemente dos filtros ou da página. Áreas têm ordem fixa e incluem contagem zero; anos vêm em ordem decrescente. `summary:{total,answered,official,author,demonstration}` também é global; `author` exclui demonstrações. `suggestions` traz até três itens globais ainda não respondidos, na mesma ordem do catálogo, para a página inicial.

`total` e `answeredTotal` referem-se à seleção filtrada inteira, não à página. Respostas/contagens/sugestões pertencem somente à identidade da sessão. Todas as listas e agregados excluem versões privadas e versões publicadas anteriores que já não são o ponteiro atual. A consulta usa um único snapshot PostgreSQL e não devolve enunciado, gabarito ou explicação. Busca usa substring literal em título/enunciado, sem distinguir maiúsculas; `%` e `_` não são curingas. Paginação ordenada por ID da versão; offset além do fim recua à última página, ou zero na seleção vazia. O catálogo é vivo: publicações entre consultas podem mudar a seleção, ao contrário de uma futura tentativa de simulado fixada.

Filtros desconhecidos, parâmetros repetidos/estruturados, áreas fora da lista e números ambíguos retornam 400. Strings vazias de busca/assunto/área/ano removem o filtro. `/questions` mantém seu contrato legado de lista com limite 50; a interface do banco e o início usam `/catalog`.

A web usa páginas de 20 e registra a seleção em `/questoes?q=...&topic=...&area=...&year=...&page=2`, omitindo valores vazios e a primeira página. Aplicar filtros volta à página 1; voltar/avançar no navegador e recarregar restauram a seleção. Abrir questão mantém esse endereço; respostas continuam no servidor. O endereço não guarda alternativa ainda não confirmada nem abre automaticamente uma questão após reload.

## Curadoria de questões

Todas as rotas abaixo exigem sessão válida e JSON nas escritas. `/curation/access` retorna `{canCurate:false}` para sessões sem papel; as demais retornam 403. O papel é concedido/revogado por UUID somente via ferramenta administrativa local, nunca por corpo de cadastro ou e-mail.

| Método e caminho (prefixo /api) | Entrada | Retorno |
| --- | --- | --- |
| GET /curation/access | cookie | `{canCurate:boolean}` |
| GET /curation/questions | cookie de curadoria | até 50 últimas versões, uma por questão lógica |
| GET /curation/versions/:id | cookie de curadoria | detalhe editorial, incluindo opções/gabarito não públicos |
| POST /curation/questions | conteúdo autoral ou oficial | 201 nova questão e rascunho versão 1/revisão 1 |
| PUT /curation/versions/:id | conteúdo e baseRevision | 200 rascunho atualizado; somente DRAFT/REJECTED |
| POST /curation/versions/:id/submit | `{baseRevision}` | 200 IN_REVIEW |
| POST /curation/versions/:id/review | `{baseRevision,decision,note,checklist?}` | 200 PUBLISHED/REJECTED; autor/último editor recebem 403 |
| POST /curation/questions/:questionId/versions | `{baseCurrentVersionId}` | 201 clone em rascunho; versão atual divergente/outra aberta retornam 409 |

Conteúdo: `{title,topic,prompt,authorCredit,explanation,options:[{id,text}],correctOptionId}`. Limites: título 160; assunto 80; enunciado 6000; crédito 160; explicação 4000; 2–5 alternativas, IDs distintos de 1–64 caracteres alfanuméricos/underscore/hífen, textos até 1000. Gabarito deve pertencer às opções. `origin` aceita AUTHOR_CREATED (padrão) ou OFFICIAL. `explanationCredit` identifica a autoria do comentário; para autorais, usa o crédito autoral quando omitido. Para oficiais, esse campo é obrigatório e `authorCredit` é fixado no servidor como Inep. IDs de autoria, estado, revisão e permissão são derivados no servidor, não concedidos pelo corpo.

Detalhe: conteúdo, `id` (versão), `questionId` (identidade lógica), `sequence`, `revision`, `origin`, `editorialStatus`, `currentVersionId`, `isAuthor`, `canReview`, `demonstration` e `reviewNote` (última devolução, ou null). A fila retorna o resumo desses campos. Revisão usa decisão PUBLISH/REJECT e parecer de 10–2000 caracteres; publicação exige checklist `{content:true,answer:true,credit:true}`. Para oficiais, também exige `source:true`, conferindo transcrição, página e número original com a prova/gabarito. Estado/revisão inválidos retornam 409, entrada inválida 400. Um texto devolvido deve ser editado e novamente submetido.

Respostas de estudo continuam vinculadas ao ID da versão aplicada. Publicar v2 muda o catálogo, mas `GET /questions/:id-da-v1` mantém conteúdo/feedback da v1. Conteúdo pendente continua inacessível ao estudante por todas as rotas públicas. Textos são interpolados, nunca executados como HTML. Veja ADR 003 para locks, auditoria e limites.


## Procedência oficial

Conteúdo OFFICIAL exige `provenance:{examSourceId,keySourceId,page,questionNumber,keyPage}`. Prova e gabarito devem estar VERIFIED, com mesma edição/área/modalidade; o gabarito precisa ser definitivo. Páginas são inteiros de 1 até o total do respectivo PDF; número original de 1 a 1000. Origem, prova e número original da questão lógica são imutáveis; a mesma prova/número não cria outra questão (409). Uma nova versão pode corrigir o vínculo do gabarito, preservando os resultados anteriores.

Criar, editar e publicar conferem os arquivos arquivados. Arquivo ausente/corrompido retorna 409 sem avançar estado editorial. Versões oficiais não podem ser demonstrações. A API não verifica automaticamente se o texto, alternativa correta ou comentário foram transcritos com fidelidade; isso é responsabilidade da revisão independente: humana pela curadoria, ou por agente pela ferramenta `publish:assisted` (ADR-011), que não tem rota HTTP.

Questão em imagem (ADR-010/011): `presentation` é `TEXT` ou `IMAGE`. Em `IMAGE`, `images:[{url,width,height,page}]` traz os recortes da prova na ordem de leitura (200 dpi), as alternativas são as letras A–E e `prompt`/`options[].text` são transcrição automática de apoio. `reviewOrigin` é `HUMAN` ou `ASSISTED` (conferida por agentes, sem revisão humana); a interface mostra o rótulo correspondente.

No estudo, `provenance` é null para autorais ou `{exam:{id,title,officialUrl,sha256,year,area,modality,pageCount},page,questionNumber}` para oficiais. Antes de confirmar uma resposta, o DTO não inclui IDs, URLs ou hashes do gabarito nem comentário. Depois, `answerKey:{id,title,officialUrl,sha256,page,finality}`, `explanationCredit` e `reviewNote` acompanham o feedback confirmado. `topic` é a área (lista fixa); `subject` é o assunto específico ou null. `reviewNote` é a ressalva de conteúdo escrita pelo conferente (D15), ou null; só aparece depois da resposta para não sugerir a alternativa. `finality` é `DECLARED` (o Inep declara definitivo), `ONLY_PUBLISHED` (único gabarito publicado, sem essa indicação; D10) ou `null` (conferência humana anterior a esse campo). A URL do Inep é pública; esse comportamento separa o feedback da plataforma, não impede consultar documentos externos.

## Registro de fontes

Todas as rotas exigem papel de curadoria. A importação local usa `npm run import:source -- --help`; não há POST de criação/upload pela API.

| Método e caminho (prefixo /api) | Entrada | Retorno / regra |
| --- | --- | --- |
| GET /curation/sources | cookie de curadoria | até 100 documentos por edição decrescente, título e ID |
| GET /curation/sources/:id | cookie de curadoria | metadados e capacidade de conferência |
| GET /curation/sources/:id/file | cookie de curadoria | PDF como attachment; tamanho, assinatura e SHA-256 revalidados |
| PUT /curation/sources/:id | `{baseRevision,title,kind,year,area,modality}` | edita IMPORTED/REJECTED, retorna IMPORTED e exige nova conferência; VERIFIED retorna 409 |
| POST /curation/sources/:id/review | `{baseRevision,decision,note,checklist?}` | VERIFY → VERIFIED ou REJECT → REJECTED; revisão própria 403, estado/revisão divergente 409 |

Metadados: `{id,title,officialUrl,kind,year,area,modality,sha256,byteSize,pageCount,status,revision,canReview,note,isFinal,acquisitionMethod,retrievalUrl}`. Tipos EXAM/ANSWER_KEY/RESPONSE_STANDARD/EXAM_MAP; modalidades BACHARELADO/LICENCIATURA/CST/COMUM; título até 200 e área até 120 caracteres; edição de 2004 até o ano atual. URL, hash, tamanho, páginas e identidade do importador são imutáveis. VERIFIED congela também os metadados editoriais. Parecer tem 10–2000 caracteres. Identidades privadas de importação/revisão não são retornadas.

VERIFY exige checklist `{origin:true,edition:true,integrity:true}` e, para ANSWER_KEY, `final:true`. A pessoa importadora e a última editora não podem conferir a própria fonte; importação administrativa sem ator não simula revisão. As escritas serializam sessão, papel e fonte, registrando eventos. Arquivo faltante ou alterado bloqueia conferência e download (409). Reimportação idêntica recupera o arquivo sem alterar o estado de uma fonte existente. Consulte ADR 004 para limites de armazenamento e operação.


## Caderno de erros

`GET /api/review?topic=&offset=0` exige sessão válida (anônima ou conta). `topic` é correspondência exata de até 80 caracteres; `offset` aceita inteiro decimal de 0 a 1.000.000. Valores repetidos, negativos ou fracionários retornam 400. A página tem 20 itens; não há parâmetro de tamanho. Offset além do total retorna lista vazia. A leitura não muda respostas nem concede acesso por IDs de pessoa enviados no query.

Retorno:

```ts
{
  summary: { answered, correct, incorrect, demonstration },
  topics: [{ topic, answered, incorrect }],
  total, offset, pageSize: 20,
  items: [{
    id, questionId, title, topic, origin, demonstration,
    versionNumber, answeredAt, currentVersionId
  }]
}
```

Os números são inteiros e representam questões lógicas distintas, considerando a resposta salva mais recente entre versões publicadas. Em empate de horário, prevalecem sequência de versão mais alta e ID. `correct + incorrect = answered`; demonstrações são um subconjunto de `answered`. Questões não respondidas e versões pendentes não entram na amostra. Não é contagem de tentativas nem de acertos iniciais.

Resumo e assuntos incluem todo o histórico elegível da pessoa. `total` e `items` incluem apenas respostas incorretas no assunto filtrado, ordenadas por horário crescente e ID. Contagens e página usam o mesmo snapshot de consulta; mudanças de respostas podem alterar a paginação em leituras seguintes. Não depende do limite de 50 itens do catálogo público.

`id` identifica a versão respondida; `questionId`, a questão lógica. `currentVersionId` permite informar uma publicação mais recente sem substituir o gabarito histórico. O DTO não inclui alternativas, explicação ou alternativa correta; a resolução e a alteração usam as rotas de estudo existentes. Corrigir uma resposta só retira o item após PUT confirmado. Veja ADR 005 para limites de interpretação e concorrência.


## Obtenção de documentos

A migration 006 mantém o contrato de revisão e acrescenta, somente no DTO de curadoria, `acquisitionMethod:DIRECT|MIRROR|LOCAL` e `retrievalUrl:string|null`. MIRROR identifica uma cópia HTTPS em raw.githubusercontent.com fixada em commit completo. LOCAL identifica arquivo recebido localmente, sem afirmar download direto. Esses campos são imutáveis, assim como URL oficial e hash; não são alteráveis pelo PUT de metadados. Os DTOs públicos de estudo continuam limitados à referência da fonte, sem novas informações de gabarito antes da resposta.

COMUM representa caderno compartilhado e exige a mesma modalidade entre prova/gabarito. EXAM_MAP pode ser conferido como documento, mas não substitui EXAM ou ANSWER_KEY no vínculo da questão. Publicação e conferência independente continuam exigidas. O arquivo local passa por `pdfinfo` e hash no CLI; não há endpoint de upload ou de importação pública. Veja ADR 006.

## Questões importadas para conferência

Todas as rotas abaixo exigem uma conta com papel de curadoria. A fila é privada e separada das versões editoriais e das questões de estudo. Importar não confere fontes nem publica conteúdo. Veja [ADR 009](ADR-009-question-intake.md).

| Método e caminho (prefixo /api/curation/imports) | Entrada | Retorno / regra |
| --- | --- | --- |
| GET / | `offset=0&limit=25&state=HOLD` opcionais | `{items,total,offset,limit,counts:{PENDING,HOLD,DRAFTED}}`; limite 1–50, offset 0–1.000.000; contagens globais independem do filtro |
| GET /:id | UUID do item | conteúdo editável, evidência original, extração mais recente, análise assistida, pendências, fontes e histórico |
| PUT /:id | `{baseRevision,content,resolvedFlags,note,keySourceId?,pages?}` | atualiza a conferência com nota e retorna detalhe; revisão divergente ou item encaminhado retorna 409 |
| POST /:id/draft | `{baseRevision,fidelityConfirmed:true}` | `{versionId,questionId}`; cria apenas DRAFT, com os mesmos requisitos oficiais da criação manual; retry da promoção já concluída recupera o resultado |

Estados: PENDING = para conferir; HOLD = pendências registradas; DRAFTED = rascunho editorial criado. Uma análise `CONTENT_CHECKED` continua assistida e não representa aprovação humana. `NOT_REVIEWED` e `MANUAL_REQUIRED` conservam a necessidade de análise/conferência.

`content` contém `{title,topic,prompt,options:[{id,text}],correctOptionId,explanation,explanationCredit,keyPage}`. A fila aceita texto incompleto para correção, com até cinco alternativas A–E. Limites: título/crédito 160, assunto 80, enunciado 24.000, alternativa/explicação 4.000 e nota 8–2.000 caracteres. A promoção aplica os limites e requisitos mais estritos do editor oficial. Não se alteram a prova nem a identidade numérica do item.

`flags` preserva alertas originais; `resolvedFlags` registra os resolvidos com justificativa. A extração original e o gabarito extraído continuam disponíveis para comparação. `unresolvedCount` na lista exclui alertas já resolvidos. A associação posterior de gabarito e a correção das páginas preservam o texto editado, validam o documento e registram a nota de conferência. Sem prova/gabarito definitivo conferidos, páginas válidas, fidelidade confirmada e conteúdo elegível, a promoção é bloqueada. Discursivas, anuladas e itens exclusivamente de outros cursos não viram questões de Ciência da Computação por resolver um alerta.

O CLI `npm run import:questions -- --file RELATORIO.questions.json [--review ANALISE.json] [--actor UUID]` é a única entrada de relatórios. Hashes devem corresponder às fontes catalogadas e arquivadas. Reimportar o mesmo conteúdo não duplica itens; conteúdo já editado ou encaminhado é protegido de sobrescrita. IDs de pessoas, cookies e detalhes privados de contas não aparecem no DTO.

## Treino parcial — contrato SIM-P1

Todos os endpoints exigem cookie válido; escritas JSON e validação fechada de campos. Nenhum aceita ownerId. IDs de tentativa/requestId são UUID; position inteiro 1–30. Outro proprietário recebe 404, sem revelar a existência da tentativa.

| Método | Entrada | Resposta |
| --- | --- | --- |
| GET /practice | sem query | `{sizes:[10,20,30],defaultSize:20,total,areas:[{name,count}],active:AttemptSummary|null,recent:AttemptSummary[]}`; 18 áreas fixas e recent até 5 concluídas |
| POST /practice | `{requestId,size,area:null|string}` | 201 `PracticeView`; mesma chave/configuração é retry; chave divergente ou outra ativa 409; conteúdo insuficiente 409 sem criar tentativa |
| GET /practice/:id | UUID | 200 `PracticeView` somente da sessão |
| PUT /practice/:id/items/:position | `{optionId:string|null,marked:boolean,baseRevision:number}` | 200 `{position,optionId,marked,revision}`; base inicial 0; retry idêntico retorna revisão já aplicada; conflito/finalizada 409 |
| POST /practice/:id/finish | `{}` | 200 `PracticeView` finalizado; repetição/concorrência devolvem o mesmo resultado |

`AttemptSummary` = `{id,state,size,area,createdAt,finishedAt,answered}`. `PracticeView` acrescenta `{items,summary}`. Datas ISO; state IN_PROGRESS ou COMPLETED. Cada item = `{position,question:PracticeQuestion,answer:{optionId,marked,revision},result?:PracticeFeedback}`.

`PracticeQuestion` = `{id,title,topic,subject,origin,authorCredit,demonstration,versionNumber,prompt,options:[{id,text}],presentation,images,reviewOrigin,provenance}`. Presentation/images/provenance usam o contrato de estudo existente. Nunca inclui answer do estudo livre, correctOptionId ou explanation.

Somente após finalizar, `summary` contém `{total,correct,incorrect,unanswered,official,author,demonstration,byTopic:[{topic,total,correct,incorrect,unanswered}]}` e cada `result` = `{correct:boolean|null,correctOptionId,explanation,explanationCredit,answerKey?}`. `correct=null` indica não respondida. `answerKey` usa o contrato de estudo, inclusive finality e o aviso D10. Antes do final, summary=null e result ausente. Respostas do treino não alteram /review ou /questions/:id/answer.

Seleção: uma versão atual por questão lógica, somente PUBLISHED de origem AUTHOR_CREATED/OFFICIAL, duas a cinco alternativas e gabarito pertencente à versão; apresentação IMAGE também exige recorte vinculado; tamanho exato sem repetição. area=null mistura assuntos; área deve pertencer à lista canônica de 18 áreas, por correspondência exata de topic. A disponibilidade e a seleção usam a mesma regra. Ordem escolhida aleatoriamente no início e preservada no banco. Uma tentativa ativa por proprietário e requestId por criação permitem retomada/retry sem duplicação. Ver ADR-007 para estado, locks e limites.

A web usa `/treino?attempt=UUID&item=2`, sem resposta ou identidade na URL. Navegação por item atualiza o endereço; reload recupera a tentativa pelo servidor. O componente preserva a gravação pendente após erro/409: edição, saída e finalização só são liberadas após ACK ou reabertura com descarte confirmado da seleção local. A folha de respostas é recolhível no mobile. O conjunto atual de três demos não habilita nenhum tamanho; conteúdo revisado ainda precisa ser publicado/ampliado.
