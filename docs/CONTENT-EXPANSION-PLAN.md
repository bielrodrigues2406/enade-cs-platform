# Expansão do acervo do CadernoCC

Proposta de 04/11/2026, solicitada por Gabriel. O plano organiza aquisição e revisão; não comprova que fontes novas foram obtidas nem autoriza publicar material sem conferência. Nenhuma questão, classificação publicada ou regra de simulado foi alterada nesta entrega.

## 1. Objetivo e limites iniciais

Ampliar a quantidade e a diversidade de questões de Computação para estudo individual e atividades de professores de qualquer instituição. Na primeira fase, a origem continua sendo **ENADE**. A expansão contempla outros cursos de Computação quando suas provas oficiais forem localizadas e conferidas; uma questão de outro curso mantém essa identificação.

POSCOMP, concursos e questões autorais entram como fases posteriores, com decisão explícita sobre fontes e adaptação do importador. O plano não requer construir aulas completas, um LMS, execução de código ou novos recursos de gamificação.

Princípio: medir cobertura por matéria e tema, com itens distintos, fontes rastreáveis e conteúdo legível. Contagem de PDFs, versões de caderno ou tentativas não representa quantidade de questões novas.

## 2. Ponto de partida medido

Inventário somente leitura do banco local `enade_content_ci` em 04/11/2026: **246 objetivas oficiais publicadas e 39 discursivas**. O [snapshot agregado](reviews/2026-11-04-content-coverage.json) guarda o escopo. Não é inventário ao vivo da AWS; antes de cada publicação, conferir a contagem real do destino.

As contagens abaixo consideram versões atuais publicadas, antes de agrupar duplicidades pedagógicas ou aplicar filtros de elegibilidade de modalidades/simulados. As três demonstrações autorais não entram.

| Área atual do catálogo | Objetivas |
| --- | ---: |
| Formação Geral | 47 |
| Sociedade e ética | 38 |
| Algoritmos | 24 |
| Matemática | 19 |
| Arquitetura de computadores | 16 |
| Engenharia de software | 13 |
| Sistemas operacionais | 13 |
| Redes | 11 |
| Teoria da computação | 11 |
| Inteligência artificial | 10 |
| Programação | 10 |
| Banco de dados | 8 |
| Compiladores | 7 |
| Computação gráfica | 7 |
| Interação humano-computador | 5 |
| Segurança | 3 |
| Sistemas distribuídos | 3 |
| Sistemas de informação | 1 |

Dois achados orientam o primeiro lote:

- Cada área tem tantos rótulos distintos de `subject` quanto questões. Esses textos funcionam como descrições específicas dos itens, mas precisam de agrupamento para representar temas recorrentes de estudo.
- **34 das 38** questões de Sociedade e ética têm rótulos iniciados por “Ensino de Computação:”. Formação docente precisa de identificação própria, preservando a origem de Licenciatura e evitando apresentar todo esse conjunto como ética profissional.

Esses achados não autorizam reclassificação automática. O mapeamento proposto deve ser conferido e versionado, sem apagar descrições, autoria, referências ou histórico de tentativas.

## 3. Matérias e temas prioritários

Começar com dois níveis controlados, **matéria → tema**. A descrição específica atual permanece no item. Uma questão tem matéria principal e pode receber vínculos secundários revisados, sem virar várias questões no contador geral.

| Prioridade | Matéria | Temas iniciais a cobrir | Base atual aproximada |
| --- | --- | --- | ---: |
| A | Banco de dados | Modelagem ER/relacional; SQL e junções; normalização; transações; índices | 8 |
| A | Programação | Fluxo de controle; funções/recursão; rastreamento de código; orientação a objetos; tipos e memória | 10 |
| A | Algoritmos e estruturas de dados | Busca/ordenação; complexidade; listas/pilhas/filas; árvores; grafos | 24 em Algoritmos |
| B | Sistemas operacionais | Processos/threads; escalonamento; sincronização/deadlock; memória; arquivos | 13 |
| B | Redes | Camadas/protocolos; endereçamento; transporte; roteamento; aplicações | 11 |
| B | Matemática para Computação | Lógica; conjuntos/relações; combinatória; grafos; probabilidade e álgebra quando presentes nas fontes | 19 |
| C | Arquitetura, engenharia de software e teoria | Organização/memória; requisitos/testes/projeto; autômatos/computabilidade e compilação | 16 / 13 / 11 + 7 |
| C | Segurança, IA, IHC, distribuídos, gráfica e SI | Selecionar temas pela disponibilidade de fontes e demanda observada | Ver inventário |
| Eixo específico | Formação docente em Computação | Didática; avaliação; currículo; inclusão/acessibilidade; tecnologias educacionais | 34 candidatas ao reagrupamento |

As bases não são uma contagem de cobertura curricular nem garantem que todos os temas tenham itens. A fase de mapeamento deve revelar temas com zero, uma ou duas questões, além de concentração em uma única edição. Formação Geral e formação docente continuam disponíveis e têm fila própria de revisão; a aquisição técnica não depende de eliminar esses conteúdos.

## 4. Onde buscar mais questões

### Onda 1 — aproveitar e completar o ENADE já inventariado

- Conferir os bloqueios legítimos restantes: fonte legível para 2005 Q60 e cinco padrões antigos de Formação Geral. Anulações permanecem anulações; não são “questões faltando” a repor.
- Retomar os documentos de ENADE das Licenciaturas 2024 listados em [OFFICIAL-SOURCES](OFFICIAL-SOURCES.md). O inventário geral tem 33 PDFs recentes ainda não obtidos, mas também inclui PND 2025/2026; PND é outra origem e fica fora da publicação inicial restrita ao ENADE, mesmo havendo um caderno PND 2025 tipo 4 já localizado. Não anunciar esses materiais como Bacharelado 2025/2026.
- Tratar os diferentes tipos de caderno como possíveis permutações dos mesmos itens. Montar correspondência de número/alternativa entre tipos antes de contabilizar novidades.
- Usar origem oficial ou cópia identificada, com recibo e hash. Se o ambiente não obtiver o PDF, preparar a lista exata para aquisição local pelo operador; não marcar o documento como recebido.

Essa onda melhora completude e rastreabilidade. Não há garantia de que os 33 PDFs tragam grande volume técnico inédito.

### Onda 2 — ENADE de outros cursos de Computação

Inventariar primeiro **Sistemas de Informação** e **Análise e Desenvolvimento de Sistemas**, candidatos a complementar Banco de Dados, Programação e Engenharia de Software. Depois verificar Engenharia de Computação, Engenharia de Software e outros CST pertinentes. São candidatos de pesquisa, sem afirmar que toda edição/curso possui prova acessível.

Para cada combinação curso/ano/modalidade: localizar página oficial, prova, gabarito e eventuais retificações/padrões; registrar arquivos obtidos, bloqueios e estimativa de itens úteis após triagem. Usar uma matriz de pertinência ao tema, não importar uma prova inteira indiscriminadamente para preencher metas.

**Primeiro piloto:** selecionar até duas edições de um curso candidato com documentação completa e disponibilidade confirmada. Produzir um lote de 20–30 candidatas, priorizando lacunas A. A aquisição é validada pela quantidade de itens inéditos aprovados; um lote pode publicar menos ou nenhum item.

### Onda 3 — outras origens, após avaliar o piloto

POSCOMP é o candidato seguinte para matemática, algoritmos e fundamentos. Questões autorais de professores podem preencher lacunas de base. Concursos de TI ficam para uma curadoria específica posterior.

Antes disso, revisar identificação da família do exame, validação das fontes, regras do importador, licença/permissão de reutilização e apresentação. As restrições atuais de origem oficial foram construídas para o Inep. Não cadastrar POSCOMP ou autoria como ENADE para contornar o modelo.

## 5. Metas editoriais e critério para continuar

As seis matérias A/B somam hoje **85 objetivas por área principal**. Uma primeira referência de densidade é aproximar cada uma de **30 itens distintos adequados**, distribuídos entre seus temas. Se a base se mantiver após deduplicação e classificação, isso representa aproximadamente **95 acréscimos** nessas áreas. É uma meta de seleção/editoria, não um número de questões já disponíveis nem certificado de domínio completo.

Executar por lotes de **20–30 candidatas**:

1. Primeiro lote em um curso/edição, para medir recuperação de fontes, duplicidades e esforço de revisão.
2. Se as fontes e o rendimento forem adequados, repetir lotes dirigidos às maiores lacunas A/B.
3. Após aproximadamente 100 itens técnicos novos aprovados, reavaliar a matriz e o uso antes de buscar mais volume.

Não fixar uma data para publicar 100 itens antes do piloto. Estimar o próximo lote a partir do tempo real por etapa, dos arquivos obtidos e do retrabalho. Falta de fonte ou aprovação produz um bloqueio visível, não relaxamento da qualidade.

## 6. Pipeline de cada lote

| Etapa | Entrega verificável |
| --- | --- |
| Aquisição | Documento original/cópia identificada, URL oficial, procedência, hash, curso, modalidade, edição e tipo de caderno |
| Triagem | Questões candidatas, motivo de pertinência, anulações, bloqueios e correspondência entre cadernos |
| Extração | Recorte completo e legível, número oficial, alternativas e vínculo de gabarito; transcrição apenas como apoio |
| Classificação | Matéria/tema controlados e descrição específica, com justificativa em caso de dúvida |
| Conferência independente | Imagem comparada ao PDF e resposta conferida no gabarito correto; identificação real de extrator e conferente |
| Explicação | Texto com autoria/origem indicada; revisão independente e estado separado da fidelidade |
| Preparação | Duplicidades verificadas, casos de importação idempotente e seleção por modalidade/curso exercitados no banco de ensaio |
| Publicação | Resumo do lote aprovado, versão/data, contagens antes/depois, arquivos disponíveis e conferência das imagens no destino |

Seguir [PROCESS.md](../data/agent-reviews/PROCESS.md), ADR-010/011 e o importador existente. IA pode auxiliar extração, agrupamento e explicação; não comprova uma fonte nem substitui conferência independente. Não rotular conferência assistida como humana.

Preservar D11/D15: **fidelidade é o bloqueio da objetiva**. Uma explicação recusada não vira explicação aprovada: o item fiel pode seguir sem ela, com estado honesto, enquanto o texto volta para revisão. Medir separadamente quantidade publicada e quantidade com explicação conferida. Para uma discursiva, aplicar o contrato existente de enunciado, padrão e critérios; não gerar um “padrão oficial” ausente.

## 7. Integridade e seleção para estudo

- Guardar uma identidade da questão e suas ocorrências em documentos/cadernos. Igualdade de texto/hash é pista para deduplicação, não aprovação automática: diagramas, alternativas e gabaritos também precisam corresponder.
- Preservar as referências de cada prova histórica e a numeração oficial, mesmo quando um conteúdo aparece em mais de um caderno. Separar contagem de itens distintos e ocorrências nas provas.
- Conferir a migração de classificação por versão: tentativas anteriores mantêm conteúdo, resposta e correção registradas.
- Provas completas seguem a edição original. Novos cursos ou fontes **não entram automaticamente** no simulado de Ciência da Computação 2026; validar a elegibilidade antes do primeiro lote. Treino temático misto deve indicar as origens que usa.
- Antes de publicar outro curso, identificar **curso e cobertura da edição** nos cartões/filtros e no contrato de seleção. Hoje `edition-exam.ts` oferece fontes com pelo menos dez objetivas, e os cartões distinguem ano/modalidade: um lote parcial de SI/ADS poderia parecer uma prova completa ou ficar indistinguível de Ciência da Computação. Um lote temático de 20 questões não comprova completude da prova; o gate deve separar edição completa, edição parcial e seleção temática, com anulações e pendências identificadas.
- Não aumentar artificialmente cobertura copiando uma questão para várias matérias, permutando alternativas ou apresentando pequenas variações como originais oficiais inéditos.
- Separar recência de dificuldade. Se dificuldade não foi calibrada/revisada, não exibir um nível como medida comprovada.
- Exemplos antigos podem precisar de nota de contexto. Conservar o enunciado oficial e registrar a nota separadamente.

## 8. Métricas do acervo

Acompanhar por matéria/tema: itens distintos aprovados, distribuição de edições/origens, temas sem cobertura, percentual com explicação conferida, bloqueios por motivo e correções recebidas após publicação. Acompanhar por lote: candidatas, duplicadas, aprovadas, recusadas e tempo por etapa.

Para estudo: primeira tentativa e revisões separadas, questões novas disponíveis e conclusão de atividades. Aumento de acerto repetindo os mesmos itens não comprova domínio de toda uma disciplina.

## 9. Primeiras tarefas executáveis

| Ordem | Tarefa | Saída | Dependência |
| --- | --- | --- | --- |
| 1 | Inventário e mapa de cobertura | Snapshot agregado + mapeamento proposto dos itens atuais para matéria/tema, incluindo formação docente | Snapshot deste plano; conferência do destino antes de publicar |
| 2 | Pesquisa de fontes ENADE SI/ADS | Matriz curso/ano/documento/status/hash e amostra do conteúdo pertinente | Nenhuma publicação nem mudança de prova |
| 3 | Escolher um piloto documentado | Até duas edições e 20–30 candidatas, com lacunas-alvo e duplicidades anotadas | Fontes obtidas e gabarito identificado |
| 4 | Validar classificação/elegibilidade | Contrato de temas, curso/cobertura visíveis e verificação de que novos cursos/lotes parciais não alteram simulados nem aparecem como provas completas | Separação origem/curso/matéria |
| 5 | Extrair, conferir e publicar primeiro lote | Itens aprovados rastreáveis, relatório antes/depois e imagens abertas em ensaio/produção | Critérios da seção 6 |
| 6 | Decidir próximo lote/origem | Prioridades ajustadas ao rendimento e uso; eventual proposta POSCOMP separada | Resultado do piloto, não apenas quantidade de PDFs |

O plano e o snapshot são a entrega atual. Pesquisa/aquisição de novos cursos, nova taxonomia, migração e publicação serão trabalhos próprios no WORKBOARD. Acesso ao acervo continua independente de uma instituição; contribuições de professores passam pela mesma revisão para entrar no catálogo compartilhado.
