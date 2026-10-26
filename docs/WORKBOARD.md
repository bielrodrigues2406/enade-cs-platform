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
| SRC-1 | Aquisição dos PDFs de todos os anos, cópias fixadas, catálogo e importação offline (pedido direto de Gabriel, iniciado antes deste quadro) | Codex | em revisão | — | [#9](https://github.com/bielrodrigues2406/enade-cs-platform/pull/9), `codex/feat-source-bundles` | `migrations/006_source_acquisition.sql`, `data/official-sources.json`, importadores, fontes e testes |
| OPS-1 | CI no GitHub Actions: build, `npm test` e E2E com PostgreSQL de serviço | Claude | pronta | — | | `.github/workflows/ci.yml` |
| DS-1 | Fundação visual: tokens completos (incluindo molas e durações), tipografia, header compacto, remoção de cores soltas | Claude | em revisão | — | `claude/confident-cray-ndnwmk` (PR #8) | `apps/web/src/styles.css`, `apps/web/src/index.html`, shell em `apps/web/src/main.ts` |
| DS-2 | Redesenho das telas de estudo: catálogo, resolução, caderno de erros, com motion (molas, View Transitions) | Claude | backlog | DS-1 | | `apps/web/src/main.ts`, `apps/web/src/review.component.ts`, `tests/browser/study.spec.ts`, `tests/browser/review.spec.ts` |
| DS-3 | Aplicar a fundação a conta, curadoria e fontes | Claude | backlog | DS-1 | | `account.component.ts`, `curation.component.ts`, `sources.component.ts` |
| CT-1 | Versões de questão com imagens (texto alternativo revisado) e status de anulação | Codex | pronta | — | | `migrations/006_*`, `apps/api/src/curation.ts`, `apps/api/src/editorial.ts`, `apps/web/src/curation.component.ts`, `tests/curation.test.ts` |
| SIM-1 | Simulados — banco e API. Dois modos: **completo** no formato da edição (Formação Geral + componente específico, objetivas e discursivas, tempo total da prova; para 2026, 15 objetivas de FG + 30 objetivas e 1 discursiva específicas em 4 h, conforme MASTER-SPEC §2, revalidar antes de publicar) e **por área/assunto** (tamanho e tempo configuráveis). Configuração de formato por edição em dados, não fixa no código; deadline no servidor, autosave com revisão, finalização idempotente, nada de gabarito antes de finalizar (P03, P06–P09) | Codex | pronta | — | | `migrations/007_*`, `apps/api/src/exam.ts`, `tests/exam.test.ts`, `docs/API.md` (seção simulados), ADR-006 |
| SIM-2 | Simulados — interface: escolha completo/por área, folha de respostas com navegação por número e marcação "revisar depois", tempo restante, revisão antes de finalizar, resultado por bloco (FG/específico) e por assunto, discursiva com padrão de resposta e autoavaliação por critérios | Codex | backlog | SIM-1, DS-1 | | `apps/web/src/exam.component.ts`, `tests/browser/exam.spec.ts` |
| PRG-1 | Desempenho por assunto: acertos/total/período, itens repetidos e amostra pequena sinalizados | Claude | backlog | DS-1; contrato SIM-1 para incluir simulados | | `apps/api/src/progress.ts`, `apps/web/src/progress.component.ts`, `tests/progress.test.ts` |
| DIAG-1 | Teste rápido de diagnóstico: poucas questões de assuntos diversos, feedback só no final, resultado aponta os assuntos a priorizar com amostra (acertos/total) explícita e sem prometer proficiência; leva ao caderno/estudo do assunto | Claude | backlog | SIM-1 (modelo de tentativa sem gabarito antecipado), PRG-1, conteúdo cobrindo vários assuntos | | `apps/api/src/diagnostic.ts` ou extensão de `exam.ts` combinada com Codex, `apps/web/src/diagnostic.component.ts`, `tests/diagnostic.test.ts` |
| ACC-1 | Troca de senha autenticada e encerramento das demais sessões | Codex | backlog | — | | `apps/api/src/auth.ts`, `apps/web/src/account.component.ts`, `tests/accounts.test.ts` |
| CNT-1 | Lote oficial inicial (ENADE 2021 CC): importar PDFs, conferir com segunda conta, transcrever e revisar até 20 itens | Gabriel | bloqueada | CT-1 para itens com imagem/anulação | | conteúdo no banco, `docs/OFFICIAL-SOURCES.md` |
| DEP-1 | Deploy de R1: hospedagem, HTTPS, banco gerenciado, backups com restauração ensaiada, variáveis por ambiente | Claude + Gabriel | bloqueada | D1, OPS-1 | | a definir |
| PLN-1 | Plano de estudos inicial com prioridades explicadas | — | backlog | PRG-1 | | |
| REV-1 | Repetição espaçada no caderno de erros | — | backlog | PRG-1 | | |

### Notas de coordenação

- **Integração SRC-1:** Gabriel já autorizou nesta sessão abrir PR e fazer merge preservando commits, após validação/revisão. D4 permanece como decisão geral das demais trilhas. A revisão independente solicitada aqui é de agente Codex; não será apresentada como revisão da trilha Claude nem como revisão editorial humana.

- **SRC-1 × CT-1/SIM-1:** a aquisição solicitada por Gabriel já tinha a migration 006 criada/aplicada antes do protocolo. CT-1 e SIM-1 continuam prontas, com reservas ajustadas para 007/008; SIM-1 usa ADR-007. Nenhuma migration aplicada foi renomeada. SRC-1 não transcreve nem aprova questões; CNT-1 e D5 permanecem humanos. A branch foi ajustada ao prefixo `codex/`; as únicas mudanças do shell são o rótulo de edição e o nome de caderno compartilhado.

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
| UX-3 | "Próxima questão" após o feedback, seguindo o filtro atual | Menos cliques entre questões | DS-2 | R1 |
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
| 007 | CT-1 | Codex |
| 008 | SIM-1 | Codex |
| 009 | próxima livre — reserve aqui antes do primeiro commit | |

## Decisões pendentes (Gabriel)

| ID | Decisão | Impacto |
| --- | --- | --- |
| D1 | Onde hospedar R1 (provedor, domínio, PostgreSQL gerenciado) e quem opera backups | Bloqueia DEP-1 |
| D2 | Provedor de e-mail para confirmação/recuperação de conta, ou lançar R1 sem recuperação (limitação já informada no cadastro) | Escopo de contas em R1 |
| D3 | ~~Adotar as skills de design-taste~~ — aprovado em 26/10; copiadas para `.claude/skills/` | DS-1/DS-2 |
| D4 | Agentes podem fazer merge após revisão cruzada, ou o merge é sempre seu | Fluxo de integração |
| D5 | Quem será a segunda conta de curadoria para conferência independente | Bloqueia CNT-1 |

## Diário (handoffs)

Entradas mais novas no topo. Formato: data · agente · tarefa · branch@commit · estado · próximo passo.

- 26/10/2026 · Claude · DS-1 · `claude/confident-cray-ndnwmk` · tokens, fontes, shell, alternativas com estado certo/errado e feedback editorial; build, 39 testes API e 18 E2E passando · Codex: ao tocar UI, use apenas tokens semânticos de `styles.css` e leia `.claude/skills/README.md` e DESIGN-QUALITY §3.1. Próximo de Claude: OPS-1 (CI) e DS-2.

- 26/10/2026 · Claude · COORD-0 · `claude/confident-cray-ndnwmk` · documentos de coordenação e avaliação de design enviados para revisão · Codex pode iniciar CT-1 ou SIM-1 a partir de `origin/main` assim que este PR for integrado; Claude segue para OPS-1 e DS-1.
