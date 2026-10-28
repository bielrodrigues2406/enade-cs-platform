# Conferência por agente (CNT-V1, ADR-010)

Cada arquivo desta pasta registra a conferência de **uma prova** por um agente que **não** fez a extração (hoje: extração e recortes pelo Claude, conferência pelo Codex). Só os itens aprovados aqui podem ser publicados pelo caminho `ASSISTED` (PUB-A1). Nada aqui é revisão humana.

## Como gerar o material para conferir

Com os PDFs do catálogo em `enade-pdfs/` e, para 2014/2017, as cópias de texto de `scripts/repair-calibri-text.py` em `.local/repaired/`:

```sh
node scripts/extract-questions.mjs --id enade-2021-bacharelado-exam \
  --directory enade-pdfs --output .local/question-drafts \
  --crops .local/question-crops --text-copy .local/repaired
```

Abra `.local/question-crops/<prova>.review.html`: cada item mostra os recortes, o número, a letra do gabarito lida do PDF, os alertas e a transcrição automática. O manifesto `.local/question-crops/<prova>.crops.json` guarda página, caixa, dimensões e SHA-256 de cada recorte. Caixas definidas à mão ficam em `data/question-crop-overrides.json`.

## O que conferir em cada objetiva

A imagem é a apresentação principal; a transcrição é apoio. Aprovar só se **todas** as respostas forem "sim":

1. O recorte contém a questão inteira: enunciado, textos de apoio, figuras, tabelas, código e **todas** as alternativas, na ordem de leitura, sem pedaço de outra questão ou instrução de bloco.
2. O número impresso é o da chave (`key`).
3. A letra do gabarito (`answer`) é a que o gabarito do Inep dá para esse número (abrir o PDF do gabarito; anuladas não são aprovadas).
4. A quantidade de alternativas impressas é a registrada (`optionCount`, normalmente 5).
5. A imagem está legível (índices, sinais, negações).

Discursivas, anuladas e itens fora da primeira leva (D9) ficam fora.

## Formato do arquivo

`data/agent-reviews/<prova>.json`, por exemplo `enade-2021-bacharelado-exam.json`:

```json
{
  "document": "enade-2021-bacharelado-exam",
  "examSha256": "<SHA-256 da prova no catálogo>",
  "cropsManifestSha256": "<SHA-256 do .crops.json conferido>",
  "reviewer": "codex",
  "extractor": "claude",
  "reviewedAt": "2026-10-29T12:00:00Z",
  "items": [
    {
      "key": "Q12",
      "verdict": "APPROVED",
      "fragments": ["<sha256 do recorte 1>"],
      "answer": "B",
      "optionCount": 5,
      "area": "Algoritmos",
      "notes": ""
    },
    { "key": "Q13", "verdict": "BLOCKED", "reason": "recorte sem a alternativa E" }
  ]
}
```

- `fragments` repete os SHA-256 do manifesto conferido, na ordem; se o recorte mudar, a aprovação deixa de valer.
- `area` é uma das áreas abaixo (filtro do catálogo). Em caso de dúvida, a mais específica.
- `BLOCKED` exige `reason`. O Claude corrige recorte ou extração e o item volta para nova conferência.

## Áreas

`Formação Geral` · `Algoritmos` · `Programação` · `Teoria da computação` · `Compiladores` · `Matemática` · `Arquitetura de computadores` · `Sistemas operacionais` · `Redes` · `Sistemas distribuídos` · `Banco de dados` · `Engenharia de software` · `Interação humano-computador` · `Inteligência artificial` · `Computação gráfica` · `Segurança` · `Sistemas de informação` · `Sociedade e ética`
