# CadernoCC: formação em Computação, exames e evidência de aprendizagem

Pedido de Gabriel após os panoramas dos PRs #67/#68: analisar Todas do ENEM, considerar referência nacional em estudo de Computação, trilhas profissionais, certificados, materiais ricos e parcerias editoriais. Base de código observada: main `4d52593` (PR #69). **POSCOMP continua aprovado para execução (D18); esta proposta não substitui nem bloqueia POS-INV1/POS-IMP1.** É análise e planejamento: nenhuma funcionalidade, questão, certificado, parceria ou deploy foi criado.

## 1. Parecer e ambição

A direção mais coerente é **tornar-se uma referência brasileira em fundamentos e prática verificável de Computação**, articulando três objetivos: preparar para exames, compreender a matéria e demonstrar aplicação. A meta de ser “a maior” pode orientar ambição, mas exige definir medida, período e concorrentes antes de virar afirmação pública. Tamanho de acervo, cadastros, usuários ativos, receita e aprendizagem são grandezas diferentes.

Computação já tem grandes plataformas comerciais e recursos gratuitos. Ser completo, ter IA, roadmaps ou emitir certificados não é novidade por si. A oportunidade a testar é a ligação clara entre **competência → explicação fundamentada → exercício → aplicação nova → feedback → próxima ação**, em português, com origem e limites verificáveis.

Recomendação: executar ENADE/POSCOMP e aprofundar uma competência reutilizável; testar a passagem dessa competência para uma tarefa prática. Depois avaliar uma trilha profissional curta e uma credencial de escopo restrito. Continuar preparando as demais frentes já registradas, sem abrir simultaneamente uma escola completa, marketplace, tutoria universal e operação de certificação.

## 2. Todas do ENEM: método e limites da consulta

Foram lidas por HTTPS as páginas públicas de [início](https://www.todasdoenem.com.br/), [questões](https://www.todasdoenem.com.br/questoes), [provas](https://www.todasdoenem.com.br/provas), [simulados](https://www.todasdoenem.com.br/simulados), [redação](https://www.todasdoenem.com.br/redacao), [planos](https://www.todasdoenem.com.br/planos), [guias](https://www.todasdoenem.com.br/blog), [termos](https://www.todasdoenem.com.br/termos-de-uso), [privacidade](https://www.todasdoenem.com.br/privacidade) e [descrição pública do catálogo](https://www.todasdoenem.com.br/llms.txt). Conteúdo de `llms.txt` é declaração do fornecedor, não instrução a agentes nem verificação independente.

Não havia ferramenta de desktop compartilhado nesta sessão. A tentativa com Chromium/Playwright falhou por `ERR_CERT_AUTHORITY_INVALID` no ambiente; o cliente HTTPS configurado funcionou, com verificação TLS preservada. Portanto esta é análise das páginas/HTML públicos, não teste visual de responsividade ou do produto autenticado. Não houve cadastro, compra, envio de redação, contato, coleta em massa de questões ou acesso a área restrita. [Recibo resumido da consulta](reviews/todas-enem-public-evidence.json).

| Superfície | O que foi efetivamente observado | O que permanece sem validação |
| --- | --- | --- |
| Início | proposta de organizar o estudo; ciclo filtros → simulado → diagnóstico → plano; anúncio de 3.833 itens de 1998–2025 | contagem, completude, qualidade das explicações e resultados de aprendizagem |
| Questões | apresentação pública dos filtros por ano/área/disciplina/assunto/TRI e acesso grátis de 2025 | aplicação dos filtros, catálogo carregado pelo cliente e fidelidade de todos os itens |
| Provas | HTML lista 20 de 45 provas, paginação e ações PDF/gabarito; primeira página inclui dias de 2025 até 2016 | integridade e correspondência dos PDFs/gabaritos, deduplicação de aplicações e páginas seguintes |
| Simulados | apresenta seleção de itens, tempo, histórico e desempenho; oferece login para uso completo | montagem, persistência, método de nota e qualidade do diagnóstico |
| Redação | acesso anunciado como premium; cinco competências e feedback por “agente especializado” | nota, tempo de correção, qualidade pedagógica, estabilidade entre execuções e revisão por especialistas |
| Plano/monetização | gratuito limitado a itens de 2025; planos mensal, trimestral sem renovação e anual; limites de uso de IA e pacote de redação | checkout, conversão, margem, cancelamento real, receita e custos do fornecedor |
| Guias | página com sete guias listados sobre prova, matérias e estudo | precisão integral dos artigos, tráfego e conversão gerados por eles |
| Termos/privacidade | declara independência de Inep/MEC, uso de IA e possíveis imprecisões; cita provedores como Gemini | implementação técnica efetiva, segurança, aderência aos termos e contratos dos fornecedores |

Na coleta, `/planos` anuncia R$29,90/mês, R$74,70 por três meses e R$238,80/ano (equivalente a R$19,90/mês, com cobrança anual), até 900 explicações/mês e 20 redações/mês; pacote de cinco redações por R$9,90. São condições públicas do concorrente, não teste de compra, preço sugerido ao CadernoCC ou evidência de lucratividade. Preços podem mudar.

A captura do post enviada por Gabriel anuncia o produto; a intenção de atender todos os concursos foi relatada por Gabriel e não foi confirmada nas páginas consultadas. Não presumir arquitetura, número de assinantes, equipe ou roadmap interno do criador.

## 3. O que aprender e o que não transportar sem evidência

**Ciclo de estudo:** o mérito de produto mais evidente é explicar o caminho completo ao aluno. CadernoCC já tem questões, treino, erros, flashcards e Biblioteca; vale verificar se cada resultado leva à próxima atividade adequada. Uma sugestão concreta, como revisar junções e resolver um caso novo, pode ser mais útil que vários índices soltos. Não foi medido qual produto faz isso melhor.

**Distribuição:** guias públicos, provas acessíveis e uma proposta específica oferecem portas de entrada. Para Computação, guias autorais sobre matérias do POSCOMP, erros recorrentes de SQL ou raciocínio de complexidade podem atrair estudo útil. Medir acesso → primeira prática → retorno, não só visitas ou cadastros. O programa de indicação aparece no concorrente; sua existência não prova que afiliados seriam sustentáveis aqui.

**Modelo comercial:** diferenças claras entre grátis, conteúdo aprofundado e uso intensivo ajudam a explicar oferta e limitar custo variável. Não copiar limite/preço sem medir revisão, suporte e uso do nosso público. Uma plataforma focada em prova pode ter sazonalidade; fundamentos e prática podem sustentar estudo entre edições, hipótese a testar.

**Clareza de evidência:** o site usa “TRI oficial” e, na apresentação da redação, “nota oficial do ENEM”; também diz “pontuação estimada” e os termos esclarecem independência e apoio de IA. `llms.txt` qualifica TRI como disponível apenas quando houver dados. Não auditamos os parâmetros, vinculação item/edição ou algoritmo e não concluímos que estejam errados. Para nosso produto, separar dado oficial de fonte conferida, estimativa do nosso sistema e resultado efetivamente emitido pelo órgão. Avaliação automática conforme uma rubrica não se torna correção oficial do Inep.

**Qualidade:** “agente especializado”, rapidez e volume não comprovam acerto ou valor didático. Avaliar explicações e feedback contra casos com referência, condições de validade, contraexemplos e transferência. A proposta anterior de qualidade editorial permanece: fonte realmente consultada e escopo da conferência, sem simular revisão humana.

## 4. Concorrência em formação e cenários de posicionamento

Fontes públicas consultadas: [roadmap.sh](https://roadmap.sh/) apresenta percursos por função, habilidades e projetos; [OSSU](https://github.com/ossu/computer-science) propõe currículo amplo com materiais online; [Alura](https://www.alura.com.br/), [DIO](https://www.dio.me/) e [Rocketseat](https://www.rocketseat.com.br/) anunciam formações/carreiras e cursos. A página de [Full Stack Open](https://fullstackopen.com/en/about/) descreve curso com pré-requisitos, exercícios/projeto e possibilidade de certificado/créditos da Universidade de Helsinki. Não foram testados os cursos, emissão, empregabilidade ou elegibilidade de créditos; não atribuir essa possibilidade a nós.

| Cenário | Valor para o aluno | Vantagem inicial possível | Custo/risco principal | Próximo teste |
| --- | --- | --- | --- | --- |
| A. Exames de Computação | treinar ENADE/POSCOMP e, depois, concursos de TI | base existente e proximidade com o público | acervo e explicações corretos, regras por edição e sazonalidade | executar POSCOMP com cobertura visível e medir uso recorrente |
| B. Fundamentos de Computação | compreender a matéria além da cobrança de uma prova | ligar questões a lições e aplicações | profundidade, revisão técnica e lacunas curriculares | unidade completa de uma competência com exercício de transferência |
| C. Trilhas por atuação | saber o que aprender e demonstrar para uma tarefa profissional | continuidade entre fundamento e prática | competição ampla, atualização de stack e avaliação de projetos | uma trilha curta com uma entrega prática, sem promessa de emprego |
| D. Formação com professores/instituições | turma, acompanhamento e evidência de conclusão | canal e conhecimento de domínio do parceiro | curadoria, privacidade, suporte e responsabilidades | parceiro real usando uma unidade, com escopo e comprador definidos |

Recomendação: A como execução já aprovada; B como núcleo editorial; C como piloto estreito; D conforme parceiro concreto. Uma marca pode acomodar os objetivos sem os transformar em um único menu gigante. Confirmar necessidade antes de criar telas, planos pagos ou estruturas genéricas.

## 5. Roadmaps: uma matriz de competências, com percursos diferentes

Escolher “analista” é insuficiente: analista de dados, de sistemas e de segurança têm tarefas diferentes. A pessoa escolhe objetivo, ponto de partida, pré-requisitos e disponibilidade; o roteiro apresenta uma próxima ação, critérios para avançar e alternativas. Um checklist de tecnologias não demonstra domínio.

Fundamentos compartilhados podem incluir lógica/programação, algoritmos/estruturas, bancos, sistemas/redes e práticas de software. Os percursos usam esse núcleo com profundidades e aplicações distintas. O índice oficial de [CS2023 (ACM/IEEE-CS/AAAI)](https://csed.acm.org/) foi consultado como candidato a referência curricular; o relatório completo não foi lido nem mapeado. Uma matriz nacional ainda deve ser construída e conferida com professores, programas/matrizes aplicáveis e referências apropriadas, não inferida apenas de questões antigas.

| Percurso candidato | Competência ilustrativa | Evidência prática possível | Limite |
| --- | --- | --- | --- |
| Backend | modelar dados, consultar corretamente e aplicar autorização em uma API | API pequena com contrato, testes de autorização, tratamento de erros e consultas justificadas | não comprova ser especialista em backend inteiro |
| Analista de dados | interpretar dados, escrever SQL e explicar limites de uma análise | consulta/reprodução sobre conjunto pequeno e relatório com justificativas | um gráfico bonito não comprova validade da análise |
| Mobile | modelar estado, consumir API, tratar falhas e acessibilidade | aplicativo pequeno com estados de carga/erro/offline e avaliação dos fluxos | avaliar a plataforma/versão escolhida; não exigir toda stack mobile |
| Analista de sistemas | elicitar regras, modelar comportamento e justificar decisões | caso com requisitos, modelo, contrato e critérios de aceitação | distinguir entendimento do problema de decorar notação |

**Primeiro piloto recomendado:** competência “consultas SQL com junções e valores ausentes”. Pré-requisitos → explicação original → casos resolvidos → questão de exame vinculada → consulta nova com resultado verificável → justificativa de limites. A mesma unidade pode alimentar POSCOMP, fundamentos e backend/dados, preservando o contexto de cada atividade. Não está produzida ou publicada por esta proposta.

Evoluir de competência para trilha só depois de verificar continuidade e pré-requisitos. Tema de prova, competência e papel profissional têm relações muitos-para-muitos; evitar duplicar material ou presumir equivalência total entre eles.

## 6. Certificados: proposta de valor e critérios

Há mercado e precedentes, mas emitir um PDF não demonstra aprendizagem nem torna a plataforma uma instituição reconhecida. Não prometer diploma, reconhecimento oficial, equivalência universitária, certificação de fabricante ou emprego sem o fundamento correspondente. A relevância depende do emissor, critério e evidência, não da palavra “certificado”.

| Tipo | O que pode afirmar | Critério proposto |
| --- | --- | --- |
| Participação | participação registrada em atividade delimitada | registro verificável de atividade; não afirmar competência avaliada |
| Conclusão | cumprimento do percurso e avaliação descritos | requisitos explícitos, versão do material e resultado; distinguir carga estimada de tempo efetivamente registrado |
| Competência avaliada | realização de tarefas de escopo definido sob condições conhecidas | avaliação com itens novos/projeto, rubrica, critérios de aprovação e limites documentados |

Para o piloto, preparar uma rubrica e avaliar se alunos conseguem aplicar o conceito a casos novos. Não conceder domínio de backend por contar acertos repetidos em questões conhecidas. Se houver projeto, definir revisão, autoria, retentativas e feedback proporcionais; não implantar biometria ou fiscalização invasiva por antecipação. Informar condições de avaliação, inclusive ausência de supervisão quando aplicável.

Uma emissão futura deve identificar emissor e credencial, nome/escopo, competências, critérios, data/versão, resultado e verificação por identificador/QR, com correção/revogação e exposição mínima de dados. [Open Badges/1EdTech](https://www.1edtech.org/standards/open-badges) documenta metadados, emissor, critérios e possíveis evidências; é uma referência de interoperabilidade, não chancela automática de qualidade ou reconhecimento. Não declarar conformidade antes de implementar/verificar.

A decisão de construir emissão fica posterior ao desenho e teste da avaliação. Se uma instituição quiser coemitir, confirmar formalmente responsabilidade, critérios, uso de marca e verificação. Nenhuma instituição foi contatada nesta pesquisa.

## 7. Material rico sem hospedar livros indevidamente

É possível ensinar conceitos com redação, exemplos, figuras e exercícios autorais, acompanhados de referências efetivamente consultadas. O material deve ser útil por si: objetivo, pré-requisitos, explicação do mecanismo, condições/limites, exemplo reproduzível, contraexemplo, recuperação ativa, transferência e solução comentada. Os três pilotos da Biblioteca são ponto de partida, não currículo completo.

| Origem | Caminho proposto | Conferência necessária |
| --- | --- | --- |
| Conteúdo autoral da equipe/professor | escrever, executar exemplos, revisar e versionar | licença/titularidade combinada, fontes reais e evidência da revisão |
| Recurso gratuito de terceiro | indicar leitura e seção no ambiente do autor | acesso e atualização; gratuidade não comprova direito de copiar, adaptar ou vender |
| Obra aberta compatível | adaptar/republicar apenas o que a licença e o escopo permitem | licença da edição e de elementos de terceiros; atribuição, alterações e demais condições |
| Obra comercial | referência e acesso legítimo externo; solicitar licença para reprodução/adaptação/integração desejada | contrato específico; assinatura pessoal/institucional não é autorização genérica de redistribuição |

As páginas oficiais de [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) e [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) foram consultadas: BY permite uso comercial/adaptação com condições; NC restringe uso comercial. Outras variantes, como SA/ND, exigem análise própria; não foi feita revisão jurídica de um acervo. Não presumir que manter um material gratuito dentro de um produto pago resolva a restrição NC.

O repositório de currículo OSSU possui [licença MIT](https://github.com/ossu/computer-science/blob/master/LICENSE); isso não transfere direitos dos livros/cursos externos que ele aponta. A página de Full Stack Open confirma acesso gratuito e certificado, mas a licença de republicação não foi confirmada nesta coleta. OpenStax foi tentado, mas a página retornou aviso de JavaScript, sem licença da obra verificável; não é usado como exemplo de material liberado. O próprio acervo comercial de cada fonte precisa de análise, mesmo quando o currículo é aberto.

IA pode ajudar com rascunhos, variações e organização; especialistas, fontes e execuções sustentam a revisão. Não usar um livro comercial para reconstruir capítulos ou exercícios disfarçados de apostila própria. Gerar maior volume não dispensa conferir conceito, alternativa, exemplo, código e contexto de versão. Preservar a separação entre transcrição oficial, explicação autoral e exercício gerado.

## 8. Pearson e parceiros: caminhos concretos

A [página oficial de Global Rights Licensing da Pearson](https://www.pearson.com/en-us/legal-information/global-rights-licensing.html) apresenta negociação de direitos de tradução/adaptação; a página de [Pearson+](https://www.pearson.com/en-us/higher-education/products-services/pearsonplus.html) apresenta eTextbooks e estudo. Isso comprova canais/ofertas públicos, não elegibilidade, orçamento ou integração contratada para o CadernoCC.

Preparar níveis de parceria: (1) referências e links para aquisição/acesso legítimo; (2) licença de um trecho, figura ou conjunto delimitado, quando fizer sentido; (3) integração de acervo para um público, território e prazo negociados. Para conversar, ter escopo, obras/edições, direitos pretendidos, modelo gratuito/pago, público, distribuição, responsabilidades, prazo e estimativa honesta de uso. Não enviar números de usuários ou de crescimento inventados.

Um primeiro parceiro pode ser professor, grupo de pesquisa, autor de material aberto ou instituição com uma unidade de ensino concreta. Isso pode testar o processo editorial e a avaliação antes de uma negociação ampla com editora. Não prometer selo, certificado conjunto ou acesso aos livros da biblioteca da instituição sem acordo correspondente. Não houve contato com Pearson, editoras ou instituições nesta entrega.

## 9. Crescimento, operação e ordem de execução

**Aprendizagem:** acompanhar alunos que voltam e aplicam uma competência em caso novo, com amostra, janela e condições; medir erros editoriais e tempo de correção. Separar isso de horas de tela, medalhas ou acertos memorizados.

**Produto e mercado:** observar prova/curso de origem, primeira prática, retorno por coorte e continuidade após o exame; testar o comprador da oferta. Margem deve considerar revisão, autoria, avaliação de projetos, suporte, infraestrutura, pagamentos e aquisição de usuários. Preço do concorrente e existência de certificado não provam margem nem demanda aqui.

**Arquitetura:** reaproveitar questão/versionamento, conceitos, lições, progresso e turmas. Desenhar vínculos entre competência, pré-requisito, recurso, atividade e evidência antes de implementar. Não criar simultaneamente LMS, IDE online, motor de certificados e marketplace. Execução de código de alunos exigiria isolamento/limites próprios; um piloto pode começar com consulta/caso controlado ou revisão de entrega, sem infraestrutura arbitrária de código remoto.

**Sequência proposta:**
1. Executar POSCOMP conforme D18, com fidelidade e cobertura visíveis.
2. Desenhar matriz mínima e uma unidade SQL completa; registrar licença/procedência e rubrica de aplicação nova.
3. Observar uso dessa unidade em grupo pequeno e comparar entendimento/transferência, com limites da amostra explícitos. Não alegar efeito causal comprovado por depoimentos.
4. Decidir se a unidade sustenta percurso curto e credencial de escopo restrito; só então implementar emissão/verificação proporcional.
5. Ampliar competências com professores/autores e explorar parceria editorial delimitada. Continuar os dossiês das outras frentes já aprovados, sem transformar preparação em vários lançamentos.

Não foi feita pesquisa com alunos, empregadores, professores ou compradores, nem prova de mercado, avaliação psicométrica, auditoria jurídica, benchmark de carga ou teste de emissão de certificado nesta entrega.

## 10. Diário compartilhado: perguntas para Claude, Gemini e próxima revisão

Este documento e o WORKBOARD são o registro para análise posterior; nenhum parecer de Claude/Gemini é presumido. Não houve mensagem externa enviada.

- **Claude:** avaliar os menores contratos para competência → atividade → evidência sobre o modelo atual, com arquivos afetados; preservar ENADE/POSCOMP e neutralidade institucional do PR #69. Propor um incremento pequeno, sem implementar todas as frentes.
- **Gemini:** revisar a matriz e a unidade proposta por correção conceitual, pré-requisitos, referências e qualidade da avaliação; apontar afirmações sem sustentação e contraprovas. Não simular fonte consultada, validação psicométrica ou revisão humana.
- **Ambos:** contestar os cenários A–D, a utilidade real de certificados para o público e os custos de autoria/revisão/suporte; diferenciar hipótese de dado observado. Propor um próximo experimento com critério verificável, sem reabrir autorização de POSCOMP.
