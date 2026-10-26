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
| COORD-0 | Protocolo de colaboração, quadro e avaliação de design | Claude | em revisão | — | `claude/confident-cray-ndnwmk` | `docs/COLLABORATION.md`, `docs/WORKBOARD.md`, `docs/DESIGN-QUALITY.md`, `AGENTS.md` |
| OPS-1 | CI no GitHub Actions: build, `npm test` e E2E com PostgreSQL de serviço | Claude | pronta | — | | `.github/workflows/ci.yml` |
| DS-1 | Fundação visual: tokens completos (incluindo molas e durações), tipografia, header compacto, remoção de cores soltas | Claude | pronta | — | | `apps/web/src/styles.css`, `apps/web/src/index.html`, shell em `apps/web/src/main.ts` |
| DS-2 | Redesenho das telas de estudo: catálogo, resolução, caderno de erros, com motion (molas, View Transitions) | Claude | backlog | DS-1 | | `apps/web/src/main.ts`, `apps/web/src/review.component.ts`, `tests/browser/study.spec.ts`, `tests/browser/review.spec.ts` |
| DS-3 | Aplicar a fundação a conta, curadoria e fontes | Claude | backlog | DS-1 | | `account.component.ts`, `curation.component.ts`, `sources.component.ts` |
| CT-1 | Versões de questão com imagens (texto alternativo revisado) e status de anulação | Codex | pronta | — | | `migrations/006_*`, `apps/api/src/curation.ts`, `apps/api/src/editorial.ts`, `apps/web/src/curation.component.ts`, `tests/curation.test.ts` |
| SIM-1 | Simulados — banco e API: configuração por edição, deadline no servidor, autosave com revisão, finalização idempotente, nada de gabarito antes de finalizar (P03, P06–P09) | Codex | pronta | — | | `migrations/007_*`, `apps/api/src/exam.ts`, `tests/exam.test.ts`, `docs/API.md` (seção simulados), ADR-006 |
| SIM-2 | Simulados — interface: configuração, resolução com tempo, revisão antes de finalizar, resultado | Codex | backlog | SIM-1, DS-1 | | `apps/web/src/exam.component.ts`, `tests/browser/exam.spec.ts` |
| PRG-1 | Desempenho por assunto: acertos/total/período, itens repetidos e amostra pequena sinalizados | Claude | backlog | DS-1; contrato SIM-1 para incluir simulados | | `apps/api/src/progress.ts`, `apps/web/src/progress.component.ts`, `tests/progress.test.ts` |
| DIAG-1 | Teste rápido de diagnóstico: poucas questões de assuntos diversos, feedback só no final, resultado aponta os assuntos a priorizar com amostra (acertos/total) explícita e sem prometer proficiência; leva ao caderno/estudo do assunto | Claude | backlog | SIM-1 (modelo de tentativa sem gabarito antecipado), PRG-1, conteúdo cobrindo vários assuntos | | `apps/api/src/diagnostic.ts` ou extensão de `exam.ts` combinada com Codex, `apps/web/src/diagnostic.component.ts`, `tests/diagnostic.test.ts` |
| ACC-1 | Troca de senha autenticada e encerramento das demais sessões | Codex | backlog | — | | `apps/api/src/auth.ts`, `apps/web/src/account.component.ts`, `tests/accounts.test.ts` |
| CNT-1 | Lote oficial inicial (ENADE 2021 CC): importar PDFs, conferir com segunda conta, transcrever e revisar até 20 itens | Gabriel | bloqueada | CT-1 para itens com imagem/anulação | | conteúdo no banco, `docs/OFFICIAL-SOURCES.md` |
| DEP-1 | Deploy de R1: hospedagem, HTTPS, banco gerenciado, backups com restauração ensaiada, variáveis por ambiente | Claude + Gabriel | bloqueada | D1, OPS-1 | | a definir |
| PLN-1 | Plano de estudos inicial com prioridades explicadas | — | backlog | PRG-1 | | |
| REV-1 | Repetição espaçada no caderno de erros | — | backlog | PRG-1 | | |

### Notas de coordenação

- **DS-2 × CT-1/SIM-2:** a renderização de imagem na tela de resolução (`apps/web/src/main.ts`) é parte de CT-1, mas só depois de DS-2 entrar ou combinada no quadro. Até lá, CT-1 entrega banco, API e curadoria.
- **SIM-2 × DS-1:** a interface de simulado usa os tokens de DS-1. Se SIM-2 começar antes de DS-1 ser integrado, use apenas variáveis CSS existentes e alinhe no rebase.
- **DIAG-1 × SIM-1:** o diagnóstico é uma tentativa curta, sem tempo, que reutiliza o modelo de tentativa de SIM-1 (seleção de itens, autosave, finalização idempotente, nada de gabarito antes de finalizar). Codex, deixe a seleção de itens por assunto parametrizável no contrato de SIM-1; Claude não cria um segundo modelo de tentativa.
- **PRG-1 × SIM-1:** PRG-1 começa com respostas do estudo livre. Inclui simulados quando o contrato de SIM-1 estiver em `docs/API.md`.

## Reservas de migration

| Número | Tarefa | Dono |
| --- | --- | --- |
| 006 | CT-1 | Codex |
| 007 | SIM-1 | Codex |
| 008 | próxima livre — reserve aqui antes do primeiro commit | |

## Decisões pendentes (Gabriel)

| ID | Decisão | Impacto |
| --- | --- | --- |
| D1 | Onde hospedar R1 (provedor, domínio, PostgreSQL gerenciado) e quem opera backups | Bloqueia DEP-1 |
| D2 | Provedor de e-mail para confirmação/recuperação de conta, ou lançar R1 sem recuperação (limitação já informada no cadastro) | Escopo de contas em R1 |
| D3 | Adotar as skills de design-taste recomendadas em DESIGN-QUALITY.md como guia de revisão | DS-1/DS-2 |
| D4 | Agentes podem fazer merge após revisão cruzada, ou o merge é sempre seu | Fluxo de integração |
| D5 | Quem será a segunda conta de curadoria para conferência independente | Bloqueia CNT-1 |

## Diário (handoffs)

Entradas mais novas no topo. Formato: data · agente · tarefa · branch@commit · estado · próximo passo.

- 26/10/2026 · Claude · COORD-0 · `claude/confident-cray-ndnwmk` · documentos de coordenação e avaliação de design enviados para revisão · Codex pode iniciar CT-1 ou SIM-1 a partir de `origin/main` assim que este PR for integrado; Claude segue para OPS-1 e DS-1.
