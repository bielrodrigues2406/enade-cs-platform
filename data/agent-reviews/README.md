# Conferência por agente (CNT-V1, ADR-010)

Cada arquivo desta pasta registra a conferência de **uma prova** por um agente que **não** fez a extração. Identifique os operadores reais de cada lote; a autoria do utilitário não determina quem executou a extração. Só os itens aprovados aqui podem ser publicados pelo caminho `ASSISTED` (PUB-A1). Nada aqui é revisão humana.

## Como gerar o material para conferir

Com os PDFs do catálogo em `enade-pdfs/`:

```sh
node scripts/extract-questions.mjs --id enade-2021-bacharelado-exam \
  --directory enade-pdfs --output .local/question-drafts \
  --crops .local/question-crops
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

`data/agent-reviews/<prova>.json`, por exemplo `enade-2021-bacharelado-exam.json`. Para novos lotes ou conferentes da mesma prova, use arquivos separados, como `<prova>-q9-q16.json`, preservando o campo `document` com o ID da prova. O CLI recebe o caminho em `--review`; o nome do arquivo não muda a identidade documental:

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

## Continuidade CNT-V1 de 28/10

O lote `enade-2021-bacharelado-exam.json` contém somente Q1–Q8: seis APPROVED e duas BLOCKED. O operador desta geração foi `codex-root`; a conferência dos dez WebP foi feita pelo agente independente `codex-review-cnt-v1`. A autoria do utilitário pelo Claude não foi usada para atribuir a ele esta execução. Nada neste arquivo é revisão humana.

O manifesto exato está em `data/question-crop-manifests/enade-2021-bacharelado-exam.json`; seu SHA deve coincidir com o arquivo de conferência. Os 47 arquivos WebP e o manifesto estão também no pacote local `.local/exports/conferencia-2021-bacharelado.zip`, sem PDFs. Para publicar em outro ambiente, transportar esse pacote ou regenerar com as mesmas fontes/ferramentas e comparar **todos os hashes**. Manifesto ou imagens diferentes exigem nova conferência; não reaproveitar APPROVED por número apenas.

O manifesto atual contém `renderer.pages` com dimensões de todas as páginas originais. Manifestos anteriores sem esse campo precisam ser regenerados e novamente conferidos. Para 2014/2017, substituir o antigo `--text-copy PASTA` por `--repair-calibri [--python EXEC]`, que gera a cópia internamente a partir do original; o recebimento de uma cópia arbitrária foi removido. O reparo exige a versão/hashes de `scripts/requirements-pdf.txt`.

## Lote 2 de 29/10 — Q9–Q16

`enade-2021-bacharelado-exam-q9-q16.json` registra a conferência por `codex-review-2021-b2` da extração existente de `codex-root`: Q9/Q10/Q11/Q15/Q16 APPROVED e Q12/Q13/Q14 BLOCKED. As 40 alternativas e o gabarito foram confrontados com os oito WebP e as páginas originais. O manifesto e as imagens não mudaram. O arquivo Q1–Q8 mantém o conferente anterior.

O [relatório do lote](../../docs/reviews/2021-crop-batch-2.md) explica os bloqueios e os problemas textuais de Q11/Q16. São 11 aprovações e cinco bloqueios entre Q1–Q16; nenhuma publicação nesta etapa. O pacote adicional `.local/exports/conferencia-2021-bacharelado-q9-q16.zip` transporta os dois lotes e os mesmos assets. Passar cada arquivo separadamente ao publicador; não trocar o `reviewer` de um lote para consolidar identidades.
