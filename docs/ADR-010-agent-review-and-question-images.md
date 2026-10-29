# ADR 010 — Conferência por agentes e imagem original da questão

Status: decidida por Gabriel em 28/10/2026; implementação pendente. Complementa a [ADR 009](ADR-009-question-intake.md) e altera, para conteúdo oficial transcrito de PDF, a exigência de revisão humana de MASTER-SPEC §5 e ADR-003/004.

## Contexto

Gabriel informou que não fará a conferência humana das questões e que não há segunda pessoa de curadoria (D5). Sem mudança, nenhuma questão oficial chega ao estudante antes da prova de 29/11/2026. As extrações mostraram erros silenciosos possíveis: figuras vetoriais, símbolos trocados por fontes Symbol, texto em números de glifo (2014/2017), ligaduras e versalete.

## Decisão

1. **Imagem original como referência.** Cada questão oficial publicada a partir de PDF exibe o recorte da própria prova (região da questão renderizada a partir do PDF original arquivado, com página e SHA-256). O texto extraído acompanha a imagem para leitura, busca e leitores de tela. Em divergência, vale a imagem, e a interface diz isso.
2. **Conferência por agentes, nunca por quem extraiu.** Um agente extrai (Claude) e outro confere (Codex), comparando texto, alternativas e gabarito com o recorte e com o gabarito definitivo. A conferência é registrada como `ASSISTED`, com agente, data e resultado; nunca como revisão humana.
3. **Publicação só sem pendências.** Publica-se apenas objetiva com: numeração completa, gabarito definitivo, alternativas do caderno conferidas (A–E, ou A–D nas edições correspondentes), nenhuma divergência aberta. Anuladas não entram no estudo. Itens com figura podem entrar porque a imagem acompanha a questão; ainda assim exigem conferência do texto ao redor.
4. **Rótulo visível.** A questão informa: "Transcrição automatizada do PDF oficial, conferida por agentes; sem revisão humana". O crédito da questão continua Inep; a explicação, se houver, tem autoria própria identificada (sem explicação gerada apresentada como oficial).
5. **Discursivas** continuam fora do estudo até existir contrato de discursiva (padrão de resposta + autoavaliação).
6. **Texto de 2014/2017** é extraído de uma cópia derivada com mapa Unicode da Calibri (`scripts/repair-calibri-text.py`); imagem e procedência vêm do original.

## Consequências

- Exige implementar imagens de questão (CT-1 ampliado: armazenamento do recorte com hash, exibição na resolução e na curadoria) e um caminho de publicação por agente que não simule conta humana.
- A regra "publicação por outra conta de curadoria" deixa de ser o único caminho para conteúdo oficial transcrito; o caminho por agentes fica registrado em evento próprio e auditável.
- Risco residual: erro de transcrição não percebido pelos dois agentes. Mitigação: imagem original sempre visível e canal para o estudante reportar divergência.
- Reverter a decisão significa despublicar os itens com origem de conferência `ASSISTED`; o histórico permanece.
