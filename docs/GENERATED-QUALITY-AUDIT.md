# Auditoria das questões geradas: pistas da resposta e tamanho (GEN-3)

Pedido de Gabriel em 06/11/2026: a alternativa certa das questões geradas se entrega pelo tamanho, e o enunciado é curto demais perto da prova. Este documento mede o problema, compara com as oficiais e define as regras e travas da revisão do lote 1, a ser feita na próxima sessão.

## 1. O que foi medido

- **Base:** as 120 geradas (`data/generated-questions/`) e 203 objetivas oficiais de CC com gabarito e 5 alternativas legíveis (`data/question-reports/`).
- **Scripts:** em Python, a partir desses arquivos. Serão incorporados ao `npm test` como trava (seção 4).
- **"Chutador esperto":** escolhe a alternativa com mais palavras; no empate, a com mais vírgulas; depois, a com mais itens romanos. Não lê o enunciado.

### 1.1 A certa é a mais longa

| Medida | Geradas | Oficiais |
| --- | ---: | ---: |
| Certa é a mais longa, sem empate (todas) | **39%** | 3% |
| Certa é a mais longa, sem empate (simples) | **58%** | 3% |
| Certa entre as mais longas, contando empates (simples) | **90%** | 47% (todas, quase sempre por empate) |
| Razão tamanho da certa ÷ média das erradas (simples, mediana) | **1,56** | 1,00 |
| Certa com mais vírgulas, sem empate (simples) | **41%** | 2% |
| Certa com mais palavras do enunciado, sem empate (simples) | **24%** | 5% |
| Acerto do "chutador esperto" nas simples | **66%** | 15% |
| Acerto do "chutador esperto" no total | **49%** | 16% |

O acaso é 20%. Nas oficiais, o tamanho não ajuda (15%, até abaixo do acaso). Nas geradas, duas em cada três questões simples saem sem ler o enunciado.

**Causa:** o modelo escreve a certa com cuidado (condição, ressalva, motivo) e as erradas como frases curtas e secas. A literatura descreve o mesmo padrão em questões escritas por IA e por professores (seção 3).

### 1.2 Itens I, II, III

| Medida | Geradas (24) | Oficiais (89) |
| --- | ---: | ---: |
| Certa com 1 item verdadeiro | **0%** | 16% |
| Com 2 itens | 29% | 51% |
| Com 3 itens | **71%** | 25% |
| Item I verdadeiro | **92%** | 65% |
| Item II verdadeiro | 79% | 51% |
| Gabarito "I, II e IV" | **11 de 24** | variado |

**Pista:** "marque a combinação com mais itens, que contenha o I" acerta quase sempre. O modelo tende a escrever primeiro as afirmações verdadeiras e deixar a falsa para o fim.

### 1.3 Asserção-razão

| Gabarito | Geradas (16) | Oficiais (15) |
| --- | ---: | ---: |
| A (verdadeiras, a II justifica a I) | **50%** | 33% |
| B (verdadeiras, sem justificativa) | 6% | 0% neste recorte |
| C, D | 44% | 40% |
| E (ambas falsas) | **0%** | 27% |

**Pista:** "na dúvida, A" acerta metade.

### 1.4 Outras medidas

- **Letras do gabarito:** A 22, B 24, C 28, D 31 e **E 15**. O E fica abaixo do esperado e o D acima.
- **Palavras de ressalva** ("pode", "tende", "geralmente"):
  - geradas: 11% nas certas contra 3% nas erradas;
  - oficiais: 5% contra 2%;
  - é uma pista leve, que segue a regra "a absoluta é falsa".
- **Absolutos** ("sempre", "nunca", "garante"): 10% nas certas e 13% nas erradas. Não chegam a ser pista.
- **Respostas numéricas:**
  - a certa é a mediana dos valores em 6 de 12 questões;
  - nas oficiais, em 4 de 8;
  - a amostra é pequena; vale variar os valores para os dois lados.

### 1.5 Tamanho do enunciado

- **Geral:** mediana de 58 palavras, contra 214 no componente específico de 2021 ([ENADE-EVOLUTION.md](ENADE-EVOLUTION.md)).
- **Mais curtas:**
  - Matemática (33);
  - Arquitetura (41);
  - Compiladores (50);
  - Teoria (48);
  - IHC (49).
- **Formação Geral:** 64 palavras, contra 296 em 2021.

## 2. Outros padrões de questão escrita por IA a evitar

Da literatura sobre falhas de redação de itens (Haladyna e Downing; lista do NBME) e de estudos com questões geradas por modelo:

1. **Certa mais longa e mais detalhada.** A regra clássica é que a certa não deve ser a mais longa. Num banco de questões geradas por IA, a certa era a única mais longa em mais de 55% dos casos.
2. **Ressalva só na certa, absoluto só nas erradas.** O mesmo estudo achou "always" só nas erradas e "may" só nas certas.
3. **Convergência.** As erradas são variações da certa, então a certa é a que tem mais elementos em comum com as outras.
4. **Pista gramatical.** Uma alternativa não concorda com o enunciado (gênero, número, regência). Aparece mais nas erradas, onde quem escreve presta menos atenção.
5. **Eco do enunciado.** A certa repete as palavras do enunciado.
6. **Errada absurda.** Uma alternativa de outro assunto, tão distante que ninguém escolhe. Vira 4 alternativas em vez de 5.
7. **Estilo diferente entre certa e erradas.** Quando a certa e as erradas são escritas de formas diferentes, um modelo acerta só pelas alternativas, sem o enunciado. O estudo recomenda medir esse "acerto só pelas alternativas".
8. **Viés de posição.** Letras desequilibradas; em questões médicas geradas por IA, a letra A aparecia menos.
9. **Combinação de itens previsível e asserção-razão concentrada em A** (medido acima).

## 3. Fontes

- Haladyna, Downing e Rodriguez (2002), via síntese em [Testwiseness and Guessing (KU)](https://specialconnections.ku.edu/assessment/quality_test_construction/teacher_tools/testwiseness_and_guessing) e [Faculty Focus](https://www.facultyfocus.com/articles/educational-assessment/seven-mistakes-avoid-writing-multiple-choice-questions/).
- Lista de falhas do NBME e efeito das pistas: [Springer, Perspectives on Medical Education](https://link.springer.com/content/pdf/10.1007/s40037-015-0212-x.pdf) e [Educational Technology Journal, tabela 1](https://educationaltechnologyjournal.springeropen.com/articles/10.1186/s41239-018-0124-z/tables/1).
- Viés de tamanho medido em questões geradas: [FormationEval](https://arxiv.org/pdf/2601.02158).
- Alerta sobre questões médicas geradas por IA: [NUS, Hidden pitfalls in AI-generated MCQs](https://medicine.nus.edu.sg/taps/?p=73257).
- Acerto só pelas alternativas: [Balepur et al., ACL 2024](https://arxiv.org/pdf/2402.12483).

## 4. Plano da revisão (próxima sessão)

### 4.1 Regras de escrita das alternativas

1. **Escrever as cinco no mesmo molde:**
   - mesma estrutura gramatical, mesmo nível de detalhe;
   - se a certa tem condição ou motivo, as erradas também têm, com a condição ou o motivo errado;
   - vale passada final para igualar o tamanho.
2. **Variar quem é a mais longa:**
   - em parte das questões, a certa é a mais curta ou a do meio;
   - pelo menos uma errada longa e bem escrita por questão.
3. **Ressalvas e absolutos nos dois lados:**
   - há certas com "sempre" quando é verdade (por exemplo, "toda linguagem regular é livre de contexto");
   - há erradas com "pode" quando a possibilidade não existe.
4. **Erradas também usam as palavras do enunciado.** Nenhuma alternativa de assunto distante: o padrão `VIZINHO` precisa ser plausível para quem estudou pela metade.
5. **Contra a convergência:** as erradas vêm de erros diferentes, e não de pequenas mudanças na certa.
6. **Itens I, II, III:**
   - a falsa pode ser qualquer uma, inclusive a I;
   - a distribuição alvo é a das oficiais: certa com 1 item cerca de 15%, com 2 cerca de 50%, com 3 cerca de 30%;
   - "todas" fica raro.
7. **Asserção-razão:**
   - A até 30%;
   - B pelo menos 20%, o padrão difícil;
   - E presente.
8. **Letras:** cerca de 20% cada, com o E subindo.
9. **Numéricas:** as erradas vêm de erros reais de conta (somar um a mais, fórmula trocada), dos dois lados do valor certo.

### 4.2 Travas automáticas no `npm test` (`generated-publication.ts` e teste)

- **Por questão (simples):** a certa não pode ser mais de 15% maior que a maior errada.
- **No banco, por formato:**

  | Medida | Limite |
  | --- | --- |
  | Certa única mais longa | até 20% |
  | Certa única mais curta | até 20%, para não inverter a pista |
  | Acerto do "chutador esperto" | até 25% |
  | Item I verdadeiro nas de itens | até 70% |
  | Asserção com gabarito A | até 35% |
  | Cada letra do gabarito | entre 15% e 25% |

- **Na conferência de cada questão:** registrar no `check` a tentativa de responder só pelas alternativas, sem o enunciado. Se a resposta sair com segurança, reescrever.

### 4.3 Tamanho: aumentar parte das questões, não todas

**Alvo do banco:**

| Faixa | Parte do banco | Uso |
| --- | --- | --- |
| Curtas, até 80 palavras | cerca de um terço | Revisão rápida |
| Médias, de 100 a 160 palavras | cerca de um terço | Situação e comando |
| Longas, de 180 a 300 palavras | cerca de um terço | Molde da prova: texto-base com referência, mais código, tabela ou cenário, mais "Considerando…, avalie" |

**Candidatas a crescer (cerca de 45 de 120)**, escolhidas pelo que voltou a cair na prova e pelas áreas de código:

- **Algoritmos:**
  - `dijkstra-ordem`;
  - `heap-insercao`, com código de heapify, como em 2021;
  - `abb-degenerada`;
  - `recorrencias`;
  - `lcs`;
  - `ordenacao-propriedades`.
- **SO:**
  - `condicao-corrida`;
  - `produtor-consumidor`;
  - `sjf-espera`;
  - `belady`;
  - `deadlock-ordem`.
- **Banco de dados:**
  - `not-in-null`;
  - `left-join-where`;
  - `normalizacao-pedido`;
  - `er-n-n`;
  - `reserva-concorrente`.
- **Arquitetura:**
  - `pipeline-conflitos`;
  - `cache-endereco`;
  - `localidade`;
  - `amdahl`.
- **Redes:**
  - `abrir-pagina`;
  - `sub-redes`;
  - `http3-quic`.
- **IA:**
  - `precisao-revocacao`;
  - `vazamento-dados`;
  - `rag`;
  - `curva-aprendizado`.
- **Segurança:**
  - `hibrida`;
  - `injecao-sql`;
  - `aviso-certificado`.
- **Engenharia de software:**
  - `padroes-cenarios`;
  - `entrega-continua`.
- **Teoria e Compiladores:**
  - `classes-linguagens`;
  - `direcao-reducao`;
  - `first`;
  - `ambiguidade`.
- **Distribuídos:**
  - `cap-regioes`;
  - `pix-idempotencia`;
  - `lamport`.
- **Formação Geral:** as 10 questões, para 200 a 300 palavras com texto e dado.

**Cuidados na revisão:**
- O `id` não muda.
- O conteúdo novo vira versão nova, e as respostas antigas ficam ligadas.
- Cada questão reescrita refaz a resolução sem gabarito e a execução do código ou da conta.
