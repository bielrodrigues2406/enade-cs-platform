# Contrato da API

REST JSON, prefixo `/api`, sem CORS entre origens; a web usa proxy na mesma origem. Não há interface editorial nem modo simulado.

| Método e caminho | Entrada | Retorno / regra |
| --- | --- | --- |
| GET /health | nenhuma | 200 `{status:"ok",database:"ok"}` após consulta real ao banco |
| POST /session | JSON; cookie opcional | 201 `{mode:"guest"}` ou `{mode:"account",email}`; cookie HttpOnly/SameSite Strict de 30 dias; sessão válida existente é reutilizada |
| GET /auth/me | cookie | 200 com modo e e-mail da própria conta quando autenticada; 401 se expirado |
| POST /auth/register | cookie anônimo; JSON `{email,password}` | 201 conta; preserva respostas da identidade atual e rotaciona token; duplicata 409 |
| POST /auth/login | cookie anônimo; JSON `{email,password}` | 200 conta e novo token; não mescla respostas anônimas; credenciais incorretas 401 genérico |
| POST /auth/logout | JSON; cookie opcional | 200 `{mode:"guest"}`; revoga token corrente e emite nova identidade anônima vazia |
| GET /questions | cookie; `q` até 120 caracteres, `topic` até 80 | 200 lista de `{id,title,topic,origin,answered}`; publicados, ordenados por id, máximo 50; substring literal sem distinção de maiúsculas |
| GET /questions/:id | cookie | 200 `{id,title,topic,prompt,origin,options:[{id,text}],answer}`; gabarito/explicação ausentes até haver resposta desta sessão |
| PUT /questions/:id/answer | cookie; `{optionId,baseRevision}` | 200 `{optionId,revision,correct,correctOptionId,explanation}`; valida alternativa da versão, persiste antes de confirmar |

`answer` é `null` antes da resposta; depois possui o mesmo formato do retorno de PUT. O servidor deriva o dono do histórico do token: IDs de identidade enviados pelo cliente não concedem acesso a dados. Nenhum endpoint retorna respostas de outra sessão.

A primeira resposta usa `baseRevision:0`; cada alteração usa a última revisão confirmada pelo servidor. Repetir a mesma operação após perda da resposta HTTP retorna o mesmo resultado se ainda corresponder à revisão vigente. Gravação antiga ou concorrente divergente retorna 409, sem sobrescrever os dados; recarregar a questão permite reconciliar. Alternativa e revisão são validadas antes da escrita. Revisão aceita é inteiro seguro de 0 até 1.000.000.

E-mail é normalizado por trim/lowercase, limitado a 254 caracteres e validado no servidor. Senha tem de 12 a 128 caracteres Unicode. Não há confirmação de e-mail nem recuperação de senha. A sessão autenticada recebe apenas modo/e-mail, nunca hash ou identificador de dono. Cadastro/login exigem sair se já houver conta autenticada (409).

Erros esperados têm `{message:string}`: 400 entrada inválida, 401 sessão ausente/expirada, 403 origem de navegador não autorizada, 404 versão inexistente/não publicada, 409 conflito de revisão/cadastro ou sessão já autenticada, 415 escrita sem JSON, 429 excesso de tentativas (Retry-After), 503 capacidade de autenticação ocupada. Erros inesperados usam 500 genérico do Nest. A UI preserva a seleção após erro; não anuncia salvamento antes do 200. Escritas exigem Content-Type application/json; corpo limitado a 16 KiB. Requisições de escrita que declarem Origin devem corresponder a APP_ORIGIN. Clientes fora do navegador precisam proteger seus próprios tokens.

Este contrato documenta a fatia entregue. OpenAPI gerado, paginação, curadoria e contratos de tentativa/finalização ainda não foram implementados. Limite de autenticação é por processo (10/e-mail, 50/IP em 15 min), não compartilhado entre réplicas. Veja ADR 002 para concorrência e limitações operacionais.
