# Contrato da API inicial

REST JSON, prefixo `/api`, sem CORS entre origens; a web usa proxy na mesma origem. Não há interface editorial nem modo simulado.

| Método e caminho | Entrada | Retorno / regra |
| --- | --- | --- |
| GET /health | nenhuma | 200 `{status:"ok",database:"ok"}` após consulta real ao banco |
| POST /session | cookie opcional | 201 `{mode:"guest"}`; cookie HttpOnly/SameSite Strict de 30 dias; sessão válida existente é reutilizada |
| GET /questions | cookie; `q` até 120 caracteres, `topic` até 80 | 200 lista de `{id,title,topic,origin,answered}`; publicados, ordenados por id, máximo 50; substring literal sem distinção de maiúsculas |
| GET /questions/:id | cookie | 200 `{id,title,topic,prompt,origin,options:[{id,text}],answer}`; gabarito/explicação ausentes até haver resposta desta sessão |
| PUT /questions/:id/answer | cookie; `{optionId,baseRevision}` | 200 `{optionId,revision,correct,correctOptionId,explanation}`; valida alternativa da versão, persiste antes de confirmar |

`answer` é `null` antes da resposta; depois possui o mesmo formato do retorno de PUT. O servidor deriva o visitante do token: IDs de visitantes enviados pelo cliente não concedem acesso a dados. Nenhum endpoint retorna respostas de outra sessão.

A primeira resposta usa `baseRevision:0`; cada alteração usa a última revisão confirmada pelo servidor. Repetir a mesma operação após perda da resposta HTTP retorna o mesmo resultado se ainda corresponder à revisão vigente. Gravação antiga ou concorrente divergente retorna 409, sem sobrescrever os dados; recarregar a questão permite reconciliar. Alternativa e revisão são validadas antes da escrita. Revisão aceita é inteiro seguro de 0 até 1.000.000.

Erros esperados têm `{message:string}`: 400 entrada inválida, 401 sessão ausente/expirada, 403 origem de navegador não autorizada, 404 versão inexistente/não publicada, 409 conflito de revisão. Erros inesperados usam 500 genérico do Nest. A UI preserva a seleção após erro; não anuncia salvamento antes do 200. Requisições de escrita que declarem Origin devem corresponder a APP_ORIGIN. Clientes fora do navegador precisam proteger seus próprios tokens.

Este contrato documenta a fatia entregue. OpenAPI gerado, paginação, login, curadoria, rate limiting e contratos de tentativa/finalização ainda não foram implementados.
