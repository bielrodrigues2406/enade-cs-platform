# Produto: perspectivas de alunos e professores

Análise de 28/10/2026, após o PR #15. Três subagentes Codex trabalharam separadamente: perspectivas de alunos, perspectivas de professores/curadores e auditoria do estado real. **São simulações por agentes, não entrevistas ou validação com pessoas.** Nada nesta análise comprova satisfação, aprendizagem ou preferência dos usuários. As simulações foram feitas por subagentes Codex, não por Claude. O PR #16 da trilha Claude foi localizado depois e seu handoff foi considerado para conciliar o plano.

## Estado conferido

Nova consulta ao banco local confirmou 605 ocorrências privadas, 551 objetivas e 54 discursivas; 547 objetivas com grupos estruturados, incluindo textos ainda incompletos. Há três versões autorais demonstrativas publicadas e **zero questões oficiais publicadas**. O inventário continua com 28 PDFs individuais obtidos e 33 documentos pendentes. Ocorrências repetidas e blocos de outros cursos não equivalem a questões únicas prontas.

| Área | O que existe | O que falta |
| --- | --- | --- |
| Estudo | Busca por texto/assunto, resposta persistida, feedback, próxima questão | Paginação/total acima de 50, filtros por edição/curso/caderno e retomada da posição por URL |
| Conteúdo oficial | Fontes arquivadas, conferência independente, extração assistida e fila privada | Primeiro lote oficial aprovado; imagens/recortes versionados, acessibilidade e preparação editorial |
| Importação | CLI de PDFs/relatórios, SHA-256, idempotência e proteção de edições humanas | Upload de prova + gabarito pela interface, processamento acompanhado e editor de recortes |
| Curadoria | Rascunho, revisão independente, rejeição, publicação e nova versão | Conteúdo visual como representação principal, múltiplas páginas e filtros por prova/pendência |
| Revisões e desempenho | Caderno de erros, resumo e tabela por assunto | Evolução por período, marcação de dúvida, diagnóstico, plano e repetição espaçada |
| Condições de prova | Estudo livre | Simulado completo/por assunto, folha de respostas, deadline e resultado final por bloco |
| Contas | Cadastro/login/logout e histórico entre navegadores | Recuperação, verificação de e-mail e troca de senha |
| Professores | Curadoria autorizada | Papel de professor, turmas e listas de atividades não existem; são hipóteses futuras de produto |
| Operação | Docker, CI e guia de implantação | Hospedagem final, importadores/worker em produção, persistência dos arquivos, restauração ensaiada e aviso de privacidade antes de cadastro público |

Evidências principais: catálogo em `apps/api/src/main.ts:77` (`LIMIT 50`, sem total/paginação); contratos textuais em `apps/api/src/curation.ts:74`; promoção da fila em `apps/api/src/question-imports.ts:213` (usa a primeira página); importador administrativo em `:256`; middleware somente JSON em `apps/api/src/main.ts:279`; estudo em `apps/web/src/main.ts:476`; caderno em `apps/api/src/review.ts:24`; contas em `apps/api/src/auth.ts`; operação em `Dockerfile` e `docs/DEPLOY.md`. O planejamento do quadro não foi usado como prova de implementação.

## Trabalho concorrente encontrado

O [PR #16 do Claude](https://github.com/bielrodrigues2406/enade-cs-platform/pull/16), aberto na consulta, propõe recuperação Unicode para texto de 2014/2017 e registra na ADR-010 conferência por agentes com imagem original. O código dessa proposta ainda não está em main e a via de publicação assistida exige implementação própria. Portanto, não se apresenta revisão humana como a única direção futura: o requisito do plano é conferência independente e auditável, com origem ASSISTED quando feita por agente. Nenhuma aprovação humana será inventada.

A divisão CNT-C1/CT-1b (Claude) e CNT-T1/CNT-V1/PUB-A1 (Codex) precisa ser preservada ao integrar os PRs. As reservas 010/011 desse handoff foram consideradas no quadro para evitar colisões; não foi criada migration neste estudo. A melhoria Unicode anunciada no PR não altera retroativamente os 605 registros já importados: consumo da cópia derivada e reimportação ainda precisam ser entregues.

O caminho assistido precisa abranger fontes e versões: `source_document.reviewed_by` referencia conta (`migrations/005_official_sources.sql`), e `verifyProvenance` exige fontes VERIFIED (`apps/api/src/source-store.ts`). A revisão por agente deve ter representação/eventos próprios, sem simular uma pessoa. Os formatos A–D/A–E e a relação entre PNG técnico/WebP de entrega também precisam ser conciliados nos contratos do PR #16.

## Perspectivas simuladas de alunos

Foram considerados: aluno no celular/rede limitada, aluno praticando por assunto e aluno buscando uma prova completa.

| Prioridade | Achado | Critério para a entrega |
| --- | --- | --- |
| P0 de conteúdo | O estudante ainda acessa somente demos | Lote oficial aprovado com cobertura declarada; não chamar acervo parcial de prova completa |
| P1 de escala | Mais de 50 questões publicadas ficariam parcialmente ocultas; a UI usa o tamanho da resposta como total | Paginação, total real e filtros por edição/modalidade/tipo; verificar com mais de 50 itens |
| P1 de retomada | Reload mantém resposta salva, mas perde questão aberta, assunto e posição; URL continua `/` | Endereço retomável e seleção preservada, com isolamento após logout; distinguir seleção não confirmada de resposta salva |
| P1 do modo visual | Reduzir uma página inteira não garante leitura de código ou fórmulas no celular | Recortes ordenados, zoom com teclado, retorno de foco e controles alcançáveis; não cortar conteúdo bidimensional |
| P1 de acesso | Imagem e botões A–E sozinhos não permitem ler a questão com leitor de tela | Representação assistiva equivalente revisada; não usar um alt genérico como prova de acessibilidade |
| P1 de rede | Centenas de imagens carregadas juntas podem consumir rede e memória | Catálogo leve, questão atual sob demanda, pré-carregamento limitado e retry sem perder seleção |
| P1 de preparação | Simulado e recuperação de senha continuam ausentes | Condições de prova persistentes e recuperação segura; não confundir estudo livre com simulado |
| P2, hipótese | Acerto por chute não entra no caderno de erros | Avaliar marcação privada de dúvida/revisar depois, separada do índice de acerto |

O walkthrough Chromium desta análise usou sessões anônimas próprias e as três demos. Em 320/390/1440 CSS px foram exercitados busca, filtro, teclado, falha HTTP 503 simulada, retry, persistência após reload e próxima questão; houve inspeção visual adicional a 768 px. Os fluxos passaram, sem erro de página ou overflow horizontal global nas larguras observadas. A perda de posição/filtro no reload foi reproduzida. As capturas mostraram base visual coerente; não há evidência para um redesenho geral.

O visualizador de imagens ainda não existe e não foi testado. Também não foram testados leitor de tela real, WebKit, tráfego móvel real, suporte offline, aprendizagem ou satisfação. A falha de rede foi interceptada pelo Playwright e não mede latência real.

## Perspectivas simuladas de professores e curadores

Foram considerados: professora preparando questões, curador conferindo um lote e professor interessado em atividades para uma turma. Essa análise inspecionou código/contratos; não usou conta administrativa nem simulou aprovações humanas.

| Prioridade | Achado | Critério para a entrega |
| --- | --- | --- |
| P0 do modo visual | O editor atual exige texto de enunciado e de todas as opções | Contrato explícito para conteúdo visual versionado e IDs estáveis, sem placeholders fictícios |
| P0 de procedência | Prova, gabarito, edição, curso e tipo não podem ser associados por proximidade ou nome de arquivo | Sugestão automática conferível; incompatibilidades, preliminares, ausências e anulações ficam em exceção |
| P0 de fidelidade | Um item pode ocupar várias colunas/páginas e depender de contexto compartilhado | Sequência de recortes com origem/coordenadas/ordem; editor inclui, ajusta e reordena sem perder conteúdo |
| P1 de revisão | Baixar fonte e procurar a página manualmente dificulta revisar centenas de itens | Original e captura lado a lado, prévia do aluno e gabarito na mesma tarefa autorizada |
| P1 de lote | Hoje não existe upload acompanhado ou filtro por prova na fila | Progresso esperado/localizado/conferido, retry/idempotência e exceções filtráveis; reenvio preserva ajustes |
| P1 editorial | A foto mantém também erros do original | Nota editorial, retificações e canal de relato de problema; correções não reescrevem tentativas antigas |
| P2, hipótese | Atividades, exportação e desempenho de turmas podem ajudar professores | Validar com docentes reais; acesso a dados de aluno requer autorização própria, não papel de curadoria |

Curadoria não concede acesso global ao histórico dos estudantes. Importação automática não equivale a publicação automática. A [proposta de imagens e importação](../QUESTION-IMAGES-AND-IMPORT.md) preserva essas diferenças.

## Ordem de trabalho recomendada

1. CT-1: questão visual versionada, associação estável de alternativas, múltiplos recortes e representação acessível; piloto diverso de 20 itens.
2. IMG-I1/IMG-U1: prova + gabarito pela interface, geração de candidatos, correção visual e fila acompanhada; fontes e revisão independente preservadas.
3. CAT-1: catálogo inteiro navegável, filtros de edição/curso/caderno e retomada; necessário antes de liberar centenas de itens.
4. Lote oficial utilizável e operação de produção comprovada. Em paralelo, os módulos de simulado já previstos podem avançar pelos contratos do quadro; usar cobertura real de conteúdo.
5. Recuperação de contas, simulado, progresso por período e diagnóstico. Turmas, personalização e IA ficam após validar a necessidade e a base de conteúdo.

Para validar as hipóteses, manter o piloto humano já previsto na especificação: estudantes e docentes reais executando tarefas, com observação de dificuldades e erros. Não converter os achados dos agentes em depoimentos ou métricas de usuários.

Os relatórios detalhados, roteiro, capturas, resultado do walkthrough e consulta agregada ficam em `.local/planning-image-questions/`. O estudo não mudou o código da aplicação nem aprovou conteúdo oficial.

Nesta entrega também passaram `npm run build`, `npm test` (94 testes API/PostgreSQL/utilitários) e `npm run test:e2e -- --timeout=60000` (22 fluxos Chromium), executados em sequência. Essas verificações validam a base existente; não testam o uploader ou o visualizador propostos. Os 294 arquivos do benchmark tiveram bytes/SHA-256 e estatísticas conferidos contra o recibo.
