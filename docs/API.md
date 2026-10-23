# Contrato da API

REST JSON, prefixo `/api`, sem CORS entre origens; a web usa proxy na mesma origem. A curadoria usa papel explícito e endpoints separados para questões e fontes oficiais. A importação de PDFs ocorre somente por ferramenta local; não há modo simulado.

| Método e caminho | Entrada | Retorno / regra |
| --- | --- | --- |
| GET /health | nenhuma | 200 `{status:"ok",database:"ok"}` após consulta real ao banco |
| POST /session | JSON; cookie opcional | 201 `{mode:"guest"}` ou `{mode:"account",email}`; cookie HttpOnly/SameSite Strict de 30 dias; sessão válida existente é reutilizada |
| GET /auth/me | cookie | 200 com modo e e-mail da própria conta quando autenticada; 401 se expirado |
| POST /auth/register | cookie anônimo; JSON `{email,password}` | 201 conta; preserva respostas da identidade atual e rotaciona token; duplicata 409 |
| POST /auth/login | cookie anônimo; JSON `{email,password}` | 200 conta e novo token; não mescla respostas anônimas; credenciais incorretas 401 genérico |
| POST /auth/logout | JSON; cookie opcional | 200 `{mode:"guest"}`; revoga token corrente e emite nova identidade anônima vazia |
| GET /questions | cookie; `q` até 120 caracteres, `topic` até 80 | 200 lista de `{id,title,topic,origin,demonstration,versionNumber,answered}`; somente ponteiros publicados atuais, ordenados por id, máximo 50; substring literal sem distinção de maiúsculas |
| GET /questions/:id | cookie | 200 `{id,title,topic,prompt,origin,authorCredit,demonstration,versionNumber,options:[{id,text}],provenance,answer}`; gabarito/explicação ausentes até haver resposta desta sessão |
| PUT /questions/:id/answer | cookie; `{optionId,baseRevision}` | 200 `{optionId,revision,correct,correctOptionId,explanation,explanationCredit,answerKey?}`; valida alternativa da versão, persiste antes de confirmar |

`answer` é `null` antes da resposta; depois possui o mesmo formato do retorno de PUT. O servidor deriva o dono do histórico do token: IDs de identidade enviados pelo cliente não concedem acesso a dados. Nenhum endpoint retorna respostas de outra sessão.

A primeira resposta usa `baseRevision:0`; cada alteração usa a última revisão confirmada pelo servidor. Repetir a mesma operação após perda da resposta HTTP retorna o mesmo resultado se ainda corresponder à revisão vigente. Gravação antiga ou concorrente divergente retorna 409, sem sobrescrever os dados; recarregar a questão permite reconciliar. Alternativa e revisão são validadas antes da escrita. Revisão aceita é inteiro seguro de 0 até 1.000.000.

E-mail é normalizado por trim/lowercase, limitado a 254 caracteres e validado no servidor. Senha tem de 12 a 128 caracteres Unicode. Não há confirmação de e-mail nem recuperação de senha. A sessão autenticada recebe apenas modo/e-mail, nunca hash ou identificador de dono. Cadastro/login exigem sair se já houver conta autenticada (409).

Erros esperados têm `{message:string}`: 400 entrada inválida, 401 sessão ausente/expirada, 403 origem de navegador não autorizada, 404 versão inexistente/não publicada, 409 conflito de revisão/cadastro ou sessão já autenticada, 415 escrita sem JSON, 429 excesso de tentativas (Retry-After), 503 capacidade de autenticação ocupada. Erros inesperados usam 500 genérico do Nest. A UI preserva a seleção após erro; não anuncia salvamento antes do 200. Escritas exigem Content-Type application/json; corpo limitado a 16 KiB (64 KiB em /api/curation). Requisições de escrita que declarem Origin devem corresponder a APP_ORIGIN. Clientes fora do navegador precisam proteger seus próprios tokens.

Este contrato documenta a fatia entregue. OpenAPI gerado, paginação, extração automática de questões e contratos de tentativa/finalização ainda não foram implementados. Limite de autenticação é por processo (10/e-mail, 50/IP em 15 min), não compartilhado entre réplicas. Veja ADR 002 para concorrência e limitações operacionais.


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

Criar, editar e publicar conferem os arquivos arquivados. Arquivo ausente/corrompido retorna 409 sem avançar estado editorial. Versões oficiais não podem ser demonstrações. A API não verifica automaticamente se o texto, alternativa correta ou comentário foram transcritos com fidelidade; isso é responsabilidade da revisão humana independente.

No estudo, `provenance` é null para autorais ou `{exam:{id,title,officialUrl,sha256,year,area,modality,pageCount},page,questionNumber}` para oficiais. Antes de confirmar uma resposta, o DTO não inclui IDs, URLs ou hashes do gabarito nem comentário. Depois, `answerKey:{id,title,officialUrl,sha256,page}` e `explanationCredit` acompanham o feedback confirmado. A URL do Inep é pública; esse comportamento separa o feedback da plataforma, não impede consultar documentos externos.

## Registro de fontes

Todas as rotas exigem papel de curadoria. A importação local usa `npm run import:source -- --help`; não há POST de criação/upload pela API.

| Método e caminho (prefixo /api) | Entrada | Retorno / regra |
| --- | --- | --- |
| GET /curation/sources | cookie de curadoria | até 100 documentos por edição decrescente, título e ID |
| GET /curation/sources/:id | cookie de curadoria | metadados e capacidade de conferência |
| GET /curation/sources/:id/file | cookie de curadoria | PDF como attachment; tamanho, assinatura e SHA-256 revalidados |
| PUT /curation/sources/:id | `{baseRevision,title,kind,year,area,modality}` | edita IMPORTED/REJECTED, retorna IMPORTED e exige nova conferência; VERIFIED retorna 409 |
| POST /curation/sources/:id/review | `{baseRevision,decision,note,checklist?}` | VERIFY → VERIFIED ou REJECT → REJECTED; revisão própria 403, estado/revisão divergente 409 |

Metadados: `{id,title,officialUrl,kind,year,area,modality,sha256,byteSize,pageCount,status,revision,canReview,note,isFinal}`. Tipos EXAM/ANSWER_KEY/RESPONSE_STANDARD; modalidades BACHARELADO/LICENCIATURA/CST; título até 200 e área até 120 caracteres; edição de 2004 até o ano atual. URL, hash, tamanho, páginas e identidade do importador são imutáveis. VERIFIED congela também os metadados editoriais. Parecer tem 10–2000 caracteres. Identidades privadas de importação/revisão não são retornadas.

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
