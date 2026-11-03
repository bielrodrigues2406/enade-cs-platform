# Auditoria de design e uso — 03/11/2026

Base: `main` em `0db9671` (PR #37 integrado). Pedido de Gabriel: avaliar a aparência, reduzir a poluição do menu e revisar telas, campos, seletores e modais, sem ampliar funcionalidades sem necessidade.

## Parecer

A identidade de caderno funciona: papel, azul, serifa nos títulos e Dudu formam um conjunto reconhecível. Campos e diálogos já têm uma base consistente. O principal problema é a hierarquia: muitas escolhas e indicadores recebem o mesmo destaque, especialmente no celular. Recomendo simplificar a navegação e a primeira tela de cada tarefa, preservando essa identidade.

Não recomendo outro tema, outra biblioteca de componentes, animações contínuas, cartões para tudo ou uma nova página para cada função. As prioridades são espaço para estudar, descoberta das funções existentes e prevenção de escolhas acidentais em formulários.

## Evidência e limites

- Aplicação real no navegador: 128 capturas de 37 estados, em 1440, 768 e 390 px; formulários e diálogos críticos também em 320 px. O manifesto registra dimensões, campos e verificações de teclado.
- Contas locais de demonstração de estudante, professor e administrador/curador; turma e dados de teste próprios. Acervo histórico real: 246 objetivas e 39 discursivas. Nenhum dado de aluno real ou aprovação editorial humana foi usado.
- Jornadas: página pública, login/validação/cadastro, início, catálogo, resolução/feedback/rascunho, caderno, treino, provas/2026, discursivas, flashcards, biblioteca/ficha, conquistas, perfil, aulas/turma/lista/chamada/desempenho, administração/importação/atividades e curadoria/fontes/autoral.
- Revisão cruzada por agentes de navegação e formulários. São perspectivas simuladas, não pesquisa com alunos/professores reais. Não houve certificação WCAG nem teste com leitor de tela.
- Modais amostrados: Tab não escapou para o fundo, Escape fechou e o foco retornou ao acionador; formulário de aula coube em 320 px com conteúdo rolável e ações visíveis. A tentativa inicial de capturar a finalização falhou por um seletor da automação; corrigido o seletor, a captura e o teste passaram. Não era falha do produto.
- Primeiras capturas usaram locale padrão do navegador. Aula/importação foram repetidas com contexto `pt-BR`; aparência de data, hora e arquivo nativos pode depender também do Chromium/sistema. Texto nativo em inglês, isoladamente, não foi classificado como defeito do aplicativo.
- Capturas e `manifest.json` estão no pacote `auditoria-design-2026-11-03`; imagens não entram no bundle nem no histórico Git. [Protótipos estáticos A/B](navigation-proposals/README.md) ficam versionados, com HTML, CSS e JS separados. Os dois foram abertos em 320/390/768/1440 px, sem estouro horizontal; Tab permaneceu no painel, Escape fechou e devolveu o foco ao acionador. No protótipo, o cabeçalho móvel mede 64 px; isso é uma medição da proposta, não uma alteração entregue no aplicativo.

## Prioridades

P1: interfere na tarefa e merece o próximo lote. P2: atrito relevante, pode vir no lote seguinte. P3: refinamento ou hipótese. Não foi identificado P0 de design nas jornadas amostradas.

| Prioridade | Achado observado | Efeito e ajuste recomendado |
| --- | --- | --- |
| P1 | **Dez destinos no mesmo nível**, além de meta, perfil e saída no cabeçalho. Em 390 px, cabeçalho de 94 px + menu de 149 px = **243 px antes do conteúdo**; em 320 px, 335 px. Capturas 05/06. | Ocupa 29%/45% da altura auditada antes de estudar. Agrupar por tarefa, manter menu lateral no desktop e recolher navegação no celular. Reunir conta/saída, sem reduzir alvos de toque. |
| P1 | **Página alarga nas tabelas** de contas e de turma. Reprodução adicional em 390 px: documento com 604 px nas contas e 428 px na turma; contas também em 768 px. Capturas 26/31. | O wrapper já tem `overflow-x:auto`; spans `.visually-hidden` absolutos na coluna de ações escapam do recorte. Em prova de hipótese somente no navegador, `position:relative` no wrapper reduziu o documento de 604 para 390 px. Entregar a correção no componente e verificar ambas as tabelas, mantendo rolagem interna. Os modais cabem: não atribuir a eles o estouro do fundo. |
| P1 | **Curadoria lista 50 de 246 questões**, API com `LIMIT 50`, sem paginação nem continuação na tela. Captura 35 e consulta local. | Parte do acervo não é alcançável pela fila para manutenção. Paginar com total; reaproveitar convenções do catálogo, sem criar outra central editorial. É pendência funcional, não cosmética. |
| P1 | **Questão autoral começa com A marcada como correta**; remover a opção correta seleciona a primeira remanescente. Captura 36; `curation.component.ts`, `correctOptionId` inicial e `removeOption`. | Exigir escolha explícita do gabarito; limpar a seleção quando a alternativa escolhida for removida. Não foi publicada questão de teste nem demonstrado gabarito errado salvo. |
| P2 | **Destino secundário não sobrevive ao reload**: Biblioteca usa `/questoes`; atualizar remove `app-library`. | Dar URLs próprias às seções e conferir Voltar/Avançar antes de alterar o menu. Não promover uma reescrita integral do router só para mudar a apresentação. |
| P2 | Catálogo móvel empilha introdução, contador e quatro filtros; a primeira questão fica fora da primeira dobra. Captura 06. | Texto inicial curto; busca e área visíveis; assunto/ano em “Mais filtros”, mostrando quando houver filtro ativo. Manter seletores nativos e os filtros na URL. |
| P2 | Início de estudante novo mostra a lista de áreas com barras vazias e repete indicadores de meta. Captura 05, página móvel de aproximadamente 6.055 px. | Estado inicial curto com ação de começar; detalhes por área quando houver respostas. Não ocultar o acesso ao treino por área. |
| P2 | Biblioteca abre uma grade por área mesmo quando só há uma ficha: grande espaço vazio no desktop; página longa no celular. Capturas 19/20. | Uma lista ou grade contínua de fichas com a área identificada. Com 12 fichas não há justificativa imediata para outro buscador. |
| P2 | Conquistas exibe 14 cartões, quase todos bloqueados no cenário novo, antes do ranking. Captura 21. | Mostrar conquistadas e próximas duas; restante em expansão. Manter nome “Conquistas”, pois a tela inclui medalhas/constância/ranking, não um painel geral de desempenho. |
| P2 | “Marcar aula” pode selecionar a administração como professor mesmo na sessão da professora. Captura 27; código escolhe `teachers[0]`. | Preferir o professor da sessão ou pedir seleção explícita para o administrador. Não foi criada aula com professor incorreto. |
| P2 | Abas administrativas usam `role=tab`, mas ArrowRight mantém foco e seleção na primeira aba. | Completar teclado de tablist (setas/Home/End e foco/seleção coerentes) ou usar controles cuja semântica corresponda ao comportamento. Tab ainda permite navegar; não é bloqueio total por teclado. |
| P2 | Fechar diálogo mede 36 × 44 px; o foco inicial de criação vai para “Fechar”. Folha móvel desenha uma alça de arrasto sem gesto implementado. | Botão de 44 × 44 px, foco inicial no primeiro campo pertinente e retirada da alça. Não criar um sistema de arrasto só para justificar o desenho. 36 px não é, por si só, reprovação do mínimo de 24 px da WCAG AA. |
| P2 | Nome no cadastro administrativo tem `maxlength=120`, mas não antecipa a regra mínima de 2 caracteres do servidor; erro aparece no envio. | Validar e associar mensagem ao campo. Preservar a validação no servidor; não remover o limite já existente. |
| P2 | Sidebar identificada como “Sobre este caderno” embora reúna navegação. | Usar landmark `nav` com nome como “Estudo”; conservar estado atual perceptível e foco visível. |
| P3 | Textos técnicos no produto: “Estudante (sem papel)”, “Curso” para Bacharelado/Licenciatura/Comum, “Enviar e propor caixas”; “encerra a conta” ao trocar senha. | “Estudante”, “Modalidade do caderno”, “Importar prova”/“Preparar recortes”; “desconecta você dos outros aparelhos”. Pequenos ajustes de compreensão, sem novo fluxo. |

Referências de implementação: `apps/web/src/app.component.html`, `main.ts`, `styles.css`, `admin.component.html`, `lessons.component.ts`, `curation.component.ts`; `apps/api/src/curation.ts`. O relatório distingue reprodução no navegador, leitura do código e risco preventivo. Não extrapolar os diálogos amostrados para todos os estados de erro possíveis.

## Menu recomendado

### A — menor mudança útil

| Grupo | Destinos atuais |
| --- | --- |
| Início | Início |
| Resolver | Banco de questões, Discursivas |
| Treinar | Treino parcial, Provas completas |
| Revisar | Caderno de erros, Flashcards |
| Apoio | Biblioteca, Conquistas, Aulas |

Desktop conserva a navegação lateral, com títulos discretos e Apoio recolhível. O grupo do destino ativo permanece aberto. Celular e tablet estreito usam cabeçalho compacto com botão **Menu**, abrindo painel modal com os mesmos grupos. Perfil, meta e saída ficam reunidos no controle de conta. Curadoria/Administração aparecem somente para os papéis autorizados, em grupo próprio, sem interferir nas opções de estudo.

Vantagens: preserva nomes e funções; libera a primeira dobra; não cria novas páginas. Custo: trocar de seção no celular exige abrir o menu. O layout deve ser validado em leitura e treino, além do catálogo demonstrado.

### B — alternativa com cinco raízes

No celular: **Início · Questões · Treinos · Revisão · Menu** fixos no rodapé. Questões reúne objetivas/discursivas; Treinos reúne parcial/provas/2026; Revisão reúne caderno/flashcards; Menu abre apoio, com conta no cabeçalho. Desktop mantém grupos laterais.

É mais acessível para trocas frequentes entre tarefas, mas exige mudança maior de navegação e reserva de espaço inferior para não cobrir respostas, mapa e finalização do treino. Não recomendo começar por B sem testar A. Não criar hubs vazios nem uma sexta opção só para 2026.

Os protótipos permitem abrir/fechar o menu, selecionar destinos e expandir filtros, com conteúdo demonstrativo claramente indicado. Eles **não alteram o aplicativo**. A decisão sobre filtros é ilustrada junto ao menu e pode ser entregue em lote separado.

## Telas e componentes que vale preservar

- Resolução: recorte oficial e alternativas por letra mantêm o foco na questão; feedback e reflexão têm propósito. Evitar notificações decorativas que disputem atenção com o resultado.
- Diálogos de turma, aula, lista e proteção de rascunho: títulos, ações e espaçamento são legíveis. Não precisam virar wizard; cabe corrigir foco/alvo/alça e o fundo que alarga.
- Perfil: seções de dados, senha e preferências estão compreensíveis em 320/390 px. Recolher a senha é preferência, não uma prioridade demonstrada.
- Seletores: manter controles nativos quando a lista é curta. Corrigir os defaults perigosos antes de trocar o estilo dos dropdowns.
- Dudu: preservar aceno, piscada e comemoração curtos do MAS-4. Não inserir mascote em todo campo/modal nem loops permanentes. Nesta auditoria o movimento foi reduzido para estabilizar as capturas; a animação é validada no PR #37, não por uma imagem estática.

## O que falta no sistema

**Próximos ajustes úteis:** P1 acima, rotas estáveis e a primeira dobra do catálogo; depois, estados vazios, biblioteca/conquistas e detalhes de formulários. Corrigir sem acrescentar funções novas.

**Pendências já existentes:** implantação em VPS/domínio (código local não é serviço publicado); revisão humana dos 135 flashcards/12 fichas gerados por IA; CQ-2 obrigatória para manutenção pela fábrica; acessibilidade com leitor de tela e teclado nos estados ainda não auditados. Privacidade institucional ainda requer contato/prazo/texto oficial, conforme WORKBOARD/LGL-1.

**Conteúdo:** 246 objetivas com explicação e 39 discursivas estão publicáveis pelo bootstrap atual. Ainda faltam 33 PDFs recentes, cinco padrões antigos de Formação Geral e fonte legível para 2005 Q60. As quatro discursivas antigas de 2005/2008 já entraram no PR #33; MAS-4 já entrou no PR #37. Não repetir esses dois itens como trabalho todo pendente. As questões têm áreas/assuntos e já há treino parcial/por área e simulado 2026; não criar versões duplicadas dessas funções.

**Não bloquear o próximo lote de design:** Plano e Materiais “em breve”, PWA, tema escuro, medalhas extras, novos modos de flashcards e ranking por turma. Avaliar depois do essencial, em vez de transformar toda ideia do handoff em requisito da primeira versão. Também não confundir conclusão documental desta auditoria com aprovação humana de conteúdo, CQ-2 concluída ou deploy.

## Sequência de entrega sugerida

1. Corrigir largura de tabelas, acesso ao acervo da curadoria e defaults de gabarito/professor, com testes de comportamento proporcionais.
2. Implementar A com rotas de seção estáveis; conferir retorno/histórico, teclado, foco, conta/papéis e retomada de estudo em 320/390/768/1440 px.
3. Enxugar filtros/estado inicial e composição de Biblioteca/Conquistas; preservar conteúdo, rastreabilidade e recursos já existentes.
4. Leitor de tela, revisão de manutenção CQ-2 e operação/deploy dentro do escopo autorizado.

Não implementar todas as linhas em um PR. Separar correções funcionais, navegação e composição das páginas em poucos commits/PRs coesos. Usar HTML/CSS/TypeScript separados, componentes e tokens existentes, sem novo framework interno.
