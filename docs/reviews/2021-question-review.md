# Revisão assistida das questões de 2021

Autoria: Codex, análise assistida. **Não é conferência humana, aprovação editorial, validação das fontes como VERIFIED nem autorização de publicação.** O usuário pediu expressamente análise e revisão do conteúdo; os controles de fonte e publicação continuam aplicáveis.

O arquivo [2021-review.json](../../data/question-reviews/2021-review.json) registra assunto, explicação, observações e pendências individualmente para as 80 entradas dos cadernos de Bacharelado e Licenciatura. Não modifica as respostas dos gabaritos nem os PDFs.

## Cobertura e resultado

| Caderno | Entradas | Análise conceitual sem nova pendência | Revisão manual necessária |
| --- | ---: | ---: | ---: |
| Bacharelado | 40 | 9 | 31 |
| Licenciatura | 40 | 14 | 26 |
| Total de entradas nos dois documentos | 80 | 23 | 57 |

São 35 objetivas e cinco discursivas por caderno. As 80 entradas correspondem a **50 conteúdos distintos**: Q1–Q26 e D1–D4 são comuns aos dois cadernos. Em 26 pares, os textos extraídos coincidem diretamente; em Q16, Q20, Q23 e Q26, coincidem após normalizar espaços e quebras. `duplicateOf` documenta esses 30 pares sem fundir documentos, páginas ou identidades oficiais.

O extrator havia classificado 13 itens do Bacharelado e 18 da Licenciatura como candidatos sem alerta, equivalentes a 19 conteúdos distintos. Todos esses 19 conteúdos tiveram páginas renderizadas e inspeção visual assistida, além de análise das alternativas e do gabarito. Quatro conteúdos comuns — Q8, Q12, Q13 e Q24 — receberam novas pendências conceituais ou contextuais, resultando em 23 entradas com `CONTENT_CHECKED` e 57 com `MANUAL_REQUIRED`.

`CONTENT_CHECKED` significa somente que esta análise assistida não acrescentou uma pendência de conteúdo. Não declara fidelidade humana, fonte conferida, comentário aprovado nem disponibilidade para estudantes. Todas as fontes permanecem sujeitas ao fluxo de conferência independente.

## Achados que exigem decisão editorial

| Questão, em ambos os cadernos | Resposta oficial preservada | Achado |
| --- | --- | --- |
| Q8 | D | II fala em consenso entre situação e oposição, sem usar “unanimidade”. A justificativa de sua exclusão precisa respeitar essa redação; não inventar uma exigência textual para explicar a chave. |
| Q12 | B | A abertura generaliza a vigência da LGPD como sendo desde o fim de 2018. Contextualizar a vigência escalonada do art. 65 e distinguir publicação, disposições relativas à autoridade, obrigações e sanções. O direito de eliminação também tem hipóteses e exceções legais. |
| Q13 | E | D permite o uso de um subsistema executável como protótipo, uma leitura plausível dependendo do sentido de protótipo evolutivo. A ambiguidade existe no PDF. Explicar a distinção no contexto da bibliografia antes de aprovar comentário definitivo. |
| Q24 | E | Um IV variável não equivale por si a uma chave nova nem impede sozinho a repetição de um ciphertext válido. Separar IV/nonce, derivação de chaves, integridade, autenticidade e mecanismos de rejeição de replay. A redação está no PDF, não foi criada pelo extrator. |

Esses achados não alteram a chave oficial, não escolhem outra alternativa nem declaram anulação. Uma interpretação técnica mais rigorosa deve aparecer como ressalva identificada e ser examinada por quem aprova o conteúdo.

## Fidelidade da extração e recursos ausentes

- **D3, ambos:** os símbolos impressos →, ∧, ∨ e ¬ foram extraídos como ®, Ù, Ú e Ø; a tabela-verdade precisa preservar colunas e linhas. A análise inclui resolução provisória, claramente distinta de rubrica oficial.
- **D5, Bacharelado:** Θ foi extraído como Q. Árvore, tabela, código e relação entre páginas precisam permanecer completos. O comentário “/a - arranjo, n - número de elementos */” já aparece defeituoso no PDF; acrescentar um asterisco seria correção editorial, não transcrição literal.
- **Discursivas:** os números 1–15 das linhas de rascunho vazam para o enunciado. Retirá-los após conferência, mantendo subitens e valores, e vincular o padrão de resposta antes de registrar rubrica. Nenhuma pontuação ou correção humana foi atribuída.
- **Q20, ambos:** o extrator cola as 26 linhas do código C e perde sua estrutura. Os glifos `funcaol`/`funcao1` e `m+l`/`m+1`, além de aspas tipográficas, exigem comparação cuidadosa com o próprio original. Não apresentar uma normalização silenciosa como conteúdo literal ou executar código retirado do PDF.
- **Q32, Bacharelado:** a indentação do quicksort distingue comandos dentro do laço da troca final do pivô. A extração perde essa estrutura. A pilha O(n) é um limite de pior caso, não espaço necessariamente linear em toda execução.
- **Q4/Q6 e Q32 da Licenciatura:** o “PORQUE” impresso aparece como `pORQuE` na extração. Algumas referências também perdem capitalização; registrar correções sem reescrever o texto-base.
- **Alertas visuais falsos positivos:** Q14 comum não contém figura; o alerta vem de “mapa” num exemplo de GPS. Q29 da Licenciatura cita “imagem” como exemplo de recurso; Q33 cita “imagem positiva”. As páginas correspondentes foram renderizadas e inspecionadas. D5 da Licenciatura tem quadro de rascunho, sem figura de conteúdo. As notas permitem ao curador resolver os alertas com evidência; a revisão assistida não apaga flags originais.
- **Q29 e Q33, Bacharelado:** o gabarito definitivo informa ANULADA. Manter fora de itens pontuáveis e não inferir um motivo de anulação. Q33 contém Prolog, apesar de não ter recebido o alerta `codigo` do extrator.

Figuras de Q2, Q3, Q5, Q11, Q16, Q17, Q21, Q22, Q23, Q27, Q28, Q29 e Q31 continuam pendentes de integração e/ou inspeção específica, conforme cada registro. Explicações deriváveis do texto não autorizam omitir uma imagem que pertence à questão. Em Q16, a explicação foi deixada vazia porque os rótulos extraídos não permitem reconstruir a topologia do circuito. Em Q31, não foi declarada simulação confirmada dos quatro/oito movimentos sem conferir o diagrama.

## Observações pedagógicas adicionais

As explicações distinguem capacidade de generalização de uma garantia de precisão em Q18; planejamento incremental de ausência de planejamento em Q15; capacidade elástica de tempo de disponibilidade em Q25; e os níveis de conteúdo, apresentação e navegação em Q26. Em Q27 do Bacharelado, a porcentagem de dois desvios-padrão depende da aproximação normal sugerida pelo histograma. Em Q28, BTB não elimina toda penalidade de desvio em condições reais.

Na Licenciatura, foram analisados separadamente avaliação digital (Q27), papéis no AVA (Q28), granularidade e reuso (Q29), avaliação em MOOCs (Q30), educação quilombola (Q31), Paulo Freire (Q32), Libras e inclusão (Q33), liderança escolar (Q34) e cidadania digital (Q35). O comentário de MOOCs descreve possibilidade de automação e necessidade de validação; não promete correção confiável de qualquer resposta discursiva. Erros gramaticais impressos como “de forma concomitantemente”, “que poder ser adotada” e “entres as crianças” foram identificados como pertencentes à fonte, sem alteração silenciosa.

## Evidência e limites

Foram lidos os 80 registros dos relatórios e comparados os dois cadernos. Inspeções visuais assistidas foram feitas nas páginas PDF do Bacharelado **5, 9, 11, 12, 13, 14, 17, 18, 19, 21, 22, 23, 24, 27, 28, 29, 33, 34, 35, 39, 41 e 43**, e da Licenciatura **17, 33, 34, 35, 36, 37, 38 e 39**. Os gabaritos definitivos de ambos os cadernos, página 1, também foram renderizados e lidos. São 30 páginas de prova e duas de gabarito, sem pretender que todas as páginas dos documentos tenham sido inspecionadas visualmente.

As cópias locais usadas foram comparadas por SHA-256 com o catálogo:

| Documento | SHA-256 |
| --- | --- |
| Prova Bacharelado | `0254b274cc4adddbb503cf18553ee70c26014cbb0848fe3c5b787c80137b11e8` |
| Gabarito Bacharelado | `62e5d3812e9b639a2590dad07c30f32d96367ed0d0e6450f0b0a753e023f475b` |
| Prova Licenciatura | `9537deb2d2d7f7e00eacd526a06b887e932fedf4b5e7abf9be6501138d561b72` |
| Gabarito Licenciatura | `92874d01d2cfc5f622abc3523ab91f7c6c60ba9eed18fb550479d4f391d6eae5` |

Os gabaritos preservam a identificação “GABARITO DEFINITIVO”. A igualdade de hash estabelece quais bytes foram analisados; não substitui conferência independente de autenticidade e correspondência da fonte. Não houve consulta externa às obras citadas nem validação jurídica/histórica integral dos textos-base. Os comentários e resoluções de discursivas são elaboração assistida identificada, não explicações produzidas pelo Inep. Nenhuma identidade humana, assinatura de curador ou decisão de publicação foi inventada.
