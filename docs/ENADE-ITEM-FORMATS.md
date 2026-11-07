# Formatos de questão do ENADE e como reproduzi-los (GEN-4)

Pedido de Gabriel em 07/11/2026: mapear os formatos que o ENADE usa, com atenção às edições mais recentes (2017 e 2021), para o banco gerado ter a mesma variedade. Complementa [ENADE-EVOLUTION.md](ENADE-EVOLUTION.md) (tamanho e áreas) e [GENERATED-QUALITY-AUDIT.md](GENERATED-QUALITY-AUDIT.md) (pistas da resposta).

## 1. Base

- **Questões:** 207 objetivas oficiais de CC, válidas, de cadernos de Bacharelado e comuns, de 2005 a 2021.
- **Classificação:** pelo comando final e pela forma das alternativas, com expressões regulares; exemplos conferidos à mão.
- **Uma questão pode ter mais de uma marca.** Por exemplo, código e itens ao mesmo tempo.
- **Contagens aproximadas:** a extração das edições antigas tem ruído.

## 2. Duas dimensões, não uma

O formato do ENADE tem duas partes independentes. Hoje o banco gerado registra só a primeira (`format`).

1. **Forma de responder:** como as alternativas são montadas.
2. **Estímulo:** o que o enunciado traz para analisar, como texto, código, tabela, gráfico, figura, dois textos ou cenário.

## 3. Formas de responder

| Forma | Como é | Onde aparece | No lote 1 |
| --- | --- | --- | --- |
| **Itens com 3 afirmações** | "Avalie as afirmações", depois "É correto o que se afirma em" | 2011–2021, a mais comum desde 2014 | Sim, mas com alternativas fora do padrão |
| **Itens com 4 afirmações** | "É correto apenas o que se afirma em" | 2011–2021; 12 em 2021 | Sim, com o mesmo problema |
| **Asserção-razão** | Asserção I, PORQUE, asserção II e 5 alternativas fixas | Desde 2008, 3 a 5 por edição no CE | 16, concentradas em A |
| **Simples** | Uma correta entre cinco frases | Todas as edições, cada vez menos | 80 |
| **Sequência ou ordem** | A ordem correta de passos, mensagens, estados ou chamadas | 2011 (ARP, DNS, TCP, HTTP), 2017, 2021 | Não há |
| **Valor calculado** | Cinco números, um certo | Todas; mais em 2008 (chamadas de Fibonacci) | Poucas |
| **Alternativas em código** | Cinco trechos (SQL, expressões), um produz o pedido | 2008, 2014, 2017, 2021 ("qual código SQL exibe…") | Não há |
| **Associação** | Ligar itens de duas colunas, ou figuras a um texto | Raro no CE; aparece na FG ("as figuras referidas no fragmento são") | Não há |
| **Contagem de itens** | "Julgue os itens", depois "Apenas um item está certo", "Apenas os itens I e IV estão certos"… "Todos os itens estão certos" | 2005 e 2008 (estilo Cespe) | Não há; formato antigo |
| **Comando negativo** | "INCORRETA", "EXCETO" | Raro (5 no total) | Não há; manter raro |

### 3.1 As alternativas são fixas: isso já corta a pista do tamanho

Nas questões de itens e de asserção-razão da prova, **as alternativas não são escritas para cada questão**. Elas seguem um molde fixo.

**Itens com 3 afirmações** (2014–2021), sempre nesta ordem:

```
A) I, apenas.
B) II, apenas.
C) I e III, apenas.
D) II e III, apenas.
E) I, II e III.
```

O conjunto muda um pouco entre provas (às vezes entra "III, apenas" ou "I e II, apenas"). A regra que se mantém:
- as alternativas vão das menores combinações para as maiores;
- dentro do mesmo tamanho, seguem a ordem crescente;
- todas têm "apenas", menos a que lista todos os itens.

**Itens com 4 afirmações:** o mesmo princípio. Por exemplo, "I.", "IV.", "I e III.", "II e III.", "II e IV.", ou com "apenas".

**Asserção-razão:** a redação é sempre a mesma, nesta ordem.

```
A) As asserções I e II são proposições verdadeiras, e a II é uma justificativa correta da I.
B) As asserções I e II são proposições verdadeiras, mas a II não é uma justificativa correta da I.
C) A asserção I é uma proposição verdadeira, e a II é uma proposição falsa.
D) A asserção I é uma proposição falsa, e a II é uma proposição verdadeira.
E) As asserções I e II são proposições falsas.
```

O comando é "avalie as asserções a seguir e a relação proposta entre elas" e termina em "A respeito dessas asserções, assinale a opção correta". As provas de 2008 e 2011 usavam "A primeira asserção / a segunda", com o mesmo sentido.

**O que o lote 1 faz diferente:** as alternativas de itens são combinações escolhidas a dedo, fora de ordem e sem "apenas" (por exemplo, "I e II.", "I, II e III.", "III e IV.", "I, II e IV.", "II e IV."). Por isso a certa aparece como "a combinação maior que inclui o I". Com o molde fixo:
- quem decide a letra é só o valor de verdade de cada afirmação;
- o tamanho deixa de servir de pista.

### 3.2 O padrão difícil da asserção-razão: resposta B

A resposta B ("as duas verdadeiras, mas a II não justifica a I") é a que mais derruba quem estuda pela metade. Como montar:

- **Duas verdades do mesmo assunto, sem relação de causa.**
  - Exemplo: "I. O UDP é preferido em chamadas de voz em tempo real PORQUE II. O UDP usa números de porta para identificar a aplicação de destino."
  - As duas são verdadeiras, mas o motivo é não haver retransmissão nem espera, e não as portas (o TCP também usa portas).
- **Uma verdade e uma consequência dela, na direção errada.** Se a II é consequência da I, e não a causa, a resposta é B.
- **Duas verdades, a II é condição necessária mas não suficiente.** Explicar na resolução por que não basta.

Nas outras respostas:
- **C:** a I é verdadeira e a II troca o mecanismo (padrão `PAR` ou `INVERTIDA` do núcleo).
- **D:** a I traz um absoluto falso e a II é um fato correto.
- **E:** as duas erram, cada uma por um padrão diferente.

### 3.3 Itens: como o ENADE escolhe as afirmações

- **3 ou 4 afirmações**, cada uma testando um ponto diferente do mesmo estímulo. Por exemplo:
  - a saída do programa;
  - a complexidade;
  - a estratégia (recursiva ou iterativa);
  - uma propriedade.
- **Em código, uma das afirmações costuma ser o resultado exato da execução.** Em 2021: "O resultado da impressão na linha 24 é: 7 - 7".
- **A afirmação falsa erra por um detalhe técnico** (pior caso, estratégia iterativa ou recursiva), e não por absurdo.
- **Distribuição medida na resposta certa:** 1 item em 16%, 2 em 51%, 3 em 25%. O item I é verdadeiro em 65%.

## 4. Estímulos

| Estímulo | Medida | Exemplo |
| --- | --- | --- |
| **Cenário profissional** | Cerca de um terço das questões | Empresa, equipe, sistema, cliente, com um problema a resolver |
| **Texto-base com referência** | Maioria desde 2014 | Trecho adaptado de livro (Tanenbaum, Cormen) e depois o comando |
| **Código** | 9 em 2017, menos em 2021 mas longo | C ou pseudocódigo com linhas numeradas, citadas nas afirmações |
| **Tabela** | Frequente em BD e SO | Tabela de dados para normalizar; tabela de processos com chegada e duração |
| **Figura ou diagrama** | Frequente; a marca automática não é confiável | Grafo, circuito, árvore, decodificador com tabela |
| **Gráfico ou infográfico** | Comum na FG | Dados de pesquisa com fonte |
| **Dois textos** | FG de 2021 (4 questões) | "Texto I" e "Texto II"; a pergunta trata da relação entre eles |
| **Charge ou foto** | FG | Leitura da imagem junto com um texto |

**Combinações típicas de 2017 e 2021:**
- código, com itens sobre saída, complexidade e estratégia;
- cenário de empresa, com itens sobre a melhor decisão técnica;
- texto-base de livro com asserção-razão sobre o mecanismo;
- tabela, com "qual consulta SQL produz o resultado" (alternativas em código);
- dois textos, com asserção sobre a relação entre eles (FG).

## 5. Proposta para o banco gerado

### 5.1 Modelo de dados

- **`format`, forma de responder:**
  - `SIMPLES`;
  - `ITENS3`;
  - `ITENS4`;
  - `ASSERCAO`;
  - `ORDEM`;
  - `CALCULO`;
  - `CODIGO_OPCOES`;
  - `ASSOCIACAO`.
- **`stimulus`, estímulo (lista):**
  - `TEXTO_BASE`;
  - `CENARIO`;
  - `CODIGO`;
  - `TABELA`;
  - `FIGURA`;
  - `GRAFICO`;
  - `DOIS_TEXTOS`;
  - `CHARGE`.
- **Na migração:** `ITENS` vira `ITENS3` ou `ITENS4` pelo número de afirmações. O valor só muda nos arquivos de dados; a tabela `generated_question` aceita o novo conjunto numa migration curta.

### 5.2 Travas no validador

- **`ITENS3`, `ITENS4` e `ASSERCAO`:** as alternativas precisam ser exatamente um dos moldes oficiais da seção 3.1. O validador gera o molde, e o arquivo só informa quais afirmações são verdadeiras e, na asserção, se a II justifica a I.
  - A letra passa a ser calculada, e não escrita à mão.
  - Isso elimina erro de letra (como o do relógio de Lamport no lote 1) e a pista do tamanho.
- **`ORDEM`:** as cinco alternativas são permutações da mesma lista.
- **`CALCULO`:** valores distintos; a explicação diz de que erro vem cada valor errado.
- **`CODIGO_OPCOES`:** todas as opções executadas na conferência, com a saída de cada uma registrada no `check`.

### 5.3 Mistura alvo de um lote (base 2017–2021)

| Forma | Parte do lote |
| --- | ---: |
| Itens (3 ou 4 afirmações) | 40% |
| Simples | 25% |
| Asserção-razão | 15%, com B e E presentes |
| Sequência ou ordem | 7% |
| Valor calculado | 7% |
| Alternativas em código | 4% |
| Associação | 2% (FG e IHC) |

| Estímulo | Parte do lote |
| --- | ---: |
| Cenário profissional | pelo menos 35% |
| Código com linhas numeradas | 20% (Algoritmos, Programação, SO, Compiladores) |
| Tabela | 10% |
| Figura em SVG | 10% (ver [IMAGE-PROMPTS.md](IMAGE-PROMPTS.md)) |
| Dois textos | metade das questões de FG |

### 5.4 Exemplos de cada forma a escrever primeiro

- **`ORDEM`:**
  - sequência de mensagens ao abrir uma página com cache vazio (ARP, DNS, TCP, TLS, HTTP);
  - estados de um processo ao fazer E/S;
  - fases de um compilador para um erro dado.
- **`CODIGO_OPCOES`:**
  - cinco consultas SQL, uma lista os clientes sem pedido (NOT EXISTS, LEFT JOIN … IS NULL, NOT IN com nulo);
  - cinco versões de um laço, uma sem erro de limite.
- **`CALCULO`:**
  - tempo médio de espera em Round-Robin com quantum dado;
  - número de chamadas de uma recursão;
  - endereço de rede e broadcast de uma sub-rede.
- **`ASSERCAO` com resposta B:** UDP em voz (portas não são o motivo), índices (B+ e hash) e criptografia (assinatura e confidencialidade).
- **`ITENS4` sobre código:** uma função em C de 20 linhas com afirmações sobre saída, pior caso, recursão e efeito colateral.
- **FG com dois textos:** uma notícia e um trecho de lei, com asserção sobre a relação entre eles.
- **`ASSOCIACAO`:** heurísticas de Nielsen ligadas a falhas de interface descritas.

## 6. Ordem de trabalho (próxima sessão)

1. Validador com moldes fixos e letra calculada; migração do lote 1 para `ITENS3`/`ITENS4` (as letras mudam, então gera versão nova).
2. Revisão das pistas de [GENERATED-QUALITY-AUDIT.md](GENERATED-QUALITY-AUDIT.md) nas questões simples.
3. Aumento das cerca de 45 questões escolhidas, já com estímulos variados.
4. Novo lote com as formas que faltam (ordem, cálculo, código nas alternativas, associação, dois textos), na mistura da seção 5.3.
