# Conferência, explicação e classificação por agentes (v2, D15)

Processo usado a partir de 30/10/2026 para colocar todas as objetivas no estudo. Vale para cada nova edição do ENADE. Complementa o [README](README.md) desta pasta e as ADR-010/011.

## Papéis

| Papel | Quem | Faz | Nunca faz |
| --- | --- | --- | --- |
| Extrator | quem roda `extract-questions` e commita os recortes (`extractor` no arquivo) | gera transcrição, recortes e manifesto | conferir o próprio lote |
| Explicador | agente identificado (`explainer`) | propõe área, assunto e explicação de cada objetiva | aprovar fidelidade ou a própria explicação |
| Conferente | agente identificado (`reviewer`), diferente dos dois acima | confere fidelidade item a item, confirma área/assunto, aceita ou recusa a explicação, escreve a nota ao estudante | reescrever a explicação |

Os três nomes precisam ser diferentes. Nenhum deles é revisão humana.

**Exceção autorizada (31/10/2026):** Gabriel autorizou o próprio Claude, que extraiu, a conferir as provas restantes (2005, 2008 Q1–Q22, 2011 e só-Licenciatura). Esses arquivos usam o conferente `claude-autoconferencia` e dizem em cada nota que não é conferência independente. As explicações dessa rodada estão em `explanations/`.

## Recortes e relatório commitados

O extrator roda `node scripts/extract-questions.mjs --id <prova> --crops <pasta> [--repair-calibri]` e commita, só para as objetivas válidas do curso: os WebP em `data/question-crops/<prova>/`, o manifesto em `data/question-crop-manifests/<prova>.json` e o relatório em `data/question-reports/<prova>.json`. Conferência e publicação usam exatamente esses bytes; gerar de novo em outra máquina muda os hashes e invalida a conferência.

## Pacotes

`node scripts/review-packets.mjs --exam <prova> --keys Q1-Q18 --directory <PDFs>` gera `.local/review-packets/<prova>-qA-qB.json` com, por objetiva: recortes commitados em `data/question-crops/` (caminho e SHA-256), transcrição automática, letra lida no gabarito, texto da página do gabarito, alertas do extrator e achados anteriores de outros agentes (`previous`).

## O que bloqueia (D15)

Só **fidelidade** bloqueia (`verdict: "BLOCKED"`, com `reason`):

1. o recorte não contém a questão inteira (enunciado, textos, figuras, código, as cinco alternativas) ou traz pedaço de outra questão/instrução;
2. o número impresso não é o da chave;
3. a letra do gabarito oficial para esse número não é a registrada, ou a questão foi anulada;
4. a quantidade de alternativas impressas não é 5;
5. a imagem está ilegível em algum trecho necessário.

Ressalva de **conteúdo** do próprio Inep (dado inconsistente no texto, ambiguidade, informação datada, gabarito discutível) **não bloqueia**: vira `studentNote`, uma nota curta e neutra mostrada na questão. Erro da transcrição automática também não bloqueia: a imagem prevalece e a interface diz isso.

## Explicação

Português do Brasil, texto simples (sem Markdown), 80 a 220 palavras, até três parágrafos separados por linha em branco.

- Comece pelo conceito que a questão cobra.
- Justifique a alternativa do gabarito oficial; depois diga, em poucas palavras, por que as outras falham (agrupe quando fizer sentido). Em questões de asserções ou afirmativas, avalie cada uma.
- Use só o que está na questão e conhecimento consolidado da área. Não cite autores, leis, páginas ou dados que não estejam na prova.
- Se a explicação depender de cálculo, mostre o passo essencial.
- Nunca contradiga o gabarito oficial. Se ele parecer discutível, explique o raciocínio oficial e registre a dúvida em `keyConcern` (o conferente decide se vira `studentNote`).

O conferente marca `explanationCheck: "OK"` só se a explicação estiver correta, coerente com o gabarito e com a imagem, e útil ao estudante. Caso contrário, `"REJECTED"` com `explanationNote`; a questão sai sem explicação (D11) e volta para outra rodada.

## Classificação

`area`: uma das 18 áreas do README. Formação Geral sempre `Formação Geral`. Para o componente específico, a área do conhecimento principal cobrado (uma só).

`subject`: assunto específico em até 60 caracteres, como "Autômatos finitos", "Normalização", "Escalonamento de processos", "Árvores AVL", "Sustentabilidade". Serve para busca e para o professor montar listas.

## Arquivos

Explicador → `.local/review-work/<pacote>.explain.json`:

```json
{ "packet": "<pacote>", "explainer": "claude-explain-01",
  "items": [{ "key": "Q1", "area": "…", "subject": "…", "explanation": "…", "keyConcern": "" }] }
```

Conferente → `data/agent-reviews/<pacote>.json` (é o arquivo que o publicador lê):

```json
{
  "document": "<prova>", "examSha256": "…", "cropsManifestSha256": "…",
  "extractor": "claude", "explainer": "claude-explain-01", "reviewer": "claude-review-01",
  "reviewedAt": "2026-10-30T18:00:00Z",
  "items": [
    { "key": "Q1", "verdict": "APPROVED", "fragments": ["<sha256>"], "answer": "E", "optionCount": 5,
      "area": "Formação Geral", "subject": "…", "notes": "o que foi conferido",
      "studentNote": "", "explanation": "<texto do explicador, sem alteração>",
      "explanationCheck": "OK", "explanationNote": "" },
    { "key": "Q2", "verdict": "BLOCKED", "reason": "recorte sem a alternativa E" }
  ]
}
```

`fragments` repete os SHA-256 do pacote, na ordem. `studentNote` tem até 400 caracteres. Para publicar: `npm run publish:assisted -- --review data/agent-reviews/<pacote>.json`.
