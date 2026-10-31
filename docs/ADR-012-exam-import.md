# ADR 012 — Importação de provas futuras pela interface

Status: implementada em `claude/confident-cray-ndnwmk` (IMP-1), pedido de Gabriel em 31/10/2026.

## Contexto

O sistema será usado a cada edição do ENADE de Computação, mantido pela Fábrica de Software. Quem administra precisa trazer a prova e o gabarito novos sem rodar scripts nem depender de agentes de IA. As provas de 2005–2021 mostraram que a extração automática acerta a maior parte das caixas, mas sempre sobra algum recorte a ajustar (14 de 247).

## Decisão

1. O administrador envia a prova e o gabarito em PDF, com os links do Inep de onde vieram. Os arquivos ficam no arquivo de fontes pelo SHA-256.
2. Um processo separado (`scripts/import-exam.mjs`) roda a mesma biblioteca de extração das edições anteriores e grava, por questão, a caixa proposta, a letra do gabarito, a transcrição e avisos legíveis. A requisição HTTP não espera a leitura do PDF.
3. A tela de importação mostra cada página com as caixas desenhadas. A pessoa move, redimensiona, acrescenta ou remove caixas (mouse, toque ou teclado), escolhe área e assunto e confirma ou deixa a questão de fora. Discursivas e anuladas não podem ser confirmadas.
4. Publicar recorta as caixas confirmadas em 200 dpi (WebP sem perda) e cria versões com `review_origin = 'IMPORT'`: uma conta com papel de administrador é a revisora registrada. Fontes ficam com `verification_origin = 'IMPORT'`. Republicar não duplica questões (migration 015).

## Consequências

- Uma pessoa confere sozinha, ao contrário do caminho HUMAN (duas contas). É o mesmo nível de controle de quem publica um material da coordenação, com a imagem original sempre visível ao estudante e a autoria registrada.
- A imagem de produção passa a incluir `poppler-utils` e ImageMagick.
- Explicações não são geradas na importação: as questões saem sem explicação (D11) e podem ganhar uma versão nova pela curadoria.
- Provas só em papel (sem texto no PDF) ainda não têm caminho; exigiriam OCR e ficam fora deste escopo.
