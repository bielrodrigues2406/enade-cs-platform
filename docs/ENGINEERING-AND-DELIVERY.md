# Engenharia, propriedades e validação

Status: contrato de engenharia. Há base executável com testes de API/PostgreSQL e Chromium; os demais critérios permanecem requisitos para incrementos futuros. Referência: 22/10/2026.

## 1. Qualidade proporcional ao risco

Preferir módulos claros e fluxo direto. Uma abstração deve resolver duplicação ou variabilidade real; um padrão conhecido não é justificativa suficiente. Evitar interfaces de uma implementação sem necessidade, factories universais, múltiplos estados globais e dependências que um recurso pequeno não exige.

Revisar a solução por funcionalidade, correção, complexidade, segurança, operação e UX. Uma implementação longa não é evidência de robustez. Uma implementação curta não é evidência de simplicidade se oculta erros ou contratos.

O projeto usa princípios de TigerStyle — invariantes, limites, estados e falhas explícitas — adaptados a TypeScript e aplicações web. Não importar mecanicamente regras de alocação, quotas de assertions, zero dependências ou encerramento de processo para entradas inválidas.

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
