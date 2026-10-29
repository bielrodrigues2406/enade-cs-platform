# Prontidão para estudo — auditoria de 29/10/2026

**Atualização posterior:** Gabriel pediu concluir CAT-1 e ampliar o treino parcial; D12 no quadro transfere o catálogo ao Codex e substitui a proposta de cinco por 10/20/30 (padrão 20), condicionado ao acervo. O texto abaixo preserva o estado e a proposta no momento desta auditoria.

Pedido de Gabriel: testar o sistema com agentes, conferir simulado parcial e organização por áreas e melhorar o uso sem ampliar funcionalidades sem necessidade. Base `11fbb43`, após o PR #19.

Três agentes atuaram separadamente: aluno (`audit_student`), professor/curador (`audit_curator`) e capacidades/dados (`audit_capabilities`). Aluno e curador executaram jornadas reais em Chromium, em slots separados; o terceiro consultou código e PostgreSQL em transação somente leitura. São perspectivas simuladas por agentes, sem entrevistas ou comprovação de aprendizagem.

## O que existe de fato

| Pergunta | Estado verificado |
| --- | --- |
| Simulado parcial já existe? | **Não.** O estudo livre filtra assuntos e mostra feedback após cada resposta. Não há modelo de tentativa, finalização ou tela de simulado. |
| Simulado completo existe? | **Não.** SIM-1/SIM-2 são planejamento; não há tabelas, rotas ou componentes de simulado. |
| As questões estão catalogadas por áreas? | **Parcialmente.** As três demos públicas têm assunto. Na fila privada, 169/605 têm assunto descritivo, com 137 rótulos livres; 436 estão sem assunto. A lista de 18 áreas canônicas é exigida nos vereditos ASSISTED, mas não existe mapeamento integral entre esses assuntos e as áreas. |
| O que o aluno pode estudar agora? | Três questões autorais demonstrativas. Nesta captura há zero oficiais publicadas; os 605 registros privados não são 605 questões únicas disponíveis. |
| Quanto conteúdo foi conferido por imagem? | 16 objetivas de 2021, 11 APPROVED e cinco BLOCKED. Aprovação de recorte não equivale a publicação nem valida toda a transcrição auxiliar. |
| O catálogo já suporta o acervo completo? | Ainda tem limite de 50, sem total/paginação; o filtro de assunto é derivado dos itens retornados. A tarefa CAT-1 continua com Claude. |
| Há função específica de professor/turmas? | Não. Existe curadoria autorizada de conteúdo; esse papel não dá acesso ao histórico dos estudantes. Não há demanda validada para criar um LMS. |

Evidências de código: catálogo e resposta em `apps/api/src/main.ts`; `topic` livre em `curation.ts` e `question-imports.ts`; áreas canônicas em `assisted-publication.ts`; telas em `apps/web/src/`; inventário em `migrations/`. `source_document.area` identifica o curso da prova, não uma disciplina como Redes.

## Conteúdo antes de controles de simulado

Os 11 itens com recortes aprovados, ainda privados, têm esta cobertura:

| Área | Aprovados |
| --- | ---: |
| Formação Geral | 6 |
| Sistemas operacionais | 1 |
| Algoritmos | 1 |
| Inteligência artificial | 1 |
| Engenharia de software | 1 |
| Arquitetura de computadores | 1 |

Hoje nenhuma área tem cinco questões públicas. Mesmo depois de publicar os 11 aprovados, só Formação Geral comporta cinco; nenhuma área comporta dez. Não duplicar itens para completar uma seleção nem somar demonstrações como conteúdo oficial.

Os 169 assuntos preenchidos e 137 rótulos não constituem uma taxonomia pronta. É necessário mapear a área ampla e conservar o assunto específico com revisão rastreável. As outras 436 ocorrências não devem receber classificação automática apresentada como aprovada. O inventário permanece com 28 PDFs individuais e 33 ausentes; os derivados auxiliares continuam em quarentena.

## Falhas reproduzidas e correções desta etapa

| Prioridade | Evidência antes da correção | Ação |
| --- | --- | --- |
| P1 · aluno | Em `/questoes`, o link de salto `#content` resolve contra a base `/`, carrega a home e perde filtro ou alternativa ainda não confirmada. Capturas `student/skip-filtered-catalog-*` e `student/skip-unsaved-resolution-*`. | Cancelar essa navegação e mover somente o foco ao `main` da tela atual. Regressão por teclado preserva URL, filtro e seleção. |
| P1 · curador | Edição autoral não salva desaparece ao voltar à fila, usar o menu ou recarregar, sem aviso. Capturas `curator/author-unsaved-1440.png` e `author-after-back-1440.png`. | Proteger alterações locais, pedir descarte ao voltar e avisar antes de recarregar; liberar navegação após salvar ou descartar. Reutilizar o padrão da Importação. |

Os fluxos aluno→erro→caderno→correção→reload, seleção vazia e recuperação por limpar filtros passaram na auditoria. Curadoria sem papel recebeu 403 e não apareceu na navegação; a fila real foi somente lida. A conta TEST ONLY usada no teste foi removida com seu papel e sessões. Nenhuma fonte ou questão real foi aprovada, alterada ou publicada pelos agentes.

Após as correções, o agente de aluno repetiu os quatro casos de salto (filtro/resolução em 390/1440): URL, foco e estado foram preservados. O agente de curadoria concluiu 11 checks adicionais, incluindo reload real com `beforeunload`: cancelar manteve o texto e impediu o recarregamento. Formulário vazio pode sair sem aviso; cancelar retorno conserva os campos; descartar libera a navegação. O aviso foi inspecionado sem overflow em 320/390/768/1440. As revisões cruzadas de código não encontraram bloqueadores. Capturas posteriores: `student/after-fix-skip-*` e `curator/guard-warning-after-*`.

Não houve overflow global nas telas verificadas em 320/390/768/1440 px; o aluno também verificou texto ampliado a 200% em 1280 px. Isso não certifica WCAG, leitor de tela real, Firefox/WebKit, aprendizagem ou satisfação. O modo de questão oficial em imagem não foi usado nessa jornada porque não há oficiais publicadas; seus testes próprios continuam necessários.

## Três próximas entregas, em ordem

1. **Conteúdo utilizável e classificação coerente — Claude em publicação, Codex em conferência.** Publicar pelo caminho vigente apenas os 11 aprovados, respeitando os lotes e seus conferentes; ampliar as áreas nos próximos lotes. Critério: questão distinta disponível ao aluno, fonte/gabarito/recortes íntegros e área explícita. Preservar Q5/Q8/Q12/Q13/Q14 bloqueadas e itens anulados fora da pontuação.
2. **Encontrar e retomar o conteúdo — CAT-1 com Claude.** Total/paginação reais, filtros por área/edição e seleção retomável por endereço. Na fila privada, priorizar localização por prova/ano/número e prévia do recorte ao lado da transcrição, reutilizando IMG-I1/IMG-U1. Não construir um segundo visualizador nem um editor amplo de provas antes de resolver essas tarefas.
3. **Treino parcial pequeno — SIM-1/SIM-2 com Codex.** Proposta inicial: cinco questões mistas quando houver pelo menos cinco distintas publicadas, resultado apenas ao finalizar e retomada segura. Oferecer área ou dez somente com quantidade suficiente, deixando o aluno escolher uma quantidade menor quando faltar conteúdo. Contrato de tentativa deve fixar versões/alternativas, isolar usuários, preservar respostas e tornar finalização idempotente; gabarito não aparece antes do final. Se houver limite de tempo, o prazo pertence ao servidor e não reinicia no reload. Não apresentar esse treino como prova oficial completa nem como previsão de nota ENADE.

O terceiro item é proposta de próximo incremento, **não implementação nesta auditoria**. Um mapa de 18 áreas quase vazio e uma configuração extensa de simulado teriam pouco valor agora.

## Melhorias de telas com utilidade demonstrada

| Tela | Próxima melhoria útil |
| --- | --- |
| Início | Manter uma ação clara de começar/retomar e contagens reais; não ampliar painéis antes de existir conteúdo. |
| Banco | Concluir CAT-1, exibindo total real e filtros que correspondam à cobertura disponível. |
| Resolução | Corrigir o salto de teclado sem perder contexto; preservar leitura, ampliação e procedência existentes. |
| Caderno de erros | Manter a fila e os filtros que já passaram; não acrescentar outro resumo com os mesmos dados. |
| Curadoria | Evitar perda de edição agora; depois localizar o lote e comparar imagem/transcrição no próprio item. |

Ranking, streak, gamificação, tutor/geração por IA, busca semântica, plano adaptativo, novas notificações e turmas ficam adiados. Recuperação de conta, privacidade e operação pertencem à preparação para acesso público, não a novos modos de estudo.

Relatórios, capturas e agregados reproduzíveis ficam em `.local/product-audit-2026-10-29/`. Os dados foram capturados antes das fixtures de navegador. Esta auditoria não iniciou migrations nem implementou simulado, upload ou catálogo novo.

## Validação e entrega

Passaram, em sequência, `npm run build`, `npm test` (**122 testes API/PostgreSQL/utilitários**) e `CI=true npm run test:e2e -- --timeout=60000` (**33 Chromium**). Foram acrescentadas duas regressões do salto por teclado e duas de proteção de edição; os testes existentes também verificam proteção após falha e liberação após revisão/reabertura. A checagem final dos dados confirmou os mesmos 605 registros, 169 assuntos preenchidos/137 rótulos e apenas três demos públicas, após limpar as fixtures.

As revisões cruzadas de código e documentação não encontraram bloqueadores. As oito skills locais de design foram lidas como orientação; não se transformaram em novas dependências ou obrigação de redesenhar a marca. Entrega no [PR #20](https://github.com/bielrodrigues2406/enade-cs-platform/pull/20), com commits separados para salto, curadoria e relatório/prioridades.
