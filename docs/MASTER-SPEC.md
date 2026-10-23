# Produto, escopo e sequência de entregas

Status: especificação de produto. A base inicial de catálogo/resolução foi implementada; critérios A/B ainda estão parcialmente atendidos; C começou pelo caderno de erros. Consulte o README para evidências e pendências. Referência: 22/10/2026.

## 1. Objetivo

Construir uma plataforma de estudo de Ciência da Computação que ajude o estudante a identificar lacunas, praticar, entender os erros e revisar. ENADE é o primeiro contexto de aplicação. A visão inclui banco de questões, simulados, plano de estudos, revisões, desempenho e IA, desenvolvidos em incrementos completos.

O pedido é avançar o máximo possível com alta qualidade. O limite de cada entrega é sua capacidade de ser validada; não reduzir qualidade do conteúdo, integridade dos dados ou usabilidade para aumentar a contagem de telas.

## 2. Premissas verificadas e limites

- A referência oficial consultada informa aplicação de bacharelados/CST em 29/11/2026, duração de quatro horas, 15 questões objetivas de Formação Geral e 30 objetivas mais uma discursiva do componente específico.
- Formato e cronograma pertencem à edição e à modalidade. Não hardcodar a estrutura histórica de 40 questões como regra global.
- Existem provas, gabaritos e padrões de resposta anteriores no Inep, incluindo Ciência da Computação (bacharelado) de 2021. O inventário completo ainda deve ser levantado e conferido.
- Conteúdo de 2026 não está disponível para estudo antes da aplicação. Não cadastrar previsão de documento como conteúdo importado.
- Questão oficial, explicação autoral e resposta de IA têm procedências diferentes, identificadas na UI.
- O prazo até a prova não é promessa de entrega de toda a visão. Manter escopo e estado real de cada incremento visíveis.

Fontes: [FAQ do Inep](https://www.gov.br/inep/pt-br/acesso-a-informacao/perguntas-frequentes/exame-nacional-de-desempenho-dos-estudantes-enade), [provas de 2021](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade/provas-e-gabaritos/2021), [diretrizes de Computação — Portaria 157/2026](https://mecnormas.mec.gov.br/pesquisa/detalhar/9766). Revalidar normas antes de publicar regras e datas ao estudante.

## 3. Jornadas e superfícies

| Jornada | Resultado esperado | Composição predominante |
| --- | --- | --- |
| Começar/retomar | Entrar rapidamente em uma sessão adequada | Continuação e próxima ação, com resumo breve |
| Banco de questões | Encontrar e selecionar conteúdo | Busca, filtros e lista de questões |
| Resolução | Ler, responder, entender e avançar | Área de leitura, alternativas e feedback |
| Caderno de erros | Retomar dificuldades reais | Fila organizada por assunto, motivo e revisão |
| Plano de estudos | Escolher estudo viável e ajustável | Agenda/lista de sessões e prioridades explicadas |
| Simulado | Praticar condições declaradas de prova | Área de resolução, navegação e tempo |
| Resultado | Entender evidências e próximos passos | Resumo, revisão de respostas e comparação apropriada |
| Desempenho/mapa | Explorar cobertura e lacunas | Tabela, mapa de assuntos e gráficos quando úteis |
| Guia de conteúdo | Estudar conceitos com rastreabilidade | Conteúdo editorial, exemplos e prática associada |
| Curadoria | Importar, conferir, publicar e corrigir | Tabela/fila editorial e comparação com fonte |

## 4. Sequência por dependências

| Incremento | Entrega verificável | Dependências | Critério de saída |
| --- | --- | --- | --- |
| A — Base e conteúdo | Projeto executável, persistência, identidade e lote revisado | Versões compatíveis e fontes reais | Setup reproduzível, migrations, acesso autorizado e questões fiéis à fonte |
| B — Ciclo de estudo | Busca, resolução, salvamento, explicação e retomada | A | Fluxo ponta a ponta com frontend/API/banco, inclusive retry e reload |
| C — Revisões e progresso | Caderno de erros, filtros, evidências por assunto e plano inicial | B | Cálculos conferidos, poucos dados sinalizados e prioridades explicáveis |
| D — Simulados e discursivas | Configuração por edição, cronômetro, revisão final e autoavaliação discursiva | A/B e cobertura de conteúdo adequada | Deadline persistente, finalização idempotente e ausência de gabarito antecipado |
| E — Conteúdo e personalização | Guia de estudo, mapa navegável e recomendações refinadas | B/C e taxonomia revisada | Recomendações relacionadas a evidências e percurso editável |
| F — IA e busca avançada | Tutor contextual, busca semântica e geração editorial | Conteúdo/versionamento, avaliação e orçamento | Benchmark, fontes, fallback e revisão antes de publicar conteúdo gerado |
| G — Distribuição e expansão | PWA, operação, divulgação e eventual aplicativo móvel | Fluxos estáveis e decisão de distribuição | Acessibilidade, recuperação de falhas, backups e suporte verificáveis |

Os incrementos são dependências, não uma obrigação de terminar toda uma camada antes de outra. Design, conteúdo e engenharia podem avançar em paralelo com contratos e responsabilidades claros. Cada funcionalidade deve registrar planejada, em desenvolvimento, em validação ou entregue, acompanhada de evidência.

## 5. Regras de conteúdo e aprendizagem

- Questões publicadas passam por conferência de enunciado, alternativas, gabarito definitivo, imagens, código, tipo, fonte e status de anulação.
- Classificar assuntos usando as diretrizes oficiais; manter mapeamento auditável. Não inferir pesos exatos da prova a partir de uma lista de conteúdos.
- Importar um lote inicial de 20 itens diversos para medir esforço e taxa de erro. O número serve para calibrar operação, não para prometer tamanho final do banco.
- Formação Geral compartilhada entre cadernos exige deduplicação e rastreabilidade. Licenciatura e bacharelado não são intercambiáveis silenciosamente.
- Treino pode usar questões de anos/áreas relacionadas, com rótulo explícito. Um conjunto parcial não deve ser apresentado como reprodução completa de prova oficial.
- Simulado no formato de 2026 pode combinar itens antigos revisados; rotular como simulado autoral no formato da edição, nunca como prova oficial de 2026.
- Percentual de acerto informa numerador, denominador e período. Distinguir itens inéditos, repetidos, anulados e questões geradas.
- Não prometer proficiência psicométrica validada nem predição da nota real sem estudo próprio. Começar com indicadores descritivos e limitações de amostra.
- Discursivas começam com padrão de resposta, critérios e autoavaliação. Feedback de IA, quando disponível, é sugestão e não correção oficial.

## 6. Requisitos transversais

UI em português brasileiro; datas e números localizados; responsividade e teclado desde o primeiro fluxo; estados completos; preservação de respostas; explicações compreensíveis; origem do conteúdo visível; isolamento entre usuários; dados mínimos; custo de IA controlado.

A plataforma não depende de paywall, ranking, streak ou notificações para cumprir seu objetivo. Introduzir esses recursos apenas quando houver problema de produto definido e critérios de aceitação.

## 7. Validação com estudantes

Proposta de piloto: 10–20 estudantes por pelo menos uma semana. Não é amostra suficiente para comprovar eficácia educacional. Observar conclusão de sessões, retorno espontâneo, retomada de revisões, erros de conteúdo e dificuldades de navegação. Separar satisfação, aprendizagem e disposição de pagamento; são hipóteses diferentes.

Para alegar ganho de aprendizagem, planejar avaliação com itens inéditos e critério definido antes da análise, sem misturar memorização de itens repetidos com transferência de conhecimento.

## 8. Estado e próxima entrega

Catálogo → questão → resposta → feedback → persistência → retomada estão implementados com prática anônima/contas e curadoria versionada. O registro de PDFs oficiais, a conferência independente e a procedência por versão também estão disponíveis; isso não comprova revisão pedagógica de um lote real. O caderno de erros inclui filtro por assunto, paginação, nova resolução e contagens por questão lógica, derivadas das respostas salvas. Repetição espaçada, plano de estudos e tendências permanecem pendentes. O README registra os testes executados.

Próximo incremento: transcrever e revisar o lote oficial inicial a partir dos documentos conferidos, medindo erros e esforço antes de ampliar. Imagens, discursivas, anulações, taxonomia avançada, simulados e IA continuam pendentes.
