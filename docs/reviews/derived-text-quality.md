# Continuidade do Claude: texto derivado e qualidade

28/10/2026 · Codex. Integração de CNT-T1 e conferência assistida de 16 objetivas. **Não é aprovação humana, conferência de fontes como VERIFIED ou autorização de publicação.** A main atual já inclui o caminho de publicação por agentes da ADR-011; esta passagem não publicou conteúdo e a conferência de recortes é registrada separadamente.

## Onde o Claude parou

O primeiro handoff do PR #16 entregou o mapa Unicode de 116 glifos, o gerador de cópia de texto de 2014/2017 e a ADR-010. Durante esta continuidade, o Claude concluiu também a leitura da cópia, os recortes, sua exibição e a publicação assistida, integrados na main `42a45d6`. A conferência independente dos itens ficou em CNT-V1 com Codex.

Esta continuidade integra os commits do PR #16 e implementa `--repair-calibri [--python EXEC]`. A cópia é gerada em diretório temporário privado a partir do original catalogado e do mapa fixado. Não se aceita um PDF derivado arbitrário acompanhado de recibo como prova de procedência.

O original continua sendo usado para imagens, detecção de figuras, fontes, gabarito e identidade documental. Apenas a leitura do texto usa a cópia. O extrator confere hashes e quantidade/dimensões das páginas, registra o recibo estável em `extraction.textCopy` e mantém todos os itens com alerta. O importador valida o vínculo declarado, conserva HOLD e preserva a evidência inicial. Recibo não é assinatura nem comprova sozinho fidelidade.

## Integridade e validação real

- Corrigido o gerador que aceitava sobrescrever o original e depois atribuía seu novo hash ao recibo. Agora saídas e recibos existentes, inclusive aliases, links e mapas/referências, são rejeitados; arquivos novos usam criação exclusiva.
- Python usa `pypdf==6.10.0`, versão estável disponível e verificada no PyPI, licença BSD-3-Clause. Instalação opcional isolada com hashes em `scripts/requirements-pdf.txt`; não é dependência da API em execução. O CI instala essa versão para os testes do utilitário.
- O mapa foi reconstruído dos quatro PDFs catalogados de 2021: 116 glifos, bytes idênticos e SHA-256 `f20d49d5a2c2f9a768d8139f7b37d36a13118744158433c3afce42a1bb5f8f05`.
- As quatro provas de 2014/2017 produziram **40 itens cada**, sem lacunas. Tipos, números, respostas, blocos e escopos foram preservados; nenhum grupo de alternativas existente foi perdido. Licenciatura 2014 passou de 34 para 35 grupos estruturados.
- Doze comparações de raster, três páginas por caderno a 100 DPI em escala de cinza, foram idênticas entre original e derivado. Isso é uma verificação amostral, não inspeção visual de todas as páginas. Duas gerações independentes de 2014 Bacharelado produziram o mesmo SHA-256 do derivado.
- A nova segmentação removeu páginas adicionais antes anexadas a 30 itens de 2017 Bacharelado e 28 de Licenciatura. Os limites ainda exigem conferência; Q9 de 2017 Bacharelado foi visualmente confirmado na página 16, sem a página 17 intrusa.

O processamento continua administrativo via CLI. Durante a execução, a main recebeu `42a45d6`, com armazenamento/exibição dos recortes e publicador assistido entregues pelo Claude. Essa base foi incorporada preservando as funcionalidades; o upload pelo navegador permanece pendente. A revisão do publicador identificou falhas de integridade, corrigidas no PR #18 antes do uso real.

## Lote visual de 2014/2017

Foram confrontados enunciado, todas as alternativas e chave definitiva de oito itens nos originais. Páginas PDF de conteúdo: 2014 Bacharelado 4, 16, 22 e 27; 2017 Bacharelado 16, 17, 23 e 27. Página 1 dos dois gabaritos. Dez páginas integrais a 130 DPI, com dois detalhes ampliados de fórmula/circuito.

| Item | Chave preservada | Resultado assistido | Achado |
| --- | --- | --- | --- |
| 2014 Q1 | A | Sem nova pendência específica | Enunciado, asserções e alternativas correspondem |
| 2014 Q16 | C | Pendente | O original imprime `return pilha;` em vez de devolver o ponteiro criado e usa aspas tipográficas no código; distinguir intenção didática de programa C compilável |
| 2014 Q27 | B | Pendente | Regras de inferência ainda corrompidas/deslocadas no texto; conferir todas as opções, inclusive a dupla negação de D |
| 2014 Q35 | E | Pendente | Circuito corresponde à condição de ao menos três pedidos ativos, mas precisa acompanhar a questão |
| 2017 Q9 | A | Pendente | As cinco alternativas são árvores AVL; o texto ainda não as apresenta, embora o limite de página tenha sido corrigido |
| 2017 Q10 | C | Sem nova pendência específica | Observer não define obrigatoriamente estilo cliente-servidor |
| 2017 Q20 | D | Sem nova pendência específica | Preservar o contexto didático TCP/UDP, sem prometer velocidade ou entrega absoluta |
| 2017 Q28 | D | Sem nova pendência específica | Programação em pares não é uma prescrição de Scrum |

Resultados registrados em [2014-review.json](../../data/question-reviews/2014-review.json) e [2017-review.json](../../data/question-reviews/2017-review.json). O parecer anterior de Q2/2014 foi preservado e identificado como baseado no OCR anterior; não faz parte deste lote visual. Nenhum código do PDF foi executado nem corrigido silenciosamente.

## Lote visual de 2021

Conferidas Q1–Q8 de 2021 Bacharelado nas páginas PDF 5–13 e gabarito definitivo na página 1: **E, C, B, B, A, A, C, D**. As 40 alternativas foram confrontadas. Q2/Q3/Q5 tiveram infográfico, charge e mapa efetivamente examinados. A conferência posterior dos recortes está registrada ao fim deste documento.

Q1 ficou sem nova pendência específica. Q2/Q4/Q6 conservam ajuste de caixa de “PORQUE”, Q7 tem ajuste de referência e Q8 mantém ressalva interpretativa sobre “consenso”, sem inventar “unanimidade” no enunciado. Q5 exige contextualizar a aproximação 15,2/5,7 e a unidade usada no próprio texto; não se altera a chave nem se trata a ressalva como erro criado pelo extrator.

As oito entradas foram atualizadas em [2021-review.json](../../data/question-reviews/2021-review.json), preservando as outras 72. O total dessa análise continua em 23 CONTENT_CHECKED e 57 MANUAL_REQUIRED nos dois cadernos. A nova passagem não revalida automaticamente a variante de Licenciatura.

Nos **16 itens desta passagem**, cinco ficaram sem nova pendência específica e 11 exigem preparação ou revisão adicional. Isso não significa cinco itens publicados/prontos: os alertas de extração, as fontes e as imagens continuam aplicáveis. Não se extrapola o lote para as 160 questões de 2014/2017 ou todo o acervo.

## Banco e testes

Atualizados os mesmos 160 itens de 2014/2017 e os oito pareceres de 2021 Bacharelado; os outros 32 desse caderno ficaram inalterados. Repetir os cinco relatórios retornou **200 inalterados**, sem inserções. Snapshots confirmaram os mesmos **605 IDs e evidências iniciais**, sem edições humanas ou rascunhos sobrescritos.

Há **548 das 551 objetivas com grupos estruturados**. Três ainda não têm grupo: Q8/2008 e Q9 dos dois cadernos de 2017. Quatro têm algum texto de alternativa vazio: Q26/Q59 de 2005 e Q38/Q55 de 2008. Texto não vazio pode continuar corrompido, como nas fórmulas de Q27/2014; a contagem não certifica qualidade. A fila mantém 582 HOLD e 23 PENDING, zero oficiais publicadas, 28 PDFs individuais obtidos e 33 pendentes.

Na base inicial desta passagem passaram, em sequência, `npm run build`, `npm test` (**106 testes**) e `npm run test:e2e -- --timeout=60000` (**22 Chromium**). Depois da incorporação da nova main, as suítes foram repetidas; passaram build, **122 testes** API/PostgreSQL/utilitários e **29 fluxos Chromium**. A execução final iniciou API/web novas, pois a primeira havia reutilizado uma API antiga e falhado nos dois casos de imagem. A revisão cruzada inicial de agente Codex não encontrou bloqueadores; os achados posteriores no publicador foram corrigidos com dez testes adicionais. Os testes cobrem sobrescrita/aliases, CMaps contraditórios, recibos/edições incompatíveis, idempotência e proteção das edições; não certificam a qualidade de todos os itens.

Relatórios, recibos, snapshots, comparações raster, renders e registros completos das duas revisões ficam em `.local/cnt-t1/`, ignorados pelo Git. O passo seguinte é ampliar a conferência em lotes pequenos e publicar pelo caminho do Claude somente os itens cujo manifesto e recortes exatos foram aprovados, após integrar as correções do PR #18.

## Conferência dos recortes exatos de 2021

Após incorporar a entrega de imagens do Claude, foram gerados os 40 itens de 2021 Bacharelado em 47 WebP (cerca de 4,3 MB) a partir do original. Um agente independente examinou os **dez arquivos exatos de Q1–Q8**, novamente confrontando os limites, imagens, 40 alternativas e o gabarito já conferido. Q1/Q2/Q3/Q4/Q6/Q7 ficaram APPROVED; Q5 e Q8 ficaram BLOCKED pelas ressalvas materiais descritas acima. Os ajustes de caixa do texto auxiliar não foram confundidos com defeitos da imagem principal (D8).

O arquivo [de conferência](../../data/agent-reviews/enade-2021-bacharelado-exam.json) vincula as decisões ao [manifesto exato](../../data/question-crop-manifests/enade-2021-bacharelado-exam.json). Operador real: `codex-root`; conferente independente real: `codex-review-cnt-v1`. Não se atribuiu ao Claude a execução deste lote apenas porque ele criou o renderizador. Nenhuma conta ou aprovação humana foi simulada.

Os assets ficam no pacote `.local/exports/conferencia-2021-bacharelado.zip`. Claude pode transportar esses bytes ou regenerá-los e comparar os hashes antes de publicar. Alterar imagem ou manifesto invalida o veredito anterior; a conferência não é uma assinatura criptográfica nem aprovação das outras 32 questões.

Continuidade de 29/10: o [lote Q9–Q16](2021-crop-batch-2.md) acrescentou cinco aprovações e três bloqueios, em arquivo separado por conferente. O acumulado de Q1–Q16 é 11 APPROVED e cinco BLOCKED, preservando os vereditos e os bytes deste primeiro lote.
