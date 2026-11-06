# Como a cobrança do ENADE de Computação mudou (2005 a 2021)

Pedido de Gabriel em 06/11/2026: entender como as questões e as áreas mudaram de 2005 a 2021, para gerar questões melhores. Esta análise orienta os próximos lotes de [questões geradas](GENERATED-QUESTIONS.md) e a ênfase do [núcleo](CORE-CONCEPTS.md).

## 1. Base e limites

- **Recorte:** objetivas válidas do inventário (`data/study-analysis/inventory.json`):
  - escopo CC;
  - cadernos de Bacharelado e comuns;
  - texto de `data/question-reports/`.
- **Tamanho:** 160 questões de componente específico (CE) e 47 de Formação Geral (FG) em seis edições. São de 25 a 28 questões de CE por edição.
- **Leitura:** uma diferença de uma ou duas questões entre edições é ruído. Só tendências que se repetem em várias edições contam.
- **Como foi medido:** área e assunto vêm da classificação conferida por agente, não por professor.
- **Medidas por expressão regular:**
  - **itens:** linhas iniciadas por I, II, III ou a frase "estão certos apenas os itens";
  - **asserção:** "asserções" ou "PORQUE";
  - **código:** três ou mais sinais de código;
  - **comando de análise:** "avalie" ou "considerando".
- **Ruído:** a extração de 2005 e 2008 tem ruído de layout. A marca de figura dos relatórios não é confiável e ficou de fora.
- **Script:** recalcular com `python3` a partir dos dois arquivos acima. A tabela abaixo é a saída de 06/11.

## 2. Formato das questões por edição

| Edição | CE | Palavras no enunciado (mediana) | Itens I, II, III | Asserção-razão | Código | "Avalie"/"considerando" | Comando negativo (INCORRETA, EXCETO) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2005 | 28 | 136 | 50% | 0% | 7% | 14% | 7% |
| 2008 | 27 | 120 | 33% | 11% | 4% | 19% | 0% |
| 2011 | 26 | 121 | 46% | 8% | 4% | 35% | 4% |
| 2014 | 27 | 163 | 52% | 15% | 19% | 67% | 0% |
| 2017 | 27 | 143 | 37% | 19% | 37% | 63% | 11% |
| 2021 | 25 | **214** | 52% | 8% | 12% | **76%** | 4% |

Formação Geral, mesma medida:

| Edição | Palavras (mediana) | Itens | Asserção | "Avalie"/"considerando" |
| --- | ---: | ---: | ---: | ---: |
| 2005 | 72 | 0% | 0% | 0% |
| 2008 | 74 | 0% | 0% | 0% |
| 2011 | 177 | 25% | 12% | 38% |
| 2014 | 245 | 50% | 12% | 75% |
| 2017 | 165 | 38% | 0% | 50% |
| 2021 | **296** | 50% | **38%** | **88%** |

### O que mudou

1. **O enunciado ficou mais longo.**
   - No CE, a mediana subiu de cerca de 120 palavras (2005 a 2011) para 214 em 2021. Na FG, quadruplicou.
   - O modelo atual é:
     - texto-base com referência ("CORMEN et al., 2009, adaptado");
     - o código ou a situação;
     - o comando "Considerando…, avalie as afirmações" ou "assinale a opção".
2. **A virada é de 2014.**
   - A pergunta direta ("qual é o número mínimo de movimentos") deu lugar à situação para analisar. A partir de 2014, dois terços ou mais das questões pedem para avaliar algo apresentado.
3. **Os itens I, II, III não são novidade.**
   - Ficam entre um terço e metade das questões desde 2005, com a frase "Estão certos apenas os itens".
   - Por isso, saber julgar um item isolado sempre valeu metade da questão.
4. **A asserção-razão começa em 2008.**
   - No CE fica entre 8% e 19%. Na FG de 2021 chega a 38%.
5. **Código na prova:**
   - pico em 2017 (37%);
   - em 2021 aparece menos, mas em trechos longos (o heapify da Q D5 tem mais de 400 palavras com o código).
   - O código costuma ser C ou pseudocódigo e pede rastrear, corrigir ou analisar complexidade.
6. **O comando negativo quase sumiu.**
   - "INCORRETA" e "EXCETO" aparecem pouco depois de 2011. A banca prefere afirmações para julgar.

## 3. Áreas por edição (questões de CE)

| Área | 2005 | 2008 | 2011 | 2014 | 2017 | 2021 | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Algoritmos | 3 | 2 | 4 | 4 | 6 | 5 | 24 |
| Matemática | 3 | 4 | 4 | 5 | 2 | 1 | 19 |
| Arquitetura | 2 | 3 | 4 | 2 | 2 | 3 | 16 |
| Sistemas operacionais | 2 | 1 | 1 | 4 | 3 | 2 | 13 |
| Engenharia de software | 2 | 2 | 2 | 2 | 2 | 2 | 12 |
| Teoria da computação | 2 | 1 | 4 | 2 | 1 | 1 | 11 |
| Redes | 2 | 5 | 2 | 0 | 1 | 1 | 11 |
| Inteligência artificial | 2 | 2 | 1 | 1 | 2 | 2 | 10 |
| Programação | 1 | 0 | 3 | 3 | 1 | 0 | 8 |
| Banco de dados | 2 | 2 | 0 | 1 | 2 | 1 | 8 |
| Computação gráfica | 2 | 2 | 0 | 1 | 2 | 0 | 7 |
| Compiladores | 1 | 2 | 1 | 1 | 1 | 1 | 7 |
| Sociedade e ética | 2 | 1 | 0 | 0 | 0 | 1 | 4 |
| Sistemas distribuídos | 1 | 0 | 0 | 0 | 0 | 2 | 3 |
| IHC | 0 | 0 | 0 | 1 | 0 | 2 | 3 |
| Segurança | 0 | 0 | 0 | 0 | 2 | 1 | 3 |

### O que mudou em cada área

- **Algoritmos sobe:**
  - de 2 a 4 questões até 2014 para 5 e 6 depois;
  - o assunto passou de contar (Hanói, comparações da busca binária) para grafos e estruturas;
  - Kruskal ou Dijkstra caíram em 2014, 2017 e 2021;
  - árvore binária de busca e percursos caíram em 2011, 2014 e 2021;
  - em 2017 há uma questão de achar o erro numa ordenação por inserção.
- **Matemática cai e muda de assunto:**
  - de 4 a 5 questões até 2014 para 2 em 2017 e 1 em 2021;
  - até 2011 cobrava combinatória, estatística e grafos;
  - em 2014, 4 das 5 eram de lógica (validade, modus tollens, predicados);
  - em 2021, só distribuição normal.
  - A lógica continua a parte mais estável da área.
- **Redes encolhe e sobe de camada:**
  - 2008 teve 5 questões de camada física e enlace (modulação, CSMA/CD, múltiplo acesso, 802.11);
  - de 2014 em diante, 0 ou 1 questão por edição, sobre transporte e dispositivos de interconexão.
- **Engenharia de software:** exatamente 2 questões por edição, de RUP e gerência de configuração (2005, 2008) para padrões de projeto (2011, 2017) e Scrum (2017, 2021).
- **IA troca busca por aprendizado:**
  - de 2005 a 2011: A*, busca cega e heurística, representação de conhecimento;
  - em 2021: aprendizado supervisionado e não supervisionado, e redes neurais profundas;
  - o A* sumiu depois de 2011, mas continua base de IA clássica.
- **Banco de dados sai do físico para o modelo:**
  - índices B+, hash e otimização de consultas em 2005 e 2008;
  - SQL (NOT IN, JOIN), normalização e mapeamento ER em 2014 a 2021.
- **Áreas que entram tarde:**
  - Segurança desde 2017 (homem no meio, engenharia social, criptografia com hash e IV em mensageria);
  - IHC desde 2014 (usabilidade, personas, interfaces adaptativas);
  - nuvem em 2021, na volta de Sistemas distribuídos (que em 2005 tratava de RPC).
- **Programação some em 2021:**
  - paradigmas, escopo e Prolog apareceram de 2005 a 2017;
  - em 2021 o código ficou dentro das questões de Algoritmos.
- **Formação Geral:** texto longo com dado, gráfico ou charge, e afirmações para julgar. Os temas são direitos humanos, ambiente, tecnologia e sociedade.

## 4. O que muda na geração das próximas questões

Comparação com o lote 1 (120 questões):

| Medida | ENADE 2021 | Lote 1 | Ajuste |
| --- | ---: | ---: | --- |
| Palavras no enunciado do CE (mediana) | 214 | **58** | Texto-base de 120 a 200 palavras com referência ou cenário, depois o comando |
| Palavras na FG (mediana) | 296 | **64** | Texto-base de 200 a 300 palavras, com fonte e dado ilustrativo marcado |
| "Avalie"/"considerando" | 76% | 20% | Mais questões que pedem julgar o que foi apresentado |
| Comando negativo | 4% | 0% | Manter raro |

O lote 1 é curto de propósito para estudo rápido, mas treina pouco a leitura longa da prova. Os próximos lotes devem:

1. **Começar por texto-base.**
   - O texto apresenta o conceito com a referência da bibliografia do núcleo ("TANENBAUM, 2010, adaptado").
   - Depois vem a situação e, por último, o comando que pede aplicar.
2. **Usar código mais longo nas áreas de código.**
   - São 15 a 30 linhas em C ou pseudocódigo, a pergunta pede rastrear, corrigir ou dar a complexidade.
   - O código é executado de verdade na conferência.
3. **Priorizar o que voltou a cair:**
   - Dijkstra, Kruskal e Prim;
   - árvores de busca e percursos;
   - recursão e recorrências;
   - Scrum e padrões de projeto;
   - SQL com nulos e junções;
   - normalização;
   - lógica (validade, contrapositiva);
   - escalonamento e paginação;
   - aprendizado de máquina.
4. **Cobrir as áreas novas com o mecanismo técnico:**
   - Segurança: criptografia aplicada, ataques de rede;
   - IHC: avaliação e acessibilidade;
   - Distribuídos: nuvem, consistência.
5. **Não exagerar em Redes de camada física nem em Matemática de contagem.** As duas perderam espaço desde 2014. Manter lógica e probabilidade básica.
6. **Na FG:**
   - asserção-razão e afirmações sobre um texto longo com gráfico ou tabela;
   - a charge, comum na prova, pode entrar como imagem sem falas (ver [IMAGE-PROMPTS.md](IMAGE-PROMPTS.md)).

O peso de cada área é histórico. A portaria de 2026 (Portaria Inep 157/2026) e a nota técnica podem mudar a ênfase; conferir assim que o texto estiver disponível.
