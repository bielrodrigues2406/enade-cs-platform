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

**O validador recusa:**
- conceito que não existe no núcleo da mesma área, ou lição repetida;
- explicação fora de 4 a 8 parágrafos, exemplo com menos de 2 passos, menos de 2 ou mais de 3 perguntas;
- imagem fora de `/figures/` ou `/illustrations/`, ou que não existe em `apps/web/public`;
- travessão no texto, pela mesma regra de redação das questões geradas.

## 4. Conferência

Escritas por IA (Claude), sem segundo agente, a partir da bibliografia do núcleo. Todo exemplo com conta, código ou simulação foi executado de verdade, e o `check` diz o que rodou:
- **Algoritmos:** laços, recorrência do Fibonacci, busca binária, inserção, ABB, AVL, heap, BFS e DFS, Dijkstra com peso negativo contra Bellman-Ford, Kruskal, troco e caixeiro viajante em Python 3.
- **Sistemas operacionais:** `fork` e condição de corrida em C com gcc no Linux; escalonamento, banqueiro, paginação, substituição de páginas, i-node, produtor-consumidor e semáforo em Python 3.

A simulação mostrou que o relógio também sofre a anomalia de Belady (9 e 10 faltas na sequência clássica). Por isso o exemplo e a pegadinha do núcleo de SO, que diziam "só a FIFO", foram corrigidos.

**Sem revisão humana.** A tela avisa no topo ("Texto gerado por IA, sem revisão humana") e no rodapé da lição.

## 5. Próximos passos

- Gabriel lê as duas áreas e aprova ou pede ajustes no formato.
- Depois, o PR F leva as lições às outras 15 áreas, na ordem do plano.
