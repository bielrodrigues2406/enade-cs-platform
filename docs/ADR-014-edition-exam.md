# ADR 014 — Prova completa da edição

Status: implementada em `claude/confident-cray-ndnwmk` (núcleo de SIM-1/SIM-2), pedido de Gabriel em 31/10/2026. O Codex estava sem limite; a tarefa passou ao Claude.

## Contexto

O treino parcial (ADR-007) já tem versões fixas, salvamento com revisão, finalização idempotente e resultado só no fim. Falta praticar a prova como ela é: as questões de uma edição, na ordem, com o tempo da prova e as discursivas.

## Decisão

1. **Mesmo modelo de tentativa** (migration 020): `practice_attempt.kind` passa a ser `PARTIAL` ou `EDITION`. A prova da edição guarda a prova oficial (`exam_source_id`) e o prazo (`deadline_at`), e os três ficam imutáveis como o restante da configuração. As rotas de item, finalização e leitura não mudam.
2. **Seleção:** todas as objetivas publicadas e oficiais daquela prova, na ordem do número original. Edições com menos de 20 objetivas publicadas não são oferecidas. A lista mostra os números ausentes ("faltam 29 e 33, anuladas ou ainda não publicadas") e, nos cadernos compartilhados, não mostra lacunas.
3. **Tempo no servidor:** 4 horas a partir do início. Leitura ou gravação depois do prazo (com 15 s de folga) finaliza a tentativa com o que estava salvo, e a gravação responde 409. O cronômetro da tela só exibe o prazo. Ao zerar, recarrega o resultado registrado.
4. **Discursivas da edição:** são escritas dentro da prova pelo mesmo componente e rascunho da DISC-1 (ADR-013). Finalizar a prova envia os rascunhos com texto. O padrão de resposta e a autoavaliação ficam na tela de discursivas, depois do envio.
5. **Resultado:** o resumo ganha `byBlock`, com Formação Geral e componente específico, como no boletim do ENADE. Resultados antigos sem o campo continuam válidos.

## Consequências

- Não há nota ENADE estimada. Pesos e conceito do Inep não se aplicam a um subconjunto de questões.
- Quem sai durante a prova perde tempo, como na prova real. A confirmação antes de começar avisa isso.
- O formato de 2026 (15 FG + 30 específicas + 1 discursiva) só poderá ser simulado com questões oficiais de 2026, depois da aplicação. Até lá, a prova completa usa as edições anteriores.
- O treino passou a ser carregado sob demanda, o que reduziu o pacote inicial.
