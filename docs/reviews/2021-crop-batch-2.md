# ENADE 2021 Bacharelado — conferência Q9–Q16

29/10/2026 · CNT-V1, lote 2. Conferência assistida por agente independente, sem revisão humana e sem publicação nesta etapa.

## Resultado

Foram confrontados os oito WebP exatos com as páginas PDF 19–25 da prova original e a página 1 do gabarito definitivo: **40 alternativas, oito números e oito letras preservados**. Todos os recortes estão completos e legíveis, incluindo os diagramas de Q11/Q16 e a separação das duas colunas de Q9/Q10.

| Item | Chave | Veredito | Achado |
| --- | --- | --- | --- |
| Q9 | E | APPROVED | Escalonamento por prioridades no contexto didático; FILO em A pertence ao original |
| Q10 | B | APPROVED | Deque, lista simplesmente ligada, pilha e fila; quatro classes e cinco alternativas completas |
| Q11 | D | APPROVED | Diagrama de treinamento íntegro; Σ virou S apenas na transcrição auxiliar |
| Q12 | B | BLOCKED | A abertura generaliza a vigência da LGPD; contextualização jurídica ainda pendente |
| Q13 | E | BLOCKED | A possibilidade de usar o incremento como protótipo, em D, mantém ressalva conceitual |
| Q14 | C | BLOCKED | Datação do conceito de Von Neumann nos anos 1950 e primazia do ENIAC exigem conferência histórica |
| Q15 | C | APPROVED | Planejamento incremental e responsabilidades Scrum, sem inferir chefia hierárquica |
| Q16 | B | APPROVED | Circuito e todas as negações conferidos; índices/topologia do texto auxiliar continuam pendentes |

Q16 foi reconstruída seguindo os fios: `¬(¬X₁ ∨ (¬X₂ ∧ X₃))`, equivalente a B e a `X₁ ∧ (X₂ ∨ ¬X₃)`. A verificação das oito combinações de entradas distinguiu B das outras expressões. Não houve execução de código retirado do PDF.

Na Q11, a explicação preserva o contexto de imagens estáticas sem declarar impossível qualquer uso de recorrência em visão computacional. A aprovação visual de Q11/Q16 não aprova a transcrição como descrição acessível completa dos diagramas; `CONFERIR_SIMBOLOS` e `CONFERIR_GLIFOS` permanecem explícitos.

Na Q14, a afirmação I data expressamente o conceito nos anos 1950. A tensão com a formulação de programa armazenado associada ao First Draft de 1945 foi registrada como pendência bibliográfica, sem alegar que esse documento histórico foi obtido ou consultado. A chave C permanece. O antigo alerta visual por mencionar “mapa” foi esclarecido: não há figura na página.

## Consulta complementar de Q12

Codex consultou o art. 65, página PDF 37, na [tradução inglesa atualizada divulgada pela ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/outros-documentos-e-publicacoes-institucionais/lei-lgpd-em-ingles-atualizada-pos-lei-no-15-352-2026.pdf/@@display-file/file), obtida pela página de notícias da própria agência. SHA-256: `afe3e850bb670a347470a058247019fed7b4a4dfe4bfca11eef887dc037b56e4`.

O artigo distingue dispositivos com vigência em 28/12/2018, sanções em 01/08/2021 e outro prazo para os demais dispositivos. Isso sustenta a ressalva à generalização do enunciado. A consulta é parcial: não substitui o texto normativo em português nem reconstrói todas as alterações e datas efetivas de vigência. O item continua bloqueado, e a imagem e a letra B não foram alteradas. A primeira URL tentada retornou 404; a referência acima foi efetivamente baixada e lida, sem afirmar bloqueio geral do portal.

## Evidência e continuidade

Operador da extração existente: `codex-root`. Conferente independente: `codex-review-2021-b2`, tarefa real `/root/review_2021_q9_q16`. O conferente inspecionou 16 arquivos com `view_image`: sete páginas da prova, uma de gabarito e oito WebP. Não alterou a extração, as imagens ou o manifesto.

O [lote 2](../../data/agent-reviews/enade-2021-bacharelado-exam-q9-q16.json) usa o mesmo [manifesto](../../data/question-crop-manifests/enade-2021-bacharelado-exam.json), SHA-256 `38ce43e9f782c050d7670c4e954ac79c5a0d7f5a8db78ecabd5d6be4a1746255`. O arquivo Q1–Q8 e sua identidade de conferente foram preservados. Arquivos separados por lote evitam atribuir revisões antigas a um novo agente.

Os oito pareceres do Bacharelado foram atualizados em [2021-review.json](../../data/question-reviews/2021-review.json); as outras 72 entradas foram preservadas. Continuam 23 CONTENT_CHECKED e 57 MANUAL_REQUIRED nos dois cadernos. A nova conferência não se estende à Licenciatura.

Na fila privada, a importação atualizou oito registros e manteve 32; a repetição retornou 40 inalterados. Snapshots confirmaram os mesmos 605 IDs e evidências iniciais, sem sobrescrever edições ou rascunhos e sem publicar questões.

Passaram, em sequência, `npm run build`, `npm test` (122 testes API/PostgreSQL/utilitários) e `CI=true npm run test:e2e -- --timeout=60000` (29 Chromium). A revisão cruzada do diff não encontrou bloqueadores; o caminho documental dos PDFs foi esclarecido conforme seu apontamento. Esta etapa altera somente dados de revisão e documentação, sem novo código ou migration. Entrega no [PR #19](https://github.com/bielrodrigues2406/enade-cs-platform/pull/19).

Somados os lotes Q1–Q8 e Q9–Q16, há **16 objetivas com recortes conferidos: 11 APPROVED e cinco BLOCKED** (Q5/Q8/Q12/Q13/Q14). As 19 objetivas Q17–Q35 ainda não têm esse veredito; Q29/Q33 são oficialmente anuladas e permanecem fora de itens pontuáveis.

Os PDFs originais permanecem em `.local/import-review/bundle/2021/`. Renders, notas, tabela-verdade, referência LGPD, recibos e snapshots estão em `.local/cnt-v1-2021-b2/`; os WebP permanecem em `.local/cnt-t1/crops/`. O pacote `.local/exports/conferencia-2021-bacharelado-q9-q16.zip` reúne os 47 WebP e os dois lotes, sem PDFs: 4.345.047 bytes, SHA-256 `55529fdaee972e740b016f6b3ff2e4aae6f76590af52d4d3e79db7c77d94495f`. O pacote original Q1–Q8 permanece intacto. Publicação continua com Claude (D8), utilizando somente os bytes aprovados. Próximo lote: Q17–Q24.
