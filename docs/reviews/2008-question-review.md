# Revisão assistida do caderno de Computação de 2008

Autoria: Codex, análise assistida. **Não é revisão humana, aprovação editorial, conferência de fontes nem autorização de publicação.** O arquivo [2008-review.json](../../data/question-reviews/2008-review.json) preserva o identificador e o hash da prova em cada uma das 80 entradas. Não altera os gabaritos nem os PDFs.

## Escopo e resultado

A capa foi examinada e confirma que o caderno contém três percursos de curso. Para Ciência da Computação, respondem-se Q1–Q20, comuns aos três cursos, e Q21–Q40, específicas. Q41–Q60 pertencem à Engenharia de Computação; Q61–Q80, a Sistemas de Informação. A semelhança de assuntos não modifica essa procedência.

| Cobertura | Entradas | Sem nova pendência nesta análise | Revisão manual necessária |
| --- | ---: | ---: | ---: |
| Formação Geral, núcleo comum e bloco de Ciência da Computação, Q1–Q40 | 40 | 13 | 27 |
| Blocos de Engenharia e Sistemas de Informação, Q41–Q80 | 40 | 0 | 40 |
| Total | 80 | 13 | 67 |

Os 80 registros foram lidos para conferir numeração, escopo e preservação. A análise conceitual foi concentrada nas 40 entradas pertinentes ao percurso de Ciência da Computação. As outras 40 receberam identificação de assunto e pendências explícitas de escopo e revisão conceitual; não se declara que suas soluções foram aprovadas ou que houve inspeção visual de suas páginas de conteúdo.

Os itens `CONTENT_CHECKED` são **Q3, Q4, Q11, Q15, Q16, Q19, Q27, Q30, Q31, Q32, Q33, Q35 e Q37**. Esse estado indica apenas que a análise assistida não acrescentou uma pendência específica de conteúdo ou fidelidade. Não remove os alertas originais do extrator, não comprova gabarito definitivo e não torna o item publicável. São 71 objetivas e nove discursivas no caderno completo; os blocos pertinentes a CC contêm 35 objetivas e cinco discursivas.

O relatório bruto da entrega CNT-I1 foi a referência inicial. A reextração CNT-I2 recuperou a estrutura A–E de 70 das 71 objetivas e corrigiu a mistura de colunas em Q35–Q38, comparadas novamente à página PDF 15. Q35 e Q37 passaram à classificação sem nova pendência; Q36 conserva a ressalva sobre SSI, e Q38 continua com os cinco textos de alternativas vazios porque as fórmulas são gráficas. Q8 depende das alternativas visuais e permanece sem estrutura textual. Os problemas restantes de cabeçalhos, símbolos e recursos visuais seguem registrados; não se corrige redação por dedução a partir da chave.

## Achados de conteúdo que exigem contextualização

| Questão | Chave ou expectativa preservada | Achado |
| --- | --- | --- |
| Q12 | C, quatro caminhos | O grafo tem sete nós, nove arestas e três decisões binárias. O cycle rank do grafo subjacente conexo é `E−N+1=3`; a complexidade de McCabe é `E−N+2=4`. A redação “complexidade ciclomática mais um” pode usar a primeira convenção, mas não deve levar à aplicação de mais um sobre o valor de McCabe. A ressalva é terminológica; não se declara automaticamente um erro inequívoco nem outra resposta. |
| Q34 | A | A exclusão de III depende da leitura de “fase modificada durante o intervalo de sinalização”. Distinguir fase instantânea da onda de deslocamento de fase associado ao símbolo no modelo elementar de PSK. Preservar a chave e contextualizar os limites do modelo. |
| Q36 | A | A sigla `SSI` está impressa no original onde usualmente se utiliza `SSID`; sua ausência de D não é falha de extração. WEP pertence ao contexto histórico e não deve ser recomendado como proteção atual. RTS/CTS reduz riscos de colisão, sem garantia de eliminá-los em todo cenário. |
| Q40 | Padrão registrado: duas seleções unidas por UNION, usando renda>30000 | O diagrama original imprime `renda<30000`, mas a prosa, o SQL e o padrão de resposta usam `renda>30000`. A divergência está na fonte, não foi criada pelo extrator. Também é necessário distinguir a álgebra relacional de conjuntos da semântica de multiconjuntos do SQL: UNION somente de nome/endereço pode fundir clientes distintos com a mesma projeção. O JSON distingue a resposta didática esperada de uma variante assistida que preserva a chave nroCliente antes da projeção externa. Não se atribui essa ressalva como requisito adicional do padrão nem se promete que todo otimizador usará os índices. |

As explicações também preservam condições que evitam generalizações: ganho de paralelismo não é aceleração garantida (Q19); índice adequado não implica uso obrigatório no plano (Q21); Ethernet compartilhada com hub é o cenário de CSMA/CD (Q27); aumentar a amostra não garante intervalo menor se a variabilidade mudar (Q32); e a afirmação sobre recursão à esquerda em Q33 se refere aos métodos top-down usuais do contexto didático.

## Fidelidade e recursos que ainda precisam de preparação

- **Q1, Q2, Q5–Q8:** retratos, composição visual, fotografia, mapa, curva de Lorenz e obras de arte foram examinados. Precisam acompanhar a questão; legendas ou comentários não substituem as imagens. Em Q7, a leitura de 40% de renda para os 80% de menor renda leva ao complemento aproximado de 60%. Q8 tem alternativas visuais, não apenas títulos de obras.
- **Q9 e Q10:** separar rascunho, numeração de linhas e comandos. Q10 perde no texto linearizado o infográfico com 90% dos professores e 89% dos pais e anexa o cabeçalho do bloco seguinte. As propostas argumentativas são assistidas; o padrão específico de Computação catalogado não inclui essas duas discursivas de Formação Geral.
- **Q12:** os rótulos 1–7 do grafo foram intercalados na prosa; preservar o grafo e retirar somente os trechos intrusos confirmados.
- **Q13:** o cabeçalho do Componente Específico foi inserido entre D e E. E pertence à questão, embora esteja no topo da coluna direita. A partição correta é a formada pelos seis conjuntos unitários.
- **Q14:** o original usa λ, ≠ e ↑ no pseudocódigo. A referência extraída os transforma em 8 e …, além de perder as linhas. A alternativa E continua na página seguinte. Nenhum código retirado do PDF foi executado.
- **Q17 e Q18:** preservar ∃, ∀ e ⇒ e os sinais de menos da recorrência. Em Q17, o sentido existencial para universal é falso em geral; a afirmação inversa pressupõe domínio não vazio. Em Q18, quinze chamadas incluem a invocação inicial de fib(5); o resultado devolvido, cinco, é outra grandeza.
- **Q20:** a coluna de contexto foi misturada aos comandos A/B e às áreas de rascunho; o cabeçalho da página seguinte não pertence ao item. A solução assistida foi comparada ao padrão catalogado: colisões envolvem {44,49,90,95}, nas posições 21 e 3, e o desenho do padrão mantém cadeias [44,90] e [49,95]. Não se atribuiu nota.
- **Q21 e Q23:** preservar os grifos das chaves, em especial a chave composta de FonePessoa em Q23. Não inferir quais atributos são obrigatórios somente por seus nomes.
- **Q24–Q26 e Q28:** circuitos, imagens comparadas, árvore e tabela precisam de integração. As explicações usam as figuras efetivamente examinadas; não autorizam reconstruir conexões pela proximidade do texto bruto.
- **Q29 e Q39:** as setas e outros símbolos de gramática estão corrompidos. Separar a forma da gramática da classe da linguagem em Q29; em Q39, várias ordens de derivação não implicam várias árvores para uma mesma cadeia.
- **Q35–Q38:** a mistura de colunas da referência CNT-I1 foi corrigida e comparada novamente ao render na CNT-I2. Q38 ainda não tem as expressões lógicas das cinco alternativas. A análise visual da expressão correspondente à chave E não permite omitir a recuperação das outras quatro alternativas.
- **Q40:** conferir π/σ e o limite da questão; o cabeçalho de Engenharia na página PDF 18 não integra a discursiva anterior.

O gabarito registra **Q44 ANULADA**. Isso foi preservado no registro do bloco de Engenharia, sem escolha substituta ou hipótese sobre a causa de anulação.

## Fontes e inspeções efetivas

| Documento catalogado | SHA-256 | Inspeção visual assistida |
| --- | --- | --- |
| `enade-2008-comum-exam` | `5c8a08f7fdaccaa3b5661f40705e214bffdab634b845bce6288f8eeaa25db264` | Páginas PDF 1–18: capa, conteúdo do percurso de CC e limite do bloco seguinte |
| `enade-2008-comum-answer-key` | `707a326330c6982a9368957c6d9af1563b886d32d6c6720319faeb71803f2425` | Páginas PDF 1–2; o documento não apresenta o rótulo definitivo |
| `enade-2008-comum-response-standard` | `7021d115731ddcbad3c227da50f6d8c9c2c7f8a5a4b4d7dabce4b3726d0d35ef` | Páginas PDF 1–3, referentes a Q20, Q39 e Q40 |

As cópias locais foram comparadas aos hashes do catálogo. A numeração PDF inclui a capa e difere da numeração impressa no rodapé. Os renders ficaram em `.local/import-review/content-2008/`; não foram incluídos como imagens já prontas para publicação. O padrão de resposta apoia a explicação dessas três discursivas, mas não elimina a necessidade de conferir a fonte e aprovar a preparação editorial.

Não houve consulta externa às obras citadas, teste empírico de programas, execução do SQL do documento, atualização dos dados históricos ou conferência visual das páginas de conteúdo dos blocos de Engenharia/Sistemas de Informação. As 13 classificações sem nova pendência e as 67 pendentes são decisões de análise assistida, não assinaturas de curadores humanos.
