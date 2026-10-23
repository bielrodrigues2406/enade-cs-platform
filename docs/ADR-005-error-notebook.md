# ADR 005 — Caderno de erros e contagem por questão

Data: 23/10/2026. Estado: adotada para a base de desenvolvimento.

## Resultado

O caderno reúne questões cuja última resposta salva está incorreta, com filtro por assunto e nova resolução. Usa respostas já persistidas; funciona para visitantes e contas, sem duplicar estado em uma fila manual. Um acerto confirmado retira o item da fila; uma seleção ainda não confirmada ou uma falha HTTP não anuncia essa mudança.

## O que é contado

Uma questão distinta é uma identidade lógica de `editorial_question`. Entre suas versões publicadas respondidas pela pessoa, vale a resposta com maior `answer.updated_at`; em empate, prevalecem a sequência de versão mais alta e seu ID. As demais respostas continuam disponíveis no histórico de suas versões, mas não aumentam o denominador do resumo. Assunto, demonstração, título e correção pertencem à versão selecionada, não à publicação atual.

O resumo informa questões respondidas, acertos, erros e quantidade de demonstrações. São estados atuais das respostas salvas, sem período temporal filtrado. Não representam primeira tentativa, número de tentativas, evolução de aprendizagem, proficiência ou previsão de nota. A tabela `answer` mantém uma escolha vigente por pessoa/versão; não há histórico de cada alteração dentro de uma versão. Repetir um retry idempotente não aumenta contagens nem atualiza o horário.

O salvamento usa `clock_timestamp()` após adquirir os locks de sessão/identidade. Usar o início da transação (`now()`) poderia inverter a ordem de duas respostas em sessões diferentes quando uma delas espera um bloqueio. Um teste com PostgreSQL real reproduz essa ordem e falha com o comportamento anterior. Respostas anteriores preservam o horário já armazenado; a mudança não reconstrói uma ordem histórica que não foi registrada.

## Leitura e apresentação

`GET /api/review` deriva a pessoa do cookie. Uma única consulta calcula resumo, assuntos e página no mesmo snapshot. Filtrar assunto afeta a fila e seu total, preservando o resumo geral. A consulta considera todas as respostas publicadas da pessoa, sem depender das primeiras 50 questões do catálogo. A fila ordena os erros mais antigos primeiro, com ID como desempate; retorna 20 itens por página. Paginação por offset reflete o estado atual e pode mudar entre requisições quando respostas mudam. Não há snapshot durável entre páginas.

A lista identifica origem, demonstração, versão e horário. Quando existe publicação mais recente, avisa que a retomada usará a versão respondida e seu gabarito. O resumo mostra explicitamente o denominador e as demonstrações; não projeta desempenho a partir da amostra pequena da base.

Tentar novamente abre a resolução com seleção vazia e oculta o feedback anterior enquanto se escolhe. Não apaga a resposta salva nem impede consultar um feedback já confirmado pela API. Confirmar atualiza a mesma resposta com controle de revisão. Voltar ao caderno recalcula a fila e preserva assunto/página; se a última página deixa de existir, a interface retorna à última válida.

## Identidade e limites

Troca de conta, saída e atualização de identidade em outra aba desmontam o componente, abortam sua leitura e descartam respostas atrasadas. Filtro e página também são limpos nessa troca. Cadastro preserva o caderno anônimo; login abre o histórico da conta sem mesclar respostas de outro visitante. As permissões e limites de sessão continuam os da ADR 002.

Não há repetição espaçada, marcação manual de domínio, plano de estudos, tendência temporal, metas ou conclusão pedagógica. Não existe alteração na edição/conferência do lote oficial: o bloqueio de download documentado no inventário permanece separado deste fluxo. Os testes usam questões demonstrativas e fixtures explicitamente sintéticas, com limpeza de seus próprios dados.
