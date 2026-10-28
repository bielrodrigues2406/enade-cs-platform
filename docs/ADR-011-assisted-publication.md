# ADR 011 — Publicação assistida de questões oficiais em imagem

Status: implementada em `claude/confident-cray-ndnwmk` (CT-1, CT-1b, PUB-A1); aguarda as conferências do Codex (CNT-V1) para publicar conteúdo real. Implementa a [ADR 010](ADR-010-agent-review-and-question-images.md) e as decisões D8–D11 do [quadro](WORKBOARD.md).

## Contexto

A ADR 010 trocou a revisão humana por conferência de agentes para conteúdo oficial transcrito de PDF, sempre com a imagem original da questão. O banco só aceitava publicação com duas contas humanas distintas (ADR 003/004) e não guardava imagens. Gabriel decidiu ainda que o gabarito único publicado pelo Inep vale com aviso (D10) e que a questão pode sair sem explicação, completada depois por IA identificada (D11).

## Decisão

1. **Imagem como conteúdo.** `question_asset` registra cada recorte WebP pelo SHA-256 (até 5 MiB, dimensões lidas do arquivo); o arquivo fica em `QUESTION_ASSET_DIR/<sha[0:2]>/<sha>.webp`, gravado uma vez de forma atômica e conferido pelo hash a cada leitura. `question_version_image` liga a versão aos recortes em ordem, com página, caixa e dpi. `question_version.presentation = 'IMAGE'` só vale para conteúdo oficial e exige ao menos uma imagem ao publicar; imagens de versão publicada são imutáveis (migration 008).
2. **Caminho ASSISTED no banco, ao lado do humano.** `review_origin = 'ASSISTED'` exige origem oficial, agente extrator e agente conferente identificados e diferentes, nenhum `reviewed_by` humano e data de conferência. Eventos editoriais têm uma conta **ou** um agente, nunca nenhum dos dois; o evento de fonte registra o agente quando a conferência é assistida. Fontes podem ser conferidas por agente (SHA-256 igual ao catálogo e arquivo íntegro) e o gabarito registra `key_finality`: `DECLARED` ou `ONLY_PUBLISHED` (migration 011). O caminho humano não muda.
3. **Sem rota HTTP.** A publicação assistida é uma ferramenta administrativa (`npm run publish:assisted`, empacotada em `dist/admin/publish-assisted.mjs`). Ela lê o relatório do extrator, o manifesto de recortes, o arquivo de conferência `data/agent-reviews/<prova>.json` e `data/answer-key-finality.json`, e publica numa única transação com advisory lock. Recusa: conferente igual ao extrator, manifesto diferente do conferido, fragmentos trocados ou fora de ordem, letra diferente do gabarito extraído, item anulado ou discursivo, prova ou gabarito fora do catálogo, versão em edição na curadoria. Republicar o mesmo conteúdo não cria versão (resumo SHA-256 em `question_version_assisted`).
4. **O que o estudante vê.** A questão é a imagem, na escala de impressão, com "Ampliar" em diálogo de tela cheia; as alternativas viram uma folha de respostas por letra; a transcrição fica recolhida como apoio e para leitores de tela. Rótulo: "Transcrição automatizada do PDF oficial, conferida por agentes; sem revisão humana. Em caso de diferença, vale a imagem." Depois da resposta, o link do gabarito diz se ele é definitivo ou o único publicado (D10). Nada sobre o gabarito aparece antes da resposta.
5. **Explicação.** Quando houver análise em `data/question-reviews/<ano>-review.json`, ela entra com crédito "Explicação gerada por IA (<agente>), sem revisão humana". Sem análise, a questão sai sem explicação e a interface diz isso (D11).

## Consequências

- Uma questão oficial chega ao estudo sem nenhuma conta humana, mas com quem extraiu, quem conferiu, quando e o quê ficando no banco. Despublicar por origem `ASSISTED` continua possível sem perder histórico.
- Produção precisa de volume persistente em `/data` para PDFs e imagens (ver [DEPLOY](DEPLOY.md)). Levar relatórios, recortes e fontes ao servidor é a tarefa DEP-2.
- As imagens são servidas só a sessões (a mesma regra do resto do estudo) e com cache privado imutável. Não há variantes por largura: o mesmo arquivo de 200 dpi serve leitura e ampliação; no celular a leitura confortável fica no "Ampliar".
- Risco residual da ADR 010 permanece: erro que os dois agentes não percebam. A imagem sempre visível é a mitigação; falta o canal para o estudante reportar divergência.
