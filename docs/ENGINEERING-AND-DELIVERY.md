# Engenharia, propriedades e validação

Status: contrato de engenharia. Há base executável com testes de API/PostgreSQL e Chromium; os demais critérios permanecem requisitos para incrementos futuros. Referência: 22/10/2026.

## 1. Qualidade proporcional ao risco

Preferir módulos claros e fluxo direto. Uma abstração deve resolver duplicação ou variabilidade real; um padrão conhecido não é justificativa suficiente. Evitar interfaces de uma implementação sem necessidade, factories universais, múltiplos estados globais e dependências que um recurso pequeno não exige.

Revisar a solução por funcionalidade, correção, complexidade, segurança, operação e UX. Uma implementação longa não é evidência de robustez. Uma implementação curta não é evidência de simplicidade se oculta erros ou contratos.

O projeto usa princípios de TigerStyle — invariantes, limites, estados e falhas explícitas — adaptados a TypeScript e aplicações web. Não importar mecanicamente regras de alocação, quotas de assertions, zero dependências ou encerramento de processo para entradas inválidas.

### 1.1 Organização da interface

Pedido de Gabriel em 30/10/2026, válido para Claude e Codex:

- HTML em arquivos `.html` ao lado do componente, referenciados por `templateUrl`; TypeScript contém tipos, estado, eventos e coordenação. O Angular aceita templates inline, mas a convenção deste projeto é usar arquivos separados.
- CSS em arquivos `.css`. Tokens e regras compartilhadas permanecem no stylesheet global; regras exclusivas de um componente podem usar `styleUrl`. Não criar arquivos CSS vazios nem mover regras globais para estilos encapsulados sem conferir seus consumidores.
- Não usar strings de HTML/CSS em TypeScript, atributos `style` com regras estáticas ou manipulação de estilo para compor telas. Usar classes para estados e CSS para layout, cores, espaçamento e animação. Bindings de propriedades CSS podem fornecer valores dinâmicos necessários (dimensão original de imagem, índice ou proporção); cálculos de apresentação e regras ficam no CSS.
- Nomes devem explicar a responsabilidade; funções pequenas quando a divisão ajudar a leitura. Extrair componentes e contratos quando houver responsabilidade própria ou reutilização real, sem criar camadas por antecipação.
- Refatorações de organização preservam contratos e comportamento. Não misturar extração de templates com redesenho, mudança de regras ou troca do roteamento. Validar build e fluxos existentes; criar teste novo somente para risco ou comportamento novo.

### 1.2 Revisão proporcional de conteúdo

Não repetir integralmente a conferência já registrada por agentes independentes para os mesmos arquivos e hashes. Verificar automaticamente integridade, vínculos, cobertura, anulações e elegibilidade; concentrar a inspeção manual nos recortes alterados, divergências, ressalvas e amostras dos demais lotes. Se houver erro sistemático, ampliar a revisão do grupo afetado. Amostragem não cria aprovação para itens ainda sem conferência independente, nem transforma registro de aprovação em comprovação de publicação em outro ambiente.

### 1.3 Manutenção humana e passagem à fábrica de software

**Requisito obrigatório de Gabriel em 30/10/2026, para Claude Code e Codex.** O código será disponibilizado à fábrica de software. Um mantenedor humano novo deve conseguir localizar uma regra, entender seu fluxo, alterá-la e verificar o resultado usando o repositório, sem depender de conversas com os agentes. Esse critério vale durante o desenvolvimento e na revisão integral final (CQ-2).

- **Arquitetura e responsabilidades:** módulos por domínio; componentes cuidam da interação, regras de negócio têm lugar definido e acesso a dados tem fronteiras claras. Shell e bootstrap coordenam telas, sem continuar acumulando regras de funcionalidades. Criar separações úteis para o fluxo atual, com dependências explícitas; não acrescentar camadas ou frameworks internos sem necessidade.
- **Funções legíveis:** uma responsabilidade clara por função, nomes que expliquem a intenção e encadeamento fácil de seguir. Dividir funções longas, callbacks extensos, condicionais profundas e expressões que obriguem o leitor a decifrar várias decisões de uma vez. Usar retornos antecipados quando simplificarem o fluxo. Extrair por responsabilidade, sem apenas repartir a mesma complexidade entre dezenas de helpers.
- **Contratos compreensíveis:** entradas e retornos tipados, pequenos o suficiente para sua finalidade e com significado estável. Separar DTO público de linha do banco; representar variações legítimas explicitamente. Evitar objetos que reúnem dados de vários fluxos, formatos de retorno surpreendentes, flags contraditórias e conversões que escondam inconsistências de tipos.
- **Redundância e estado:** concentrar regras duplicadas em um lugar claro quando forem a mesma regra; remover código morto, cópias de componentes, requisições repetidas e estado derivável desnecessário. Preservar validações nas fronteiras e constraints do banco: proteções em camadas diferentes não são duplicação acidental.
- **Apresentação e explicação:** manter HTML/CSS/TypeScript separados conforme §1.1. Documentar decisões, limites e razões de regras menos óbvias; o nome e a estrutura devem explicar o funcionamento comum. A documentação precisa corresponder ao código entregue.

**CQ-2 é uma etapa obrigatória após estabilizar os fluxos prioritários e antes de declarar a entrega pronta para a fábrica de software.** Revisar toda a base mantida pelo projeto: frontend (TS/HTML/CSS), API, SQL/migrations, scripts administrativos/importação, testes e configuração de execução/CI. A revisão proporcional de questões em §1.2 não reduz esse escopo de código. Dependências de terceiros e artefatos gerados não serão reescritos.

1. Inventariar módulos, dependências, pontos de entrada e responsabilidades; registrar cobertura da revisão e achados por módulo, com um responsável por lote no WORKBOARD.
2. Simplificar e refatorar os achados; reescrever trechos ou módulos quando a estrutura atual impedir clareza. Dividir em PRs coesos e revisáveis, preservando funcionalidades, autorização, contratos e integridade dos dados. Não fazer uma reescrita geral sem diagnóstico nem editar migrations já aplicadas.
3. Executar os testes apropriados aos riscos e revisar cada lote independentemente. Acrescentar testes de comportamento quando a proteção existente for insuficiente; aprovação de testes e métricas automáticas não substitui leitura do código.
4. Atualizar o mapa da arquitetura, os contratos e o guia para novos mantenedores: preparação local, localização das regras, alteração de um fluxo, execução dos testes, migrations e operação. Registrar o que foi revisado, corrigido e validado, com os limites restantes.

A etapa só fica concluída com cobertura de todos os módulos registrada, achados que comprometem os critérios de clareza, divisão e manutenção corrigidos e documentação utilizável por quem recebe o projeto. Pendências nesses critérios impedem chamá-la de concluída; preferências estéticas e melhorias opcionais ficam identificadas separadamente. Não marcar CQ-2 pronta apenas porque o sistema funciona, o CI está verde ou os templates foram separados. Esta exigência de qualidade não amplia o escopo de funcionalidades.

## 2. Propriedades de domínio e critérios de aceitação

| ID | Propriedade | Evidência/teste apropriado |
| --- | --- | --- |
| P01 | Questão oficial publicada possui fonte, versão e revisão; pendentes não são entregues ao estudante | Integração catálogo/API e transições editoriais inválidas |
| P02 | Usuário só acessa/edita tentativas autorizadas | Testar com dois usuários reais, incluindo IDs válidos de outro usuário |
| P03 | Finalizar uma tentativa repetidamente ou em concorrência produz um único resultado persistido | Teste de integração com PostgreSQL e requisições concorrentes |
| P04 | Reordenação de alternativas preserva o resultado por identidade estável | Teste de propriedade com permutações e resultado esperado independente |
| P05 | Alterar gabarito atual não muda silenciosamente tentativas antigas | Integração com duas versões e regra explícita de revisão |
| P06 | Autosave atrasado não substitui resposta mais recente nem altera tentativa finalizada/expirada | Testar entregas fora de ordem, reload e autosave concorrente com finalização/expiração, com condição atômica de estado |
| P07 | Modo simulado não revela gabarito ou explicações antes da finalização | Inspecionar payloads, rotas alternativas e resposta em andamento |
| P08 | Atualizar página não reinicia deadline; ações vencidas obedecem à regra do servidor | Relógio controlável e teste de fronteira antes/depois do prazo |
| P09 | Anuladas, não respondidas, itens repetidos e amostra pequena seguem regras documentadas | Casos calculados à mão e testes de agregação |
| P10 | Falha de IA não impede responder, salvar e consultar conteúdo já disponível | Integração com falha controlada na fronteira externa |
| P11 | Reprocessar documento idêntico não duplica questões publicadas | Teste de importação com hash/idempotência e identidade de origem |
| P12 | Erro ao salvar não é anunciado como sucesso e permite recuperação coerente | E2E com falha controlada e confirmação posterior |
| P13 | Enunciado importado não executa HTML/script não confiável | Fixtures adversariais e teste do renderer real |
| P14 | Excluir conta cumpre a política de retenção definida, sem preservar identificadores em logs indevidos | Integração e revisão de dados/retentores após implementar a política |
| P15 | Resposta referencia item/versão da própria tentativa e alternativa daquela versão, com uma resposta vigente por item | Integração com IDs existentes porém incompatíveis e requisições concorrentes |
| P16 | Nova versão em revisão não substitui a versão publicada até aprovação | Integração editorial com v1 publicada e v2 pendente/rejeitada/aprovada |

Estes critérios orientam testes significativos; não exigem uma suíte enorme antes de qualquer tela. Implementar junto ao fluxo e aos riscos cobertos. Testes de propriedade são especialmente úteis para permutações, transições e idempotência; não são substitutos universais para integração e UX.

## 3. Estratégia de testes

- Domínio: exemplos calculados independentemente e propriedades, incluindo estados inválidos e fronteiras.
- Persistência/API: PostgreSQL real para constraints, migrations, autorização, transações e concorrência. SQLite e mocks não representam automaticamente esses contratos.
- Frontend: comportamento de interação, renderização segura e estados relevantes; evitar testes que só confirmam nomes de classes ou chamam a própria implementação como oráculo.
- E2E: frontend + API + banco para buscar, responder, salvar, recarregar e revisar. Mock de provedor de IA é aceitável na fronteira e deve ser identificado; mock de toda API não comprova integração.
- Browser: preferir seletores por papel/nome acessível, testes isolados e esperas baseadas em estado. Não usar sleeps arbitrários como mecanismo de sincronização.
- Visual: capturas em dados e estado controlados, com inspeção humana. Screenshots não substituem assertions sobre interação e dados.
- Acessibilidade: automação mais teclado, zoom/reflow e inspeção manual dos fluxos críticos. Não declarar conformidade total só porque um scanner passou.

Não criar testes para mudanças documentais ou cosméticas triviais sem risco que os justifique. Não perseguir contagem de testes ou cobertura percentual como substituto para corrigir as falhas importantes.

## 4. Ambiente reproduzível

Na primeira implementação, documentar comandos reais de instalar, configurar, subir dependências, aplicar migrations, carregar seed, executar API/web, testar e fazer build. Os comandos da base atual estão no README; não apresentar os demais fluxos planejados como executáveis.

Seed determinístico com questões autorais claramente identificadas e referências oficiais apenas quando conferidas. Dados de teste não contêm dados pessoais reais. Versões e lockfile fixados. Banco de testes e credenciais isolados de produção. Uma execução de testes não deve enviar e-mails, consumir IA paga ou modificar integrações externas sem intenção explícita.

Controlar o relógio onde há deadline/revisão. Isolar dados por teste e tornar limpeza segura e restrita ao ambiente de testes. Começar com scripts simples; não criar um framework de orquestração de agentes para satisfazer o nome de uma skill.

## 5. Segurança e operação

- Autorização por recurso no servidor e papéis mínimos para estudante, curadoria e administração.
- Sessões e credenciais protegidas; avaliar CSRF conforme autenticação adotada; limitar origem, payload, uploads e consumo de endpoints caros.
- Sanitização e conteúdo estruturado no renderer. Não confiar em HTML/Markdown de IA, PDF ou administrador apenas por sua origem.
- Segredos fora do repositório; logs úteis sem respostas discursivas ou identificadores pessoais desnecessários.
- Metadados de auditoria para publicação e correções, com retenção definida.
- Índices a partir de consultas e planos medidos; métricas devem evitar N+1 e varreduras desnecessárias. Não introduzir cache distribuído sem diagnóstico.
- Antes de produção: backups e restauração ensaiada, migrations verificadas, configuração por ambiente, tratamento de falhas e rollback operacional possível.
- Custos de IA com limite de requisições/contexto, timeout, orçamento e cache por conteúdo/versão quando apropriado.

Pseudonimização não equivale automaticamente a anonimização. Notas e histórico são dados pessoais quando identificáveis; não são automaticamente dados sensíveis apenas por serem educacionais. Definir finalidade, base legal, acesso e retenção para cada tratamento; consentimento não é uma solução universal. Material público também exige análise da procedência de conteúdo de terceiros.

## 6. Fluxo de colaboração

1. Definir resultado, telas/contratos afetados e critérios relevantes.
2. Verificar trabalho concorrente e criar branch isolada a partir da base atual.
3. Implementar fatia pequena, com dados e estados reais, em commits Conventional Commits coesos por responsabilidade. Agrupar os testes com o comportamento que validam.
4. Validar comportamento e inspecionar UI quando aplicável.
5. Revisar o diff: escopo, legibilidade, riscos, dependências e efeitos nas propriedades.
6. Atualizar documentação e abrir PR curto: mudança em uma ou duas frases, validação executada e limitações relevantes.
7. Conferir se main mudou antes da integração. Resolver conflitos com atenção ao significado; não escolher automaticamente "ours/theirs". Quando o merge estiver autorizado, concluí-lo após as verificações, conferindo o HEAD revisado e preservando os commits.

Trabalho paralelo tem um responsável por mudança/contrato. Combinar ownership de arquivos compartilhados ou dividir em PRs dependentes. Não deixar agentes editarem o mesmo arquivo sem coordenação. Não exigir sincronização remota a cada pequena edição; publicar incrementos coerentes e conferir a base antes da integração.

## 7. Auditoria com evidências

Um achado informa arquivo/linha quando disponível, caminho de execução, condição que o aciona, impacto e recomendação. Diferenciar confirmado, provável e hipótese não reproduzida. Revisão estática, integração, teste visual e teste de segurança são evidências diferentes.

Sem código não há auditoria de implementação. Sem aplicação no navegador não há verificação empírica da UI. Não transformar ausência de evidência em alegação de vulnerabilidade ou em selo de qualidade.

## Fontes primárias

- [Google: revisão de código](https://google.github.io/eng-practices/review/reviewer/looking-for.html)
- [TigerStyle original](https://raw.githubusercontent.com/tigerbeetle/tigerbeetle/main/docs/TIGER_STYLE.md)
- [Playwright: boas práticas](https://playwright.dev/docs/best-practices)
- [Angular: segurança](https://angular.dev/best-practices/security)
- [PostgreSQL: constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [Lei de Direitos Autorais](https://www.planalto.gov.br/ccivil_03/leis/l9610.htm)

As práticas de engenharia são adaptações para este produto, não reprodução integral de um guia externo.
