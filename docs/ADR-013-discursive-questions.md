# ADR 013 — Discursivas: padrão de resposta e autoavaliação

Status: implementada em `claude/confident-cray-ndnwmk` (DISC-1), pedido de Gabriel em 31/10/2026.

## Contexto

Cada prova do ENADE de Computação tem cinco discursivas (duas de Formação Geral e três específicas), e o Inep publica um PDF de padrão de resposta com o que se espera de cada uma e o valor de cada item ("(valor: 5,0 pontos)"). Corrigir texto livre automaticamente não é confiável. O modelo das objetivas exige alternativas e gabarito, então não serve para as discursivas.

## Decisão

1. **Tabelas próprias** (migration 019): `discursive_question` (prova, padrão de resposta, número, área, assunto e itens de avaliação), `discursive_image` (recortes `PROMPT` e `STANDARD`) e `discursive_response` (rascunho, envio e autoavaliação por identidade de estudo). As objetivas não mudam.
2. **Entrada só pelo importador** (ADR-012), com o PDF do padrão de resposta opcional no lote. A leitura (`scripts/lib/response-standard.mjs`) separa os blocos "PADRÃO DE RESPOSTA", liga cada um à discursiva pelo número do cabeçalho ou, sem cabeçalho, pela ordem, só quando a contagem bate. Os itens e valores são lidos do enunciado. O que não bate vira aviso, e a pessoa desenha a caixa. Conferido em 2011, 2014, 2017 e 2021: cinco blocos cada. 2005 e 2008 (cadernos de vários cursos) ficam para ajuste manual.
3. **Conferência por um administrador**, como nas objetivas importadas: caixas do enunciado e do padrão, itens (rótulo a–f, 0,5 a 10 pontos) e área. A confirmação exige as duas caixas e itens válidos, no servidor e no banco.
4. **Fluxo do estudante:**
   - escreve a resposta, e o rascunho é salvo sozinho com revisão otimista;
   - ao enviar, o texto fica imutável (trigger) e só então o padrão de resposta aparece. A rota de imagens também só entrega o recorte `STANDARD` a quem já enviou;
   - autoavaliação por item: não contemplei, em parte ou contemplei (0, 1 ou 2). A nota estimada é a soma de pontos × nível ÷ 2, sempre rotulada como estimativa, não nota oficial.

## Consequências

- Não há correção automática nem por IA. Uma correção assistida futura deveria ser opcional, mostrar o padrão como referência e manter a autoavaliação.
- As discursivas de 2005–2021 entram reimportando cada prova com o padrão de resposta, conferindo pela tela.
- Simulado completo (SIM-1/2) pode reaproveitar `discursive_response` para a discursiva da prova.
- O professor ainda não vê as respostas da turma; isso exige decidir antes o consentimento do aluno.
