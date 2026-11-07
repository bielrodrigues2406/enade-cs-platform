# Questões geradas por IA (GEN-1)

Autorizadas por Gabriel em 06/11/2026: "pode criar. … quero várias. Por área. Temas quentes." Servem para treinar cada área do [núcleo](CORE-CONCEPTS.md) além das 246 objetivas oficiais, sem misturar com elas.

## 1. Onde está

| Parte | Arquivo |
| --- | --- |
| Questões (uma área por arquivo) | `data/generated-questions/<área>.json` |
| Validação e publicação | `apps/api/src/generated-publication.ts` |
| Publicar só as geradas | `npm run publish:generated` (também roda no `bootstrap-content` do deploy) |
| Banco | migration `031_generated_questions.sql` (caminho `review_origin = GENERATED` e tabela `generated_question`) e `032_generated_formats.sql` (formatos, estímulos e figura) |
| Moldes de itens e asserção | `apps/api/src/generated-formats.ts` |
| Auditoria de pistas | `npm run audit:generated` (`apps/api/src/generated-audit.ts`) |
| Figuras SVG | `scripts/draw-figures.py` gera `apps/web/public/figures/` |
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

**Formatos** (detalhes e mistura alvo em [ENADE-ITEM-FORMATS.md](ENADE-ITEM-FORMATS.md)):
- `SIMPLES`: enunciado e cinco alternativas escritas no arquivo;
- `ITENS3` e `ITENS4`: afirmações I a III ou I a IV; o arquivo diz quais são verdadeiras (`truth`) e quais combinações oferecer (`combos`, obrigatório em `ITENS4`; em `ITENS3` o padrão é I; II; I e III; II e III; I, II e III). As alternativas e a letra são calculadas no molde da prova;
- `ASSERCAO`: asserção-razão; o arquivo guarda `assertion: {first, second, justifies}` e as 5 alternativas padrão saem do molde;
- `ORDEM`, `CALCULO`, `CODIGO_OPCOES`, `ASSOCIACAO`: alternativas escritas no arquivo, com a forma conferida (por exemplo, `ORDEM` exige cinco sequências da mesma lista).

O campo `stimulus` diz o que o enunciado traz: `TEXTO_BASE`, `CENARIO`, `CODIGO`, `TABELA`, `FIGURA`, `GRAFICO`, `DOIS_TEXTOS` ou `CHARGE`.

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
   - itens e asserção no molde, com a letra calculada;
   - figura existente em `apps/web/public` e marcador `[figura]` só com figura;
   - sem travessão;
   - conceitos existentes no núcleo da mesma área;
   - pistas da resposta no banco todo, pelas travas de [GENERATED-QUALITY-AUDIT.md](GENERATED-QUALITY-AUDIT.md#5-resultado-da-revisão-07112026).
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
    "check": "Nova resolução sem o gabarito: …",
    "stimulus": ["TEXTO_BASE", "FIGURA"],
    "figure": { "src": "/figures/gen-so-….svg", "alt": "Descrição completa, sem entregar a resposta" }
  }, {
    "id": "gen-so-…", "format": "ITENS4", "truth": ["II", "IV"],
    "combos": [["I", "II"], ["I", "III"], ["II", "IV"], ["III", "IV"], ["II", "III", "IV"]],
    "prompt": "…\n\nI. …\nII. …\nIII. …\nIV. …\n\nÉ correto apenas o que se afirma em", "…": "…"
  }]
}
```

- No enunciado, trechos entre ``` aparecem como código.
- **Figura:** `src` aponta para `/figures/*.svg` ou `/illustrations/*.webp` (o banco recusa outro caminho), e o `alt` de 20 a 600 caracteres descreve tudo o que a figura mostra, porque é o que o leitor de tela lê. Uma linha `[figura]` no enunciado marca onde ela entra; sem o marcador, entra depois do primeiro parágrafo. As ilustrações de `/illustrations/` levam a legenda "Ilustração gerada por IA".
- **Formatação:** depois de editar, rode `python3 scripts/format-generated.py` para manter o JSON compacto e legível.
- **Auditoria:** `npm run audit:generated` mostra as medidas de pista da resposta e de tamanho.
- Mudar o conteúdo de uma questão já publicada cria uma versão nova (as publicadas são imutáveis); publicar de novo sem mudança não faz nada.
- **Não mude o `id`** de uma questão existente, porque isso apaga a ligação com as respostas já dadas.

## 6. Estado e próximos lotes

- **Lote 1:** 120 questões nas 16 áreas mais a Formação Geral, revisadas em 07/11/2026 (GEN-3 e GEN-4).
  - Tipos: 79 espelho, 14 lacuna e 27 tema quente.
  - Formatos: 80 simples, 23 de itens (22 com IV), 16 de asserção-razão e 1 de ordenação.
  - Figuras: 21, sendo 12 diagramas e gráficos em SVG (`scripts/draw-figures.py`) e 9 ilustrações geradas no GPT Image (`data/illustrations/catalog.json`).
  - Banco: migration `032_generated_formats.sql` (formatos novos, `stimulus`, `figure_src`, `figure_alt`).
- **Lote 2, primeira parte (07/11/2026):** 16 questões, priorizando as formas que faltavam.
  - Formas: 4 de cálculo, 2 de código nas alternativas (SQL e expressão regular), 2 de ordem, 1 de associação, 4 de itens (duas com 1 verdadeira e uma com 3), 2 de asserção (B e E) e 1 simples.
  - Temas: laço com soma harmônica, ordenação topológica, GROUP BY e HAVING, NULL em agregações, Scrum, tipos de teste, modus tollens, Round Robin com chegadas, regularização, heurísticas de Nielsen, CEP com expressão regular, CPI médio, DHCP, sessão em nuvem elástica, XSS e passagem de parâmetros em C.
  - Conferência: SQL no PostgreSQL 17, C com gcc, contas e simulações em Python 3, registradas no `check` de cada uma.
- **Lote 2, segunda parte (07/11/2026):** 15 questões, priorizando as áreas com menos questões (Compiladores, Computação gráfica, IHC, Sociedade e ética).
  - Formas: 6 de cálculo, 6 de itens, 1 de associação, 1 de asserção (D) e 1 simples.
  - Temas: associatividade na gramática, framebuffer com buffer duplo, acessibilidade de formulário, registros no Marco Civil, sobrecarga e sobrescrita em Java, IPv6, quórum de réplicas, parada semidecidível, altura máxima de AVL, ganho de informação, assinatura e sigilo, contagem pelo complementar, diagramas UML, IEEE 754 e níveis de isolamento.
  - Conferência: Java com javac, contas em Python 3 (IEEE 754 com struct), leis e normas pelo texto (Marco Civil, WCAG 2.2, RFCs).
- **Lote 2, terceira parte (07/11/2026):** 12 questões, de novo nas áreas com menos questões (Computação gráfica, Sociedade e ética, Compiladores, IHC, Programação, Sistemas distribuídos e Redes).
  - Formas: 6 de cálculo, 1 de ordem, 1 de associação, 2 de itens, 1 de asserção (A) e 1 simples.
  - Temas: pipeline gráfico, z-buffer, LGPD em dados de saúde, licenças, contagem de tokens, fases dos erros de compilação, avaliação heurística, lei de Fitts, closures e argumento padrão mutável em Python, relógios vetoriais e vazão limitada pela janela do TCP.
  - Conferência: tokens com clang -dump-tokens, erros com gcc, Python 3 para código e contas, leis e licenças pelo texto.
- **Pistas da resposta:** resultado da revisão e travas em [GENERATED-QUALITY-AUDIT.md](GENERATED-QUALITY-AUDIT.md#5-resultado-da-revisão-07112026).
- **Próximos lotes** (base em [ENADE-EVOLUTION.md](ENADE-EVOLUTION.md)):
  - texto-base de 120 a 200 palavras com referência, como a prova desde 2014 (o lote 1 tem mediana de 60 palavras, contra 214 em 2021);
  - mais comandos "Considerando…, avalie";
  - mais questões nas áreas de maior peso e em alta (Algoritmos, Arquitetura, SO e a lógica da Matemática), sobretudo nos conceitos marcados como "ainda não caiu";
  - as formas `CALCULO`, `CODIGO_OPCOES` e `ASSOCIACAO`, ainda sem questões;
  - itens com 1 e com 3 verdadeiros, ainda abaixo das oficiais.
- **Imagens:** diagramas exatos em SVG e ilustrações no GPT Image, conforme [IMAGE-PROMPTS.md](IMAGE-PROMPTS.md).
