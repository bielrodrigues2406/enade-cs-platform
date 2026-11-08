# CadernoCC como produto: expansão e validação

Proposta por pedido de Gabriel. Base técnica observada: main `75828bb`, com PR #65 integrado e CI verde; PR #66 é posterior à revisão funcional do Codex. Esta pesquisa consulta páginas públicas e descreve ofertas anunciadas; não é teste pago dos concorrentes, pesquisa exaustiva ou comprovação de eficácia. Não altera aplicação, acervo, regras de produto ou implantação.

## 1. Parecer

É tecnicamente viável reaproveitar a plataforma para POSCOMP, outros ENADE, ENEM e concursos. A hipótese de mercado desocupado não se confirma: banco de questões, professores, comentários, simulados, teoria e revisão já são produtos consolidados. Design bom e importação por PDF ajudam a operar, mas não demonstram demanda, disposição de pagar ou vantagem defensável.

A melhor próxima hipótese é **preparação em Computação, começando por POSCOMP**, aproveitando repertório, acervo e possíveis professores. Em paralelo, testar se um professor ou cursinho pequeno paga para usar o sistema com seu próprio conteúdo. ENEM e Medicina ficam como pilotos posteriores, dependentes de canal de distribuição e especialista, não como lançamento horizontal simultâneo.

## 2. Concorrentes efetivamente consultados

| Segmento | Fonte pública | Oferta observada | Consequência |
| --- | --- | --- | --- |
| Concursos | [Qconcursos](https://www.qconcursos.com/) | questões, simulados, cadernos, comentários, aulas e gabaritos comentados por professores; também apresenta ENEM | proposta genérica já atendida |
| Concursos | [TEC Concursos](https://www.tecconcursos.com.br/) | banco comentado por professores, teoria, guias por edital e acompanhamento | especialização por edital e curadoria também têm concorrência |
| ENEM/vestibulares | [Estuda.com](https://estuda.com/) | questões, relatórios, cronograma, flashcards, redação e simulados anunciados com TRI | a combinação de prática e revisão já existe |
| ENEM/vestibulares | [Professor Ferretto](https://www.professorferretto.com.br/) | questões resolvidas em vídeo, filtros, revisão dos erros, aulas, prática e planejamento | não presumir que uma plataforma grande precise do nosso motor |
| Medicina | [MedQ](https://medq.com.br/) | questões comentadas, agenda adaptativa e revisão espaçada para residência/Revalida | revisão inteligente também não é novidade exclusiva |
| Medicina | [Medway](https://www.medway.com.br/) | questões comentadas alternativa a alternativa, professores, aulas e preparação por prova | exige competir com conteúdo especializado e distribuição |
| Escolas | [Estuda Escolas](https://estudaescolas.com.br/) | página institucional específica para escolas, a aprofundar em demonstração comercial | B2B também tem concorrentes; não declarar white label ou integração disponível sem conferir contrato |

Números de usuários/aprovações e tamanho de bancos nessas páginas são publicidade dos fornecedores, não medidas auditadas por nós. Não foram comparados preços de checkout, contratos, suporte ou qualidade de correção. A página tentada de Estratégia Questões não forneceu conteúdo legível nesta coleta e não sustenta conclusões.

Fontes oficiais consultadas: [SBC/POSCOMP](https://www.sbc.org.br/poscomp/), [Inep: provas do ENEM](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos), [Inep: ENAMED](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed). Confirmam referências públicas para aquisição; não fiz download nem inventário integral de todos os anos. A página atual do ENAMED descreve mudanças de integração/periodicidade: conferir regulamento e edição antes de implementar, preservando ENADE Medicina, ENAMED, ENARE e Revalida como origens distintas.

## 3. Prioridade por vertical

| Vertical | Reaproveitamento | Trabalho novo principal | Recomendação |
| --- | --- | --- | --- |
| POSCOMP | alto em conteúdo e público de Computação | inventário anual, importador, taxonomia e formato próprios | próximo piloto de produto |
| Concursos de TI | alto em matérias, menor no contexto de prova | bancas, editais, certo/errado, penalidades e legislação versionada | próximo adjacente se houver demanda |
| Outros ENADE | alto no motor, menor no conteúdo | especialistas de cada curso, matrizes/edições e explicações | parceria por curso, sem prometer todos |
| ENEM | alto em funções básicas; baixo em conteúdo e distribuição atual | competências/habilidades, idiomas, redação e interpretação de notas | testar com professor/cursinho parceiro |
| ENAMED/Medicina | motor reutilizável, curadoria muito diferente | especialistas médicos, fontes clínicas e atualização temporal | entrar apenas com parceiro responsável pelo conteúdo |
| Concursos em geral | parcial | muitos formatos, editais, conteúdos e regras | fase posterior; evitar catálogo amplo incompleto |

O tamanho do mercado não prova que conseguimos adquirir clientes nele. POSCOMP tem mercado mais estreito e sazonal, mas permite testar a operação editorial com maior proximidade. Não foi demonstrado que esse nicho esteja vazio; falta pesquisar cursos, comunidades e bancos específicos de POSCOMP antes de precificar.

## 4. Produto e modelos de negócio a validar

**Hipótese principal B2C:** CadernoCC para estudar Computação por questões, com preparação específica ENADE/POSCOMP e fundamentos reutilizáveis. Conta única; acervos e resultados de cada exame separados. Banco básico pode ser gratuito; profundidade editorial, trilhas ou acompanhamento são hipóteses de oferta paga, não planos já definidos.

**Hipótese paralela B2B:** ferramenta para professor/cursinho publicar listas e provas, comentar alternativas, acompanhar dificuldades e corrigir conteúdo. O parceiro traz domínio e audiência; a plataforma reduz trabalho operacional. Cobrança por turma, aluno ativo ou licença precisa de teste comercial e limite claro de suporte.

**White label:** opção após um parceiro demonstrar necessidade e pagar pelo piloto. Domínio e identidade do parceiro sobre o mesmo produto, sem fork por cliente. Não prometer customização ilimitada, integração com qualquer sistema, revenda de conteúdo de terceiros ou operação clínica. Plataformas grandes como Ferretto são referências de mercado e possíveis integrações futuras, não compradores presumidos. Professores independentes com público existente são interlocutores mais acessíveis para a primeira descoberta.

Marketplace de professores e divisão automática de receita ficam posteriores: adicionam descoberta, pagamentos, repasses e resolução de conflitos antes de provar a transação básica. Não ampliar o menu com um catálogo de exames vazios.

## 5. Escalar aquisição e curadoria

1. Inventariar edições e documentos, com URL, procedência, acesso, hash, modalidade, idioma, caderno e gabarito definitivo. “Todos os anos” exige tabela de cobertura; uma ausência deve continuar visível.
2. Extrair texto e propor recortes/limites da questão. Guardar a página original. Tratar duas colunas, continuação de página, textos compartilhados e figuras como casos reais, não exceções descartadas.
3. Ligar questão, alternativas e chave da **mesma aplicação/caderno**. Cores podem repetir itens com ordens diferentes; não contar tudo como questão nova nem aplicar a letra de outro caderno. Preservar anuladas, retificações e versões.
4. Validar estrutura e sinalizar inconsistências: limites cortados, falta de alternativa, chave inválida, duplicidade e divergência de gabarito. IA/OCR propõem; confiança alta não equivale a aprovação.
5. Conferir editorialmente o piloto: imagem completa, enunciado, resposta e explicação, com revisão proporcional e procedência real. Exigir especialista do domínio para explicações médicas; não atribuir revisão de professor a um agente.
6. Publicar lotes idempotentes, manter tentativas ligadas à versão respondida e permitir retirada/correção rastreável. Mostrar cobertura e origem, não só total de itens.
7. Medir custo por questão **publicável**, tempo de revisão, taxa de correção posterior e solicitações de suporte. Só depois automatizar os gargalos medidos.

Imagem da questão facilita fidelidade, mas texto pesquisável e acessível continua necessário como camada auxiliar. Redação, discursiva, certo/errado, itens múltiplos e pontuação negativa não cabem no mesmo formulário de cinco alternativas. Importação automática reduz trabalho mecânico; explicação correta, classificação, atualização e aquisição de alunos continuam centrais.

## 6. Arquitetura proposta, sem reescrita agora

Preservar o monólito modular, componentes separados, IDs e versões. Extrair pequenas responsabilidades quando POSCOMP demonstrar a necessidade. Um segundo contexto de exame validado deve orientar a generalização; não criar um framework de concursos antecipadamente.

Contratos a desenhar: família de exame → edição/aplicação → caderno → ocorrência do item, além da identidade reutilizável da questão. A chave e a posição pertencem à ocorrência/versão adequada; uma letra isolada não identifica uma alternativa entre cadernos. Preservar a modelagem já existente onde atender ao contrato.

Taxonomias por domínio/exame com vínculos explícitos, evitando transformar todas as matérias numa lista universal. Regras de montagem, elegibilidade e pontuação por formato. Acertos percentuais não são nota oficial TRI; estimativas exigem método validado, dados e rótulo apropriados. A correção de redação exige rubrica e processo próprios.

Instituições/turmas não devem depender do IFSP. Se vender a organizações, definir escopo de propriedade, compartilhamento e autorização no servidor antes de abrir acesso; não oferecer isolamento comercial sem testes. Material global e material privado do parceiro exigem contratos distintos. Conta única entre produtos é possibilidade, não autorização para compartilhar histórico com qualquer escola.

Domínio `cadernocc.com.br` combina com Computação. Se a expansão geral se provar, decidir marca guarda-chuva depois; não renomear agora nem criar vários deploys apenas para ter subdomínios.

## 7. Viabilidade econômica e editorial

A principal variável inicial é custo de conteúdo confiável e distribuição, não armazenamento de imagens. Medir: aquisição e revisão por item, atualização, professor, suporte, infraestrutura, pagamento/impostos e aquisição de clientes.

Margem de contribuição = receita líquida − custos variáveis de uso, curadoria/atendimento e canal atribuíveis ao cliente. Separar custo de criar acervo de custo recorrente de mantê-lo. Comparar essa margem com desenvolvimento, manutenção e despesas fixas. Registrar retenção por ciclo de prova e renovação, não presumir assinatura anual a partir de teste gratuito.

Antes de comercializar, confirmar condições de reutilização comercial das fontes e de textos/imagens nelas incluídos. PDF público não comprova licença irrestrita; comentários e vídeos de concorrentes não podem virar nosso acervo. Contratos com professores devem definir autoria/licença, atualização, uso de IA, remuneração e correção de erros. No ENEM, considerar usuários menores e o tratamento de dados no desenho comercial. Estas são pendências concretas de diligência, não parecer jurídico feito nesta pesquisa.

## 8. Experimentos e critérios de decisão

**Descoberta:** entrevistar, como meta proposta, 8–12 estudantes de Computação e 2–3 professores/cursinhos. Perguntar por ferramentas que já pagam/usam, rotina, problema recente e custo dele. Evitar perguntas indutivas como “você usaria uma plataforma bonita?”. Não houve entrevistas nesta entrega.

**Piloto POSCOMP:** inventariar todos os anos disponíveis; adquirir inicialmente duas edições confirmadas e publicar um lote pequeno (20–50 questões) cobrindo diagrama, fórmula e texto longo. Conferir 100% das associações item/alternativas/gabarito desse lote; erro conhecido de chave/corte impede publicar o item. Depois ampliar por ano com recibos de cobertura, sem prometer acervo completo antes da conferência.

**Piloto comercial:** um professor com audiência própria e uma turma pequena usando o produto por um ciclo curto acordado. Verificar uso recorrente, erros encontrados, horas de curadoria/suporte e compromisso real de pagamento/renovação. Elogio ou cadastro não contam como validação financeira.

**Continuar:** demanda recorrente, conteúdo confiável e custo sustentável com parceiro disposto a pagar. **Reformular:** público usa, mas valor está em outra tarefa ou formato. **Pausar vertical:** não há parceiro competente, fontes utilizáveis ou motivo verificável para trocar a solução atual. Não há meta numérica de retenção validada; defini-la antes do piloto a partir do canal e da oferta.

Depois desse aprendizado, escolher **uma** expansão seguinte: concursos de TI, outro ENADE com parceiro, ou ENEM com cursinho. Medicina exige parceiro especializado antes da promessa comercial. Não lançar todas em paralelo.

## 9. Lições experimentais e versão atual

A decisão de disponibilizar os três pilotos da Biblioteca é separada da tese de expansão. Recomendo uma apresentação experimental explícita, fontes e limites visíveis, sem anunciar curso completo ou benefício comprovado. Feedback de clareza/utilidade deve orientar as outras 20 lições. Se Gabriel preferir adiar, não prender a publicação das correções de questões à expansão didática; um controle para ocultar a Biblioteca só pode ser declarado existente depois de conferir/implementar.

PR #65 foi integrado com CI verde. O PR #66 acrescenta treino por origem e mudanças de Biblioteca e remove o tema escuro; está fora da revisão funcional anterior. Não afirmar que a versão atual inteira foi retestada por esta pesquisa. Nenhum deploy ocorreu aqui.

## 10. Handoff para Claude — resposta no WORKBOARD

Pedido de Gabriel: discutir expansão como produto. Claude, antes de implementar generalizações, registrar contrapontos a:

1. Quais regras/queries hoje pressupõem ENADE ou IFSP? Apresentar arquivo e comportamento, sem iniciar refatoração ampla.
2. Qual o menor adaptador para importar duas edições POSCOMP mantendo origem, gabarito, tentativas e cobertura?
3. Que parte do pipeline atual realmente dispensa intervenção e qual o custo observado de revisar um lote?
4. Qual o menor contrato para um professor publicar material privado e acompanhar turma de qualquer instituição com autorização isolada?
5. Que função de um parceiro específico nos faria economizar trabalho frente à ferramenta que ele já usa?
6. Quais condições impedem publicar os três pilotos atuais como experimental, distinguindo defeito técnico de melhoria futura?

Responder com evidência e uma proposta pequena. Este registro é uma solicitação assíncrona nos documentos compartilhados; não representa conversa ou concordância já recebida de Claude.
