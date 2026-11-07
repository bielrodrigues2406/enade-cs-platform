# Lições da Biblioteca (LIB-2)

Pedido de Gabriel em 07/11/2026: além das questões novas, uma Biblioteca com material denso e completo. Este é o piloto do PR D de [PLANO-RETA-FINAL.md](PLANO-RETA-FINAL.md), com Algoritmos e Sistemas operacionais. As outras 15 áreas vêm no PR F, depois que Gabriel aprovar o formato.

## 1. Onde está

| Parte | Arquivo |
| --- | --- |
| Lições (uma área por arquivo) | `data/lessons/<slug da área>.json` |
| Carga e validação | `apps/api/src/core-lessons.ts` |
| Rota | `GET /api/core/:slug/lessons/:concept` em `core-progress.ts` ([API.md](API.md)) |
| Tela | `core-lesson.component.*`, aberta pela página da área (`core-area.component.*`) |
| Testes | `tests/core-lessons.test.ts`, `tests/browser/core-lessons.spec.ts` |

Os nomes `lessons.ts` e `lessons.spec.ts` já são de turmas e aulas (AULA-1); por isso aqui é `core-lessons`.

## 2. Uma lição por conceito do núcleo

Cada lição corresponde a um conceito de [CORE-CONCEPTS.md](CORE-CONCEPTS.md) e tem:

1. **Explicação:** de 4 a 8 parágrafos curtos, com definição, funcionamento, por que importa e limites.
2. **Exemplo resolvido:** título, código opcional, passos e o campo `check`, que diz o que foi executado para conferir. O `check` aparece na tela como "Conferido:".
3. **Erro comum:** o que confunde, ligado aos padrões de pegadinha do núcleo.
4. **Como cai no ENADE:** a tela usa as questões oficiais e geradas que o núcleo já liga ao conceito. Conceito que nunca caiu aparece como fundamento da área.
5. **Figura** (opcional): metáfora do catálogo (`/illustrations/MET-*.webp`, com a legenda "Ilustração gerada por IA") ou SVG exato (`/figures/*.svg`).
6. **Para fixar:** 2 ou 3 perguntas com a resposta escondida.

A área ganha a capa do catálogo (`cover`), o botão "Ler as N lições" e um "Ler a lição" em cada conceito. A lição tem anterior e próxima, na ordem do núcleo, e volta ao cartão do conceito.

**Endereço (R9 da revisão do Codex):** a Biblioteca guarda o lugar no caminho, então recarregar, compartilhar o link e usar Voltar/Avançar não perdem a leitura.

| Caminho | Mostra |
| --- | --- |
| `/biblioteca` | mapa do núcleo e fichas |
| `/biblioteca/<área>` | página da área, por exemplo `/biblioteca/sistemas-operacionais` |
| `/biblioteca/<área>/<conceito>` | lição, por exemplo `/biblioteca/sistemas-operacionais/so-deadlock` |
| `/biblioteca/fichas/<ficha>` | ficha de uma página, por exemplo `/biblioteca/fichas/grafos` |

O shell (`main.ts`) é o dono do histórico: a Biblioteca recebe o caminho em `address` e pede mudanças por `navigate`; `parseLibraryPath`/`libraryPath` ficam em `study-navigation.ts`. Conceito sem lição no endereço volta para a área sem criar entrada no histórico. Testes: `tests/library-address.test.ts` e os casos de endereço em `tests/browser/core-lessons.spec.ts`.

## 3. Formato do arquivo

```json
{
  "slug": "sistemas-operacionais",
  "cover": "/illustrations/CAPA-SO.webp",
  "author": "claude-geracao",
  "lessons": [{
    "concept": "so-deadlock",
    "body": ["…", "…", "…", "…"],
    "figure": { "src": "/illustrations/MET-02.webp", "alt": "…" },
    "example": { "title": "…", "code": "…", "steps": ["…", "…"], "check": "Executado em Python 3: …" },
    "mistake": "…",
    "recall": [{ "q": "…?", "a": "…" }, { "q": "…?", "a": "…" }]
  }]
}
```

**Modelo novo (revisão do Codex, §4), opcional por lição.** Os campos abaixo aparecem na tela só quando existem; as lições antigas continuam válidas até serem refeitas.

| Campo | Na tela | Regra |
| --- | --- | --- |
| `objective` | "Ao terminar, você consegue", no topo | uma frase com verbos verificáveis (explicar, calcular, decidir) |
| `prerequisites` | "Antes, revise", com link quando o conceito tem lição | 1 a 4 conceitos do núcleo da mesma área, sem o próprio |
| `counterexample` `{claim, why}` | "Quando a regra não vale", depois do exemplo | afirmação que parece certa e o caso concreto em que falha |
| `transfer` `{prompt, steps, check}` | "Agora sozinho", solução fechada até a pessoa abrir | situação nova; solução comentada e conferida como o exemplo |
| `sources` `[{title, edition, locator, url?}]` | "Fonte e conferência" | **só o que foi aberto e lido** para escrever a lição, com edição e seção; `url` só https |

Sem `sources`, a tela diz "Nenhuma registrada para esta lição" e que a bibliografia da área é recomendação, não consulta. A seção "Fonte e conferência" mostra também a conferência do exemplo e "Revisão humana: Ainda não". Pilotos com o modelo completo: `so-deadlock`, `so-memoria-virtual` e `alg-ordenacao`. Fontes de fato abertas e lidas em 07/11/2026, comparadas com o texto:

| Lição | Fonte | O que confirma |
| --- | --- | --- |
| Deadlock | OSTEP, cap. 32 (versão 1.20), seção 32.3 | quatro condições e "basta uma faltar"; ordem total ou parcial de aquisição; posse e espera; evitação e banqueiro; detecção e recuperação |
| Memória virtual | OSTEP, cap. 22 (versão 1.10), 22.2 a 22.5, 22.8, 22.11 | anomalia de Belady na FIFO de 3 para 4 quadros; propriedade de pilha da LRU; FIFO e aleatória sem ela; relógio; thrashing e controle de admissão |
| Ordenação | Python 3.13.18, Sorting Techniques, Sort Stability and Complex Sorts | ordenação estável e a técnica do exercício (chave secundária primeiro, depois a primária) |

O que a fonte não cobre continua conferido por execução: o grafo com recurso de duas instâncias, o relógio com a anomalia, o pior caso do quicksort e a inserção com deslocamento limitado. Nada foi preenchido de memória; o site do livro de algoritmos de Jeff Erickson pede verificação anti-robô e ficou de fora.

**O validador recusa:**
- conceito que não existe no núcleo da mesma área, ou lição repetida;
- explicação fora de 4 a 8 parágrafos, exemplo com menos de 2 passos, menos de 2 ou mais de 3 perguntas;
- imagem fora de `/figures/` ou `/illustrations/`, ou que não existe em `apps/web/public`;
- travessão no texto, pela mesma regra de redação das questões geradas;
- pré-requisito fora da área ou igual ao próprio conceito, transferência sem 2 a 6 passos ou sem `check`, fonte sem edição ou localizador, ou com endereço que não é https.

## 4. Conferência

Escritas por IA (Claude), sem segundo agente, com o conhecimento geral do modelo. A bibliografia do núcleo aparece como leitura recomendada; ela não foi consultada para escrever as lições. Todos os 23 exemplos foram executados de verdade, e o `check` diz o que rodou:
- **Algoritmos:** laços, recorrência do Fibonacci, busca binária, inserção, ABB, AVL, heap, BFS e DFS, Dijkstra com peso negativo contra Bellman-Ford, Kruskal, troco e caixeiro viajante em Python 3.
- **Sistemas operacionais:** `fork` e condição de corrida em C com gcc no Linux; escalonamento, banqueiro, paginação, substituição de páginas, i-node, produtor-consumidor e semáforo em Python 3.

Na revisão do Codex, dois `check` foram refeitos: a sequência de estados (que citava os livros sem consulta) e a pilha de parênteses (antes conferida à mão) agora são executadas em Python 3. Os exercícios de transferência dos pilotos também foram executados: busca exaustiva das intercalações de dois mutexes, inclusão LRU com 3 e 4 quadros, quicksort com o primeiro pivô e inserção com deslocamento limitado.

A simulação mostrou que o relógio também sofre a anomalia de Belady (9 e 10 faltas na sequência clássica). Por isso o exemplo e a pegadinha do núcleo de SO, que diziam "só a FIFO", foram corrigidos.

**Sem revisão humana.** A tela avisa no topo ("Texto gerado por IA, sem revisão humana") e no rodapé da lição.

## 5. Próximos passos

- Gabriel lê os três pilotos do modelo novo e aprova ou pede ajustes.
- Para as próximas lições, registrar em `sources` o que for aberto e lido. O ambiente pessoal `enade-cs-platform` libera OSTEP, documentação do Python e do PostgreSQL e as RFCs; outro host precisa ser pedido.
- Refazer as outras 20 lições no modelo novo antes de ampliar.
- Depois, o PR F leva as lições às outras 15 áreas, na ordem do plano.
