# Questões geradas por IA (GEN-1)

Autorizadas por Gabriel em 06/11/2026: "pode criar. … quero várias. Por área. Temas quentes." Servem para treinar cada área do [núcleo](CORE-CONCEPTS.md) além das 246 objetivas oficiais, sem misturar com elas.

## 1. Onde está

| Parte | Arquivo |
| --- | --- |
| Questões (uma área por arquivo) | `data/generated-questions/<área>.json` |
| Validação e publicação | `apps/api/src/generated-publication.ts` |
| Publicar só as geradas | `npm run publish:generated` (também roda no `bootstrap-content` do deploy) |
| Banco | migration `031_generated_questions.sql`: caminho `review_origin = GENERATED` e tabela `generated_question` |
| Testes | `tests/generated-questions.test.ts`, `tests/browser/generated.spec.ts` |

## 2. Separação das oficiais

- A origem é `AI_GENERATED`, e o rótulo "Gerada por IA" aparece na questão e na autoria.
- **O banco padrão não mostra as geradas.** Elas aparecem com o filtro "Origem: Geradas por IA" (`/questoes?origin=generated`).
- O núcleo leva a elas pelo botão "Praticar questões geradas (N)" de cada área e pela lista de geradas em cada conceito.
- **Ficam fora:**
  - do treino e das provas (`ELIGIBLE` aceita só `OFFICIAL` e `AUTHOR_CREATED`);
  - do "Meu desempenho" e da confiança do núcleo, que contam só as reais;
  - das estatísticas oficiais.
- **Contam:** na meta diária e no caderno de erros, porque são estudo.

## 3. Como são feitas

**Três tipos:**
- `ESPELHO`: assunto que já caiu, em contexto novo;
- `LACUNA`: fundamento da área que nunca caiu no acervo;
- `QUENTE`: tema atual ligado a fundamentos.

**Formatos:**
- `SIMPLES`;
- `ITENS`, com afirmações I, II, III e as combinações;
- `ASSERCAO`, a asserção-razão com as 5 alternativas padrão.

Cerca de um terço das questões usa os dois últimos, como no ENADE.

**Molde do ENADE:**
- texto-base com situação profissional concreta: código, tabela, cenário de sistema;
- comando que pede aplicar, não decorar;
- cada alternativa errada montada num dos 7 padrões de pegadinha do núcleo (área vizinha, par confundido, relação invertida, ordem de grandeza, condição esquecida, absoluto suspeito, causa trocada).

**Explicação:**
- começa por `Resposta: X.`;
- resolve passo a passo;
- termina com "As outras alternativas:" e uma linha por letra errada (`A) …`) dizendo por que está errada.

**Temas quentes:** evita o clichê e cobra o mecanismo técnico. Exemplos:
- vazamento de dados entre treino e teste;
- precisão e revocação em fraude;
- RAG;
- injeção de prompt num agente;
- HTTP/3 e QUIC;
- CGNAT;
- idempotência no Pix;
- CAP entre regiões;
- ataque à cadeia de dependências;
- fadiga de MFA;
- contraste pela WCAG;
- reidentificação de dados;
- viés por variáveis substitutas;
- JIT;
- ray tracing híbrido.

**Formação Geral:** interpretação de texto e de dados, com base em direitos humanos. Números inventados são marcados como "dados ilustrativos".

## 4. Conferência sem segundo agente

Gabriel dispensou o segundo agente. O que substitui essa revisão:

1. **Validação automática** em toda carga e em `npm test`:
   - 5 alternativas distintas;
   - gabarito válido;
   - explicação que começa pela resposta e comenta cada alternativa errada;
   - itens I e II presentes quando o formato pede;
   - sem travessão;
   - conceitos existentes no núcleo da mesma área.
2. **Nova resolução sem o gabarito**, registrada no campo `check`. Contas, consultas e código foram executados de verdade:
   - Python para Dijkstra, LCS, heap, FIFO e LRU, SJF, binomial, Amdahl e contraste WCAG;
   - PostgreSQL 17 para NOT IN com NULL, LEFT JOIN, UPDATE condicional, EXPLAIN do índice e injeção de SQL;
   - javac, gcc e Node para orientação a objetos, ponteiro pendente e event loop.
   - O `check` diz exatamente o que foi executado.
3. **Releitura final:** para cada questão, a alternativa marcada foi comparada com a resolução.
   - Nessa releitura apareceu e foi corrigido um erro de letra (relógio de Lamport).

**Sem revisão humana.** A tela avisa. Revisão por professor é recomendada.

## 5. Formato do arquivo

```json
{
  "area": "Sistemas operacionais",
  "generator": "claude-geracao",
  "checker": "claude-resolucao",
  "questions": [{
    "id": "gen-so-…", "kind": "ESPELHO", "format": "SIMPLES", "concepts": ["so-regiao-critica"],
    "title": "…", "subject": "…", "prompt": "… ```código``` …",
    "options": ["…", "…", "…", "…", "…"], "answer": "D",
    "explanation": "Resposta: D.\n\n…\n\nAs outras alternativas:\nA) …\nB) …\nC) …\nE) …",
    "check": "Nova resolução sem o gabarito: …"
  }]
}
```

- No enunciado, trechos entre ``` aparecem como código.
- Mudar o conteúdo de uma questão já publicada cria uma versão nova (as publicadas são imutáveis); publicar de novo sem mudança não faz nada.
- **Não mude o `id`** de uma questão existente, porque isso apaga a ligação com as respostas já dadas.

## 6. Estado e próximos lotes

- **Lote 1:** 120 questões nas 16 áreas mais a Formação Geral.
  - Tipos: 79 espelho, 14 lacuna e 27 tema quente.
  - Formatos: 80 simples, 24 de itens e 16 de asserção-razão.
- **Próximos lotes** (base em [ENADE-EVOLUTION.md](ENADE-EVOLUTION.md)):
  - texto-base de 120 a 200 palavras com referência, como a prova desde 2014 (o lote 1 tem mediana de 58 palavras, contra 214 em 2021);
  - mais comandos "Considerando…, avalie";
  - mais questões nas áreas de maior peso e em alta (Algoritmos, Arquitetura, SO e a lógica da Matemática), sobretudo nos conceitos marcados como "ainda não caiu";
  - mais asserção-razão com a resposta B (duas verdades sem relação de causa), o padrão mais difícil;
  - equilibrar as letras do gabarito (no lote 1, a letra E é a menos frequente).
- **Imagens:** diagramas exatos em SVG e ilustrações no GPT Image, conforme [IMAGE-PROMPTS.md](IMAGE-PROMPTS.md).
- **Pistas da resposta (GEN-3):** no lote 1 a certa se entrega pelo tamanho e pela combinação de itens. Medição, regras e travas em [GENERATED-QUALITY-AUDIT.md](GENERATED-QUALITY-AUDIT.md); a revisão vem antes de novos lotes.
- **Formatos do ENADE (GEN-4):** moldes fixos de itens e asserção, formas que faltam (ordem, cálculo, código nas alternativas, associação, dois textos) e mistura alvo em [ENADE-ITEM-FORMATS.md](ENADE-ITEM-FORMATS.md).
