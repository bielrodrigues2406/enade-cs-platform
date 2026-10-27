# Quadro de trabalho — Claude Code × Codex

Atualizado em 26/10/2026. Regras de uso em [COLLABORATION.md](COLLABORATION.md). Edite linha a linha; não reordene a tabela inteira.

Status: `pronta` · `em andamento` · `em revisão` · `entregue` · `bloqueada` · `backlog`

## Meta da primeira versão pública (R1)

A prova de bacharelados/CST está prevista para 29/11/2026 (MASTER-SPEC §2). R1 deve estar no ar com folga para uso real dos estudantes: **corte de funcionalidades em 16/11/2026**, deploy até 20/11/2026, sujeito à decisão D1.

Entra em R1: estudo/caderno de erros já entregues, interface revisada (DS-1/DS-2), simulado no formato da edição com itens revisados (SIM-1/SIM-2), desempenho por assunto (PRG-1), teste rápido de diagnóstico (DIAG-1, se houver conteúdo em assuntos suficientes), lote oficial inicial (CNT-1, humano), CI e deploy. Fica para depois: plano de estudos, repetição espaçada, discursivas com autoavaliação completa, IA, busca semântica, PWA.

Sem lote oficial revisado, R1 sai com conteúdo autoral identificado como tal. Nenhum agente cria questões oficiais para cumprir prazo.

## Tarefas

| ID | Tarefa | Dono | Status | Depende de | Branch / PR | Arquivos principais |
| --- | --- | --- | --- | --- | --- | --- |
| COORD-0 | Protocolo de colaboração, quadro e avaliação de design | Claude | entregue | — | [#7](https://github.com/bielrodrigues2406/enade-cs-platform/pull/7), `59425c0` | `docs/COLLABORATION.md`, `docs/WORKBOARD.md`, `docs/DESIGN-QUALITY.md`, `AGENTS.md` |
| SRC-1 | Aquisição dos PDFs de todos os anos, cópias fixadas, catálogo e importação offline (pedido direto de Gabriel, iniciado antes deste quadro) | Codex | entregue | — | [#9](https://github.com/bielrodrigues2406/enade-cs-platform/pull/9), `7a4049c` | `migrations/006_source_acquisition.sql`, `data/official-sources.json`, importadores, fontes e testes |
| SRC-2 | Confinar caminhos do downloader e preservar recibos válidos após falhas | Codex | entregue | SRC-1 | [#10](https://github.com/bielrodrigues2406/enade-cs-platform/pull/10), `e46c54a` | `scripts/download-sources.mjs`, `tests/source-download.test.ts`, `docs/OFFICIAL-SOURCES.md` |
| OPS-1 | CI no GitHub Actions: build, `npm test` e E2E com PostgreSQL de serviço | Claude | em revisão | — | [#11](https://github.com/bielrodrigues2406/enade-cs-platform/pull/11) | `.github/workflows/ci.yml` |
| DS-1 | Fundação visual: tokens completos (incluindo molas e durações), tipografia, header compacto, remoção de cores soltas | Claude | entregue | — | [#8](https://github.com/bielrodrigues2406/enade-cs-platform/pull/8), `d193493` | `apps/web/src/styles.css`, `apps/web/src/index.html`, shell em `apps/web/src/main.ts` |
| DS-2 | Redesenho das telas de estudo: catálogo, resolução, caderno de erros, com motion (molas, View Transitions) | Claude | em revisão | DS-1 | [#11](https://github.com/bielrodrigues2406/enade-cs-platform/pull/11) | `apps/web/src/main.ts`, `apps/web/src/review.component.ts`, `tests/browser/study.spec.ts`, `tests/browser/review.spec.ts` |
| DS-3 | Aplicar a fundação a conta, curadoria e fontes | Claude | backlog | DS-1 | | `account.component.ts`, `curation.component.ts`, `sources.component.ts` |
| CT-1 | Versões de questão com imagens (texto alternativo revisado) e status de anulação | Codex | pronta | — | | `migrations/008_*`, `apps/api/src/curation.ts`, `apps/api/src/editorial.ts`, `apps/web/src/curation.component.ts`, `tests/curation.test.ts` |
| SIM-1 | Simulados — banco e API. Dois modos: **completo** no formato da edição (Formação Geral + componente específico, objetivas e discursivas, tempo total da prova; para 2026, 15 objetivas de FG + 30 objetivas e 1 discursiva específicas em 4 h, conforme MASTER-SPEC §2, revalidar antes de publicar) e **por área/assunto** (tamanho e tempo configuráveis). Configuração de formato por edição em dados, não fixa no código; deadline no servidor, autosave com revisão, finalização idempotente, nada de gabarito antes de finalizar (P03, P06–P09) | Codex | pronta | — | | `migrations/009_*`, `apps/api/src/exam.ts`, `tests/exam.test.ts`, `docs/API.md` (seção simulados), ADR-007 |
| SIM-2 | Simulados — interface: escolha completo/por área, folha de respostas com navegação por número e marcação "revisar depois", tempo restante, revisão antes de finalizar, resultado por bloco (FG/específico) e por assunto, discursiva com padrão de resposta e autoavaliação por critérios | Codex | backlog | SIM-1, DS-1 | | `apps/web/src/exam.component.ts`, `tests/browser/exam.spec.ts` |
| PRG-1 | Desempenho por assunto: acertos/total/período, itens repetidos e amostra pequena sinalizados | Claude | backlog | DS-1; contrato SIM-1 para incluir simulados | | `apps/api/src/progress.ts`, `apps/web/src/progress.component.ts`, `tests/progress.test.ts` |
| DIAG-1 | Teste rápido de diagnóstico: poucas questões de assuntos diversos, feedback só no final, resultado aponta os assuntos a priorizar com amostra (acertos/total) explícita e sem prometer proficiência; leva ao caderno/estudo do assunto | Claude | backlog | SIM-1 (modelo de tentativa sem gabarito antecipado), PRG-1, conteúdo cobrindo vários assuntos | | `apps/api/src/diagnostic.ts` ou extensão de `exam.ts` combinada com Codex, `apps/web/src/diagnostic.component.ts`, `tests/diagnostic.test.ts` |
| ACC-1 | Troca de senha autenticada e encerramento das demais sessões | Codex | backlog | — | | `apps/api/src/auth.ts`, `apps/web/src/account.component.ts`, `tests/accounts.test.ts` |
| CNT-1 | Lote oficial inicial (ENADE 2021 CC): importar PDFs, conferir com segunda conta, transcrever e revisar até 20 itens | Gabriel | bloqueada | D5 (segunda conta de curadoria), DEP-2 para produção, CT-1 para itens com imagem/anulação | | conteúdo no banco, `docs/OFFICIAL-SOURCES.md` |
| CNT-0 | Rascunhos assistidos: gerar questões em estado DRAFT a partir do **texto do próprio PDF** oficial (enunciado, alternativas, página, número, gabarito definitivo), marcando anuladas, discursivas e itens com imagem; nada é publicado sem conferência e revisão de outra conta. Começar por 2021, 2017 e 2014 Bacharelado | Claude | etapa 1 entregue (#12/#13, extração e relatório); etapa 2 implementada em CNT-I1 como fila privada; promoção editorial depende da conferência das fontes e do conteúdo | SRC-1; CT-1 para itens com figura | `claude/confident-cray-ndnwmk` | `scripts/extract-questions.mjs`, `scripts/lib/question-extraction.mjs`, `tests/question-extraction.test.ts` |
| CNT-R1 | Revisão do extrator do PR #12: bloquear texto ausente e gabarito contraditório; conferir resultados e caminho de OCR | Codex | entregue | CNT-0 etapa 1 | [#13](https://github.com/bielrodrigues2406/enade-cs-platform/pull/13), `547fbee` | `scripts/lib/question-extraction.mjs`, `tests/question-extraction-boundaries.test.ts`, `docs/OFFICIAL-SOURCES.md` |
| CNT-I1 | Importar questões arquivadas em fila privada, com revisão assistida e pendências por item; preservar conferência de fontes/publicação | Codex | entregue no PR #14 | SRC-1, CNT-0 etapa 1 | [#14](https://github.com/bielrodrigues2406/enade-cs-platform/pull/14) | `migrations/007_question_intake.sql`, importador, API/fila de importação, revisão e testes |
| DEP-2 | Fontes oficiais em produção: hoje a imagem não importa PDFs, e publicar questão oficial exige a fonte no banco de produção. Empacotar a importação local (`curl`/`pdfinfo`) na imagem ou definir procedimento sem abrir o banco publicamente | — (proposta) | backlog | DEP-1, SRC-2 | | `Dockerfile`, `scripts/import-sources.mjs`, `docs/DEPLOY.md` |
| LGL-1 | Aviso de privacidade (dados coletados, finalidade, retenção, contato) antes de abrir cadastro público | — (proposta) | backlog | D2 | | página web + `docs/` |
| DEP-1 | Deploy de R1: imagem de produção independente de provedor, API servindo a web, cabeçalhos de segurança, proxy confiável, migrations no deploy, guia de deploy e segurança; conta, banco e domínio no provedor ficam com Gabriel | Claude + Gabriel | em revisão (código); conta no provedor com Gabriel | OPS-1 | [#11](https://github.com/bielrodrigues2406/enade-cs-platform/pull/11) | `Dockerfile`, `apps/api/src/serve.ts`, `apps/api/src/main.ts`, `docs/DEPLOY.md`, ADR-008 |
| PLN-1 | Plano de estudos inicial com prioridades explicadas | — | backlog | PRG-1 | | |
| REV-1 | Repetição espaçada no caderno de erros | — | backlog | PRG-1 | | |

### Notas de coordenação

- **CNT-I1:** Gabriel pediu concluir a importação de todas as questões e revisar também o conteúdo. Codex assume a entrada em fila privada e a revisão assistida da etapa 2 de CNT-0; a autoria da etapa 1 permanece Claude. Importar itens para conferência não cria uma aprovação humana nem altera os requisitos de fontes VERIFIED/publicação independente. Reserva 007 realocada antes da criação; CT-1/SIM-1, ainda não iniciadas, passam a 008/009. ADR-007 continua reservado a SIM-1; a fila de importação usa ADR-009.

- **Integração SRC-1:** Gabriel já autorizou nesta sessão abrir PR e fazer merge preservando commits, após validação/revisão. D4 permanece como decisão geral das demais trilhas. A revisão independente solicitada aqui é de agente Codex; não será apresentada como revisão da trilha Claude nem como revisão editorial humana.

- **SRC-1 × CT-1/SIM-1:** a aquisição solicitada por Gabriel já tinha a migration 006 criada/aplicada antes do protocolo. CT-1 e SIM-1 continuam prontas; as reservas atuais são 008/009 após CNT-I1; SIM-1 usa ADR-007. Nenhuma migration aplicada foi renomeada. SRC-1 não transcreve nem aprova questões; CNT-1 e D5 permanecem humanos. A branch foi ajustada ao prefixo `codex/`; as únicas mudanças do shell são o rótulo de edição e o nome de caderno compartilhado.

- **DS-2 × CT-1/SIM-2:** a renderização de imagem na tela de resolução (`apps/web/src/main.ts`) é parte de CT-1, mas só depois de DS-2 entrar ou combinada no quadro. Até lá, CT-1 entrega banco, API e curadoria.
- **SIM-2 × DS-1:** a interface de simulado usa os tokens de DS-1. Se SIM-2 começar antes de DS-1 ser integrado, use apenas variáveis CSS existentes e alinhe no rebase.
- **DIAG-1 × SIM-1:** o diagnóstico é uma tentativa curta, sem tempo, que reutiliza o modelo de tentativa de SIM-1 (seleção de itens, autosave, finalização idempotente, nada de gabarito antes de finalizar). Codex, deixe a seleção de itens por assunto parametrizável no contrato de SIM-1; Claude não cria um segundo modelo de tentativa.
- **PRG-1 × SIM-1:** PRG-1 começa com respostas do estudo livre. Inclui simulados quando o contrato de SIM-1 estiver em `docs/API.md`.

### Regras do simulado completo

- Rotular como "simulado autoral no formato ENADE <edição>", nunca como prova oficial (MASTER-SPEC §5). Pode combinar itens oficiais antigos revisados e autorais identificados.
- Só oferecer o modo completo quando houver itens publicados suficientes para cada bloco do formato; caso contrário, mostrar quantos faltam por bloco em vez de montar um simulado incompleto calado.
- Formação Geral é comum a todos os cursos e precisa de conteúdo próprio (ver CNT-2).
- Nota exibida é "desempenho no simulado" (acertos/total por bloco), sem prever a nota oficial.

## Banco de ideias (priorizar com Gabriel)

Candidatas, sem dono até entrarem na tabela de tarefas. Não contradizem MASTER-SPEC §6 (sem paywall, ranking ou streak).

| ID | Ideia | Valor para o estudante | Depende de | Sugestão |
| --- | --- | --- | --- | --- |
| CNT-2 | Lote de Formação Geral (provas oficiais anteriores, qualquer curso, revisadas) | FG está em todas as provas e é necessária para o simulado completo | CT-1, curadoria humana | R1 |
| UX-1 | Atalhos de teclado na resolução (A–E seleciona, Enter confirma, N próxima) | Ritmo de estudo mais rápido | DS-2 | R1 |
| UX-2 | Modo foco: esconde navegação e deixa só enunciado e alternativas | Leitura e concentração em sessões longas | DS-2 | R1 |
| UX-3 | "Próxima questão" após o feedback, seguindo o filtro atual — **incluído em DS-2** | Menos cliques entre questões | DS-2 | R1 |
| PLN-2 | Contagem regressiva até a prova com plano semanal sugerido a partir do diagnóstico | Organização até 29/11 | DIAG-1, PRG-1 | depois de R1 se não couber |
| REV-2 | Revisão de véspera: lista curta dos conceitos errados com as explicações, para leitura rápida | Revisão final eficiente | caderno de erros | R1 (leve) |
| SIM-3 | Relatório do simulado com tempo gasto por questão e questões marcadas para revisar | Gestão do tempo na prova real | SIM-1/SIM-2 | junto de SIM-2 |
| UX-4 | Tema escuro com tokens próprios e contraste reconferido | Estudo à noite | DS-1 | depois de R1 |
| PWA-1 | Instalação como app e leitura de questões já abertas sem rede | Estudo no celular com rede ruim | DEP-1 | depois de R1 |
| PRT-1 | Exportar simulado para impressão (PDF) com folha de respostas | Treino no papel, como na prova | SIM-1 | depois de R1 |
| GUI-1 | Guia por assunto das diretrizes de Computação, ligado às questões | Estudar o conceito, não só a questão | taxonomia revisada | incremento E |

## Reservas de migration

| Número | Tarefa | Dono |
| --- | --- | --- |
| 006 | SRC-1 — criada/aplicada localmente antes da publicação deste quadro | Codex |
| 007 | CNT-I1 — prioridade de importação solicitada por Gabriel em 26/10 | Codex |
| 008 | CT-1 — reserva anterior ainda não implementada | Codex |
| 009 | SIM-1 — reserva anterior ainda não implementada | Codex |
| 010 | próxima livre — reserve aqui antes do primeiro commit | |

## Decisões pendentes (Gabriel)

| ID | Decisão | Impacto |
| --- | --- | --- |
| D1 | Onde hospedar R1. 26/10: Gabriel escolheu Railway e em seguida apontou o incidente de segredos do Railway (21/10/2026); escolha final pendente após o guia de segurança de DEP-1. O código de deploy fica independente de provedor | Bloqueia publicação de DEP-1 |
| D2 | Provedor de e-mail para confirmação/recuperação de conta, ou lançar R1 sem recuperação (limitação já informada no cadastro) | Escopo de contas em R1 |
| D3 | ~~Adotar as skills de design-taste~~ — aprovado em 26/10; copiadas para `.claude/skills/` | DS-1/DS-2 |
| D4 | Agentes podem fazer merge após revisão cruzada, ou o merge é sempre seu | Fluxo de integração |
| D5 | Quem será a segunda conta de curadoria para conferência independente. A publicação exige outra pessoa; uma única pessoa não consegue publicar sozinha | Bloqueia CNT-1 e todo conteúdo oficial |
| D6 | Escopo de Licenciatura: análise de 26/10 (OFFICIAL-SOURCES) mostra que as provas de Licenciatura repetem a Formação Geral e grande parte das específicas; as exclusivas são pedagógicas. Proposta: R1 só Bacharelado, Licenciatura como segunda procedência | Prioridade de CNT-0/CNT-1 |

## Diário (handoffs)

Entradas mais novas no topo. Formato: data · agente · tarefa · branch@commit · estado · próximo passo.

- 26/10/2026 · Codex · CNT-R1/CNT-0 etapa 1 · `main@547fbee` · PR [#13](https://github.com/bielrodrigues2406/enade-cs-platform/pull/13) integrado com os cinco commits preservados, incluindo os três de Claude; [#12](https://github.com/bielrodrigues2406/enade-cs-platform/pull/12) também consta integrado. Build e 67 testes API/utilitários locais passaram; 20 fluxos Chromium validados (19 na suíte e o fluxo de conta repetido após reiniciar o Vite); revisão independente Codex sem bloqueadores. CI do PR #13: `validate` e `image` aprovados às 19:58:53 UTC, após reexecução do job. No momento do merge a instalação do Chromium estava pendente; a integração usou a validação local concluída e a confirmação remota veio em seguida. Relatório e 13 candidatos de 2021 separados em `.local/exports/revisao-pdfs-claude.zip`. As 27 fontes históricas continuam MIRROR/IMPORTED, 34 PDFs recentes pendentes. Próximo: Gabriel confere candidatos para a etapa 2; OCR integrado é trabalho futuro. Nenhuma aprovação editorial foi simulada.

- 26/10/2026 · Codex · CNT-R1 · `codex/fix-question-extraction@d630958`, PR [#13](https://github.com/bielrodrigues2406/enade-cs-platform/pull/13) incorpora os três commits do [#12](https://github.com/bielrodrigues2406/enade-cs-platform/pull/12), preservando a autoria e a branch de Claude. Revisão reproduziu os relatórios das seis provas 2014/2017/2021 com 12 PDFs conferidos por SHA-256. Corrigidos candidatos com texto ausente e escolha silenciosa de gabarito contraditório; 14 testes do extrator passaram, CI completo pendente. Comparação confirma Q9–Q26 comuns em 2021; ensaio de OCR português na página 4 de 2014 recuperou texto legível, ainda com erros em marcadores/espaçamento. Os 34 PDFs recentes seguem no escopo de aquisição; D6 é proposta. Próximo: concluir revisão independente/CI e integrar somente a etapa 1; sem gravação no banco nem aprovação editorial.

- 26/10/2026 · Claude · CNT-0 etapa 1 · `claude/confident-cray-ndnwmk` (#12) · extrator conservador: 2021 Bacharelado com 13 rascunhos seguros de 33 objetivas válidas; figuras vetoriais, símbolos trocados, texto ilegível (2014/2017), ligaduras e versalete detectados; numeração conferida contra o gabarito · Próximo: Gabriel confere o relatório de 2021; depois criar rascunhos na curadoria (sem publicar).
- 26/10/2026 · Claude · análise de conteúdo · `claude/confident-cray-ndnwmk` · 27 PDFs reconferidos por SHA-256; texto extraível; gabaritos 2014/2017/2021 definitivos, anuladas 2011 (13, 44) e 2021 Bacharelado (29, 33); 103 objetivas utilizáveis em 2014–2021 Bacharelado; Licenciatura repete FG e boa parte do específico · Propostas CNT-0, DEP-2, LGL-1 e decisões D5/D6 para Gabriel.

- 26/10/2026 · Claude · OPS-1, DEP-1 (código), DS-2 · `claude/confident-cray-ndnwmk` (#11) · CI, imagem de produção com cabeçalhos de segurança, guia `docs/DEPLOY.md` e ADR-008; catálogo com progresso honesto, posição na seleção e "Próxima questão", tabela por assunto no caderno, View Transitions. 51 testes API e 20 E2E · Codex: o CI passa a rodar nos PRs; `multer` fixado em 2.5.0 por `overrides`; telas novas devem trocar de tela por `swapView`. D1 aguarda Gabriel após o incidente do Railway.

- 26/10/2026 · Codex · SRC-2 · `main@e46c54a` · PR [#10](https://github.com/bielrodrigues2406/enade-cs-platform/pull/10) integrado preservando os três commits; revisão independente Codex sem bloqueadores; build, 49 testes API/PostgreSQL/utilitários e 18 Chromium passaram (`npm run test:e2e -- --timeout=60000`, com cache e acesso local configurados). O pacote do PC foi atualizado e executado extraído, sem banco/npm install; 27 PDFs históricos reconferidos por SHA-256 e mantidos MIRROR/IMPORTED, 34 links recentes ainda pendentes. Outra trilha: atualizar a base antes de iniciar CT-1/SIM-1 e respeitar reservas 007/008/ADR-007. Revisão editorial humana permanece pendente.

- 26/10/2026 · Codex · SRC-1/SRC-2 · SRC-1 integrado por Gabriel em `7a4049c`; 27 PDFs históricos arquivados/importados e 34 links recentes ainda pendentes. SRC-2 em `codex/fix-source-downloads@70f3e04` corrige dois achados do revisor independente Codex: escape por symlink e perda do último recibo válido. O revisor confirmou as correções sem novos bloqueadores; 49 testes API/PostgreSQL/utilitários passaram. Revalidando build/E2E sobre `c7e45cb` (inclui DS-1), antes do novo PR e merge. Revisão de código não representa revisão editorial humana nem revisão da trilha Claude.

- 26/10/2026 · Claude · DS-1 · `claude/confident-cray-ndnwmk` · tokens, fontes, shell, alternativas com estado certo/errado e feedback editorial; build, 39 testes API e 18 E2E passando · Codex: ao tocar UI, use apenas tokens semânticos de `styles.css` e leia `.claude/skills/README.md` e DESIGN-QUALITY §3.1. Próximo de Claude: OPS-1 (CI) e DS-2.

- 26/10/2026 · Claude · COORD-0 · `claude/confident-cray-ndnwmk` · documentos de coordenação e avaliação de design enviados para revisão · Codex pode iniciar CT-1 ou SIM-1 a partir de `origin/main` assim que este PR for integrado; Claude segue para OPS-1 e DS-1.

- **27/10/2026 · CNT-I1 · Codex:** código implementado em commits por extração, fontes, banco/API, interface e conteúdo. Importação administrativa real concluída neste ambiente: 605 ocorrências em 11 cadernos/trechos (460 históricas + 81 PND 2025 tipo 4 + 64 auxiliares de 2024), 582 HOLD/23 PENDING, zero questões oficiais publicadas. Reimportação retornou 605 inalteradas. Revisão assistida de 80 itens de 2021 e dois de 2014, sem atribuir revisão humana. Os 28 PDFs individuais continuam separados dos dois derivados; faltam 33 originais. Build, 86 testes API/PostgreSQL/utilitários e 22 fluxos Chromium passaram; screenshots da fila e do editor inspecionadas em desktop/mobile. Fontes, OCR, código, imagens e publicação mantêm conferência editorial própria.

- **Entrega CNT-I1:** PR [#14](https://github.com/bielrodrigues2406/enade-cs-platform/pull/14), código validado em `cca6a33`; revisão independente de agente Codex sem bloqueios, sem afirmar revisão humana de conteúdo. CI do código: [validate e image aprovados](https://github.com/bielrodrigues2406/enade-cs-platform/actions/runs/40498893447). O status de entrega entra em main junto ao merge autorizado deste PR; os 33 originais e a curadoria humana seguem pendentes.
