# Núcleo por área (NUC-1)

O que é preciso saber em cada área do ENADE de Ciência da Computação para **resolver** e para **cortar alternativas com segurança**. Pedido de Gabriel em 06/11/2026: o núcleo é a bússola da preparação. Mostra onde estudar e dá confiança área por área.

## 1. Onde está

| Parte | Arquivo |
| --- | --- |
| Conteúdo (16 áreas + Formação Geral) | `data/core-concepts/<área>.json` |
| Carga, validação e ligação às questões | `apps/api/src/core-concepts.ts` |
| Confiança e rotas `/api/core` | `apps/api/src/core-progress.ts` |
| Autoavaliação | migration `030_core_concepts.sql` (`core_concept_rating`) |
| Telas | `core-map.component.*` (mapa na Biblioteca) e `core-area.component.*` (página da área) |
| Testes | `tests/core-concepts.test.ts`, `tests/browser/core.spec.ts` |
| Lições por conceito (LIB-2) | `data/lessons/`, ver [LIBRARY-LESSONS.md](LIBRARY-LESSONS.md) |

## 2. Formato de uma área

Cada arquivo traz:

- `concepts`: de 6 a 13 conceitos essenciais. Cada um tem:
  - `definition`, a definição em uma linha;
  - `example`, um exemplo mínimo;
  - `match`, palavras-chave que ligam o conceito às questões oficiais.
- `facts`: fatos de referência que cortam alternativas (complexidades, hierarquias, fórmulas).
- `pairs`: pares que se confundem, com a diferença em uma frase.
- `cues`: pistas do enunciado, de palavra-chave para conceito (o `concept` precisa existir).
- `traps`: pegadinhas, cada uma classificada num dos sete padrões abaixo.
- `deck` e `sheet`: baralho de flashcards e ficha da mesma área, quando existem.
- `references`: bibliografia.

## 3. Os sete padrões de alternativa errada

São a base do "chute bem informado". Saber o conteúdo da área permite cortar a alternativa que não faz sentido.

| Código | Nome | Como cortar |
| --- | --- | --- |
| `VIZINHO` | Termo da área vizinha | Conceito real, mas de outro assunto: isso resolve este problema? |
| `PAR` | Par confundido | Lembrar a diferença entre os dois em uma frase |
| `INVERTIDA` | Relação invertida | Conferir a direção (inclusão, redução, ordem) |
| `GRANDEZA` | Ordem de grandeza | Comparar com a tabela de referência |
| `CONDICAO` | Condição esquecida | A afirmação só vale sob uma condição omitida |
| `ABSOLUTO` | Absoluto suspeito | "Sempre", "nunca", "garante": poucas são verdadeiras |
| `CAUSA` | Causa trocada | Na asserção-razão, duas verdades em que uma não explica a outra |

Contexto medido no acervo de 246 objetivas:
- cerca de 43% são de itens I, II, III e 11% de asserção-razão, formatos em que um item certo corta metade das alternativas;
- as letras do gabarito são equilibradas (17% a 22% cada), então chutar uma letra fixa não ajuda.

## 4. Ligação com as questões oficiais

- **De onde vêm as questões:** as ocorrências objetivas do inventário (`data/study-analysis/inventory.json`).
  - Entram as de Bacharelado e de cadernos comuns, válidas, de escopo CC e conferidas.
  - O id é `official-<sha12 da prova>-<qN>`, o mesmo da publicação assistida.
  - A tela recebe o id da versão publicada, porque é por ele que o estudo abre a questão.
- **Como casam:** um conceito casa com a questão quando uma das suas palavras-chave aparece no **início de uma palavra** do assunto conferido, sem acento e sem diferenciar maiúsculas.
- **O que o teste garante:** toda questão oficial da área cai em pelo menos um conceito. Hoje são 206 de 206.
  - Se o acervo ganhar questões, rode `npm test`. Se aparecer questão sem conceito, acrescente uma palavra-chave ou um conceito.
- **Conceito sem questão ligada:** a tela diz "sem questão ligada neste recorte do acervo", e não "nunca caiu": a ligação é por palavra-chave no assunto e só dentro da área.
- **Limite do casamento por palavra (revisão do Codex, R4):** cobrir 206 de 206 questões prova que toda questão encontrou uma palavra, não que a ligação esteja certa. Em 07/11 saíram "inserção" de ordenação (ligava a rotação de AVL de 2017 Q9) e "dígrafo" de grafos (ligava o Dijkstra de 2021 Q34, que já está em caminho mínimo). O próximo passo é conferir os vínculos item a item.
- **Caiu, mas não está publicada neste banco:** a tela mostra o ano e o assunto sem link (`appearances` com `id` nulo). "Ainda não caiu" aparece só quando o inventário não tem nenhuma questão do conceito. Antes de 07/11 a tela confundia os dois casos: num banco sem as oficiais publicadas, o deadlock (2017, Q35) aparecia como "ainda não caiu".

## 5. Confiança

A confiança vai de 0 a 100 e soma três sinais, cada um mostrado separado na tela:

- **40%, autoavaliação:** não sei = 0, mais ou menos = 1, sei explicar = 2. Conceito não marcado conta como 0.
- **40%, acerto na primeira resposta** às questões da área, a mesma contagem do "Meu desempenho".
  - Até 5 respostas, o acerto entra no índice proporcionalmente (1 resposta certa vale 20%), para um acerto isolado não dar confiança alta.
  - A tela mostra a taxa observada, sem essa atenuação, com o número de respostas ao lado (`observed` na API). Antes de 07/11 mostrava o valor atenuado com o nome "acerto", o que a revisão do Codex (R5) apontou como enganoso.
- **20%, lembrança estimada nos flashcards da área:** a recuperabilidade do FSRS hoje para cada cartão, que cai com o tempo desde a última revisão (`retrievability` em `fsrs.ts`). Cartão nunca visto conta 0.
  - Antes de 07/11 era a estabilidade dividida por 21 dias, que não caía com o tempo sem revisar (revisão do Codex, R6).
  - Área sem baralho: a autoavaliação e o acerto valem 50% cada.

**Prioridade no mapa:** peso histórico da área × (1 − confiança). As três maiores aparecem como "comece por aqui".

O índice é uma heurística para orientar o estudo, não uma previsão calibrada de desempenho. O peso é histórico (2005 a 2021), não previsão. A Formação Geral aparece à parte, sem prioridade, porque vale para todos os cursos e em 2026 tem 15 questões.

## 6. Conteúdo escrito por IA

O núcleo foi escrito pelo Claude a partir das questões oficiais e da bibliografia de cada área. **Ainda não teve revisão humana**, e a tela avisa. Uma revisão por professor é prioridade antes de divulgar amplamente.

## 7. Próximos incrementos (reta final até 29/11)

1. **Treino de eliminação.** Nas questões de itens e de asserção-razão, a pessoa marca V ou F em cada item, vê quais alternativas sobram e, depois do gabarito, qual conceito do núcleo resolveria.
2. **Questões geradas por IA**, autorizadas por Gabriel em 06/11. **Feito (lote 1, 120 questões)**: ver [GENERATED-QUESTIONS.md](GENERATED-QUESTIONS.md).
   - **Origem:** nova origem na curadoria, com o rótulo "Gerada por IA", fora das estatísticas oficiais e das provas.
   - **Tipos:** "espelho" (o mesmo conceito de uma questão oficial, em contexto novo) e "tema quente".
   - **Construção:** as alternativas erradas seguem os sete padrões de propósito.
   - **Conferência automática, sem segundo agente:**
     - nova resolução sem ver o gabarito;
     - execução do cálculo ou do código;
     - ligação a um conceito do núcleo.
3. **Temas quentes:**
   - IA generativa;
   - LGPD e regulação de IA;
   - segurança;
   - nuvem e microsserviços;
   - Pix e transações;
   - acessibilidade;
   - computação e meio ambiente;
   - desinformação.
4. **Plano até a prova:** o roteiro de cada dia, gerado a partir do mapa de confiança.
5. **Confiança da turma** para o professor, no painel da turma.
