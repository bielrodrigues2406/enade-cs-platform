# Arquitetura e decisões tecnológicas

Status: direção arquitetural; implementação parcial com decisão de persistência na ADR 001 e limites descritos ao final. Referência: 22/10/2026.

## 1. Cada tecnologia resolve um problema diferente

| Tecnologia | Papel | Decisão inicial | Condição para revisar |
| --- | --- | --- | --- |
| Angular + TypeScript | Interface e navegação web | Adotar em versões estáveis compatíveis | Restrição concreta da equipe ou do produto |
| NestJS + REST/OpenAPI | API e regras de aplicação | Monólito modular | Necessidade demonstrada por novos consumidores ou limites operacionais |
| PostgreSQL | Persistência relacional, integridade, consultas | Adotar | Necessidade não atendida pelo modelo relacional |
| Prisma | Acesso tipado ao banco e migrations | Adotar após verificar versão estável compatível | Limitações medidas em consultas ou operação |
| GraphQL | API com seleção de campos pelo cliente | Não incluir inicialmente | Vários consumidores e consultas variáveis que justifiquem schema, resolvers e operação adicionais |
| pgvector | Extensão PostgreSQL para busca por similaridade vetorial | Opcional em incremento próprio | Busca semântica ou recuperação de conteúdo superar baseline de busca textual em avaliação real |
| Redis/BullMQ | Trabalhos demorados e recorrentes fora da requisição | Introduzir quando necessário | Importação e IA passarem a exigir jobs com retries e acompanhamento |
| Capacitor | Distribuição em aplicativos móveis | Futuro, não requisito da web | Decisão de distribuição e necessidade de capacidades nativas |

PostgreSQL, Prisma, GraphQL e pgvector não são alternativas entre si. PostgreSQL armazena os dados; Prisma ajuda o código TypeScript a acessá-los; GraphQL define uma forma de expor a API; pgvector estende o banco para trabalhar com vetores.

## 2. Estrutura proposta

Um repositório com apps/web, apps/api e packages/ apenas para contratos ou lógica efetivamente compartilhados. Não criar pacotes vazios. API organizada em módulos de identidade, catálogo editorial, estudo, simulados, revisões, desempenho e integração com IA, conforme forem implementados.

A primeira entrega deve atravessar frontend, API e banco. O catálogo de conteúdo não depende de IA. O fluxo de responder e salvar continua disponível quando o provedor de IA falhar.

Clientes acessam a API, nunca o PostgreSQL diretamente. A API deriva a identidade da sessão autenticada e autoriza cada recurso. Um identificador de usuário enviado pelo cliente não concede acesso a tentativas.

Fixar versões estáveis, verificar compatibilidade entre Node, Angular, Nest, Prisma e banco, e consultar a documentação da versão instalada. Revisar SQL de migrations antes de aplicar. A seleção de uma ferramenta não dispensa medir queries, índices e transações.

## 3. Modelagem e integridade

- SourceDocument: identidade, URL oficial, edição, área, hash, localização arquivada e metadados de procedência.
- Question: identidade lógica, origem explícita (OFFICIAL, AUTHOR_CREATED ou AI_GENERATED) e ponteiro para a versão publicada atual.
- QuestionVersion: conteúdo, alternativas com IDs estáveis, gabarito, critérios discursivos, estado editorial e autoria/revisão. Revisão e publicação pertencem à versão: v1 pode continuar publicada enquanto v2 está em revisão; o ponteiro só muda após aprovação. Versão usada em tentativa não é editada no lugar.
- QuestionSource: associação a documento, página e número original, permitindo rastrear reutilização sem duplicar cegamente conteúdo comum.
- Topic e QuestionTopic: taxonomia e mapeamento de conteúdo; classificação automática é sugestão até revisão.
- StudySession/Attempt: modo, usuário, estado, ordem e versões selecionadas, início e término. Não aceitar transições arbitrárias.
- AttemptAnswer: versão da questão, ID da alternativa ou texto discursivo, revisão da resposta e confirmação de persistência.
- ReviewItem: motivo, estado e próxima revisão. Não considerar repetição de uma questão como evidência equivalente a um item inédito.
- AuditEvent: alterações editoriais e ações administrativas relevantes, sem copiar indiscriminadamente dados pessoais.

Origem e revisão são dimensões separadas. Não representar origem com duas flags que possam produzir estados contraditórios. Constraints, chaves e transações protegem invariantes que não podem depender só da interface.

O servidor valida que o item/versão pertence à seleção da tentativa e que a alternativa pertence àquela versão. Há uma única resposta vigente por par tentativa/item, preservando histórico de revisões quando necessário. IDs válidos de outra questão ou versão não são aceitos por existirem no banco.

Resultados históricos preservam a versão aplicada. Correções de gabarito geram nova versão e, se houver reprocessamento, um evento explícito com resultados anteriores e revisados; não reescrever o passado silenciosamente.

## 4. API e estados

- Endpoints orientados ao domínio, contratos OpenAPI e validação no servidor; não expor entidades de persistência integralmente.
- DTOs próprios para catálogo, tentativa em andamento e revisão. No modo simulado, respostas antes da finalização não incluem gabarito nem explicações que o revelem.
- Finalização idempotente e atômica, inclusive em chamadas concorrentes. Retry não cria nova tentativa ou duplica métricas.
- Autosave usa identidade de operação ou revisão monotônica para impedir que uma gravação antiga sobrescreva uma nova. A UI só anuncia salvamento confirmado.
- Autosave, finalização e expiração compartilham controle atômico de estado: gravar somente com tentativa IN_PROGRESS e dentro do prazo aplicável, verificando condição junto à escrita. A finalização congela as respostas; uma gravação atrasada não modifica resultado finalizado. Definir a ordem de serialização para chamadas concorrentes e testá-la.
- Paginação e limites de entrada explícitos. Ordenação estável para não repetir ou omitir itens ao navegar.
- Prazo de simulado determinado pelo servidor; relógio visual deriva do deadline. Atualizar a página não reinicia o tempo. Adaptações e sessões sem tempo pertencem a modos explícitos.
- Erros esperados retornam respostas compreensíveis, status apropriados e possibilidade de recuperação. Entrada inválida não encerra o processo.

## 5. Busca: quando pgvector vale a pena

Primeiro implementar filtros por edição, assunto, origem, tipo e situação, com busca textual PostgreSQL. Isso atende consultas como "árvore AVL" e "normalização" sem serviço de embeddings.

Busca vetorial pode ajudar em consultas conceituais como "processos esperando recursos uns dos outros" para recuperar itens sobre deadlock, mesmo sem repetir exatamente os termos. O resultado é probabilístico e depende de embeddings, conteúdo e avaliação; não há garantia de entendimento correto.

Para acrescentá-la:

1. Criar um conjunto representativo de consultas e questões relevantes revisadas.
2. Comparar busca textual com busca vetorial ou híbrida em relevância, latência e custo.
3. Registrar modelo, versão, dimensão e hash do conteúdo de cada embedding. Mudanças no conteúdo ou modelo exigem reindexação apropriada.
4. Aplicar autorização e estados editoriais também à recuperação semântica. Conteúdo pendente não pode vazar pelo índice.
5. Para catálogo pequeno, começar com busca exata; usar índice aproximado apenas se escala e medição justificarem, avaliando recall e filtros.
6. Manter fallback textual e limites de custo. Embeddings não exigem uma chamada generativa para cada pesquisa, mas sua geração e atualização têm custo operacional.

pgvector não é um LLM, não gera embeddings sozinho, não torna um tutor correto e não comprova plágio. Limiar fixo de 85% não é um critério universal de duplicação.

## 6. Importação e IA

Começar com importação semiautomática de um lote diverso, preservando texto, código, tabelas e imagens e registrando revisão. Evoluir para jobs quando houver volume/recorrência; OCR só onde a extração nativa não for suficiente.

PDF, HTML, SVG, enunciados e saídas de IA são entradas não confiáveis. Preferir blocos estruturados e renderização segura. Não usar bypass de sanitização como solução para formatação perdida. Importação remota futura precisa de limites de arquivo, tempo, tipo e destinos permitidos.

Explicações revisadas podem ser reutilizadas por versão da questão. Tutor contextual deve registrar fontes, versão de prompt/modelo e limitações; contexto recuperado não garante factualidade. Geração de questões entra em fila editorial separada. Execução de código gerado, se implementada, exige isolamento e limites próprios e não ocorre no processo da API.

## Fontes primárias

- [GraphQL: introdução](https://graphql.org/learn/introduction/)
- [Prisma ORM](https://www.prisma.io/docs/orm)
- [PostgreSQL: busca textual](https://www.postgresql.org/docs/current/textsearch-intro.html)
- [pgvector: documentação oficial](https://github.com/pgvector/pgvector)
- [PostgreSQL: constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [Angular: segurança](https://angular.dev/best-practices/security)

As capacidades gerais foram consultadas em 22/10/2026. Comandos e APIs devem ser conferidos na versão fixada na implementação.

## Estado da implementação inicial

A base executável agora contém `apps/web` (Angular), `apps/api` (NestJS) e migrations SQL/PostgreSQL. A adoção de Prisma foi adiada pelas razões registradas na [ADR 001](ADR-001-initial-persistence.md). Existe catálogo/resolução com respostas persistidas e identidade anônima ou por conta. A [ADR 002](ADR-002-account-sessions.md) registra cadastro, sessões e limites de autenticação; a [ADR 003](ADR-003-editorial-versions.md) registra curadoria autoral e versões publicadas. A [ADR 004](ADR-004-official-sources.md) registra PDFs oficiais, conferência independente e procedência por versão. O armazenamento local de fontes exige persistência/backup próprio; não há extração automática nem lote oficial publicado. A [ADR 005](ADR-005-error-notebook.md) registra o caderno de erros e as contagens derivadas das respostas, por questão lógica. A [ADR 006](ADR-006-source-acquisition.md) registra aquisição por cópia/arquivo local e cadernos compartilhados; o inventário separa 27 arquivos obtidos dos 34 links recentes pendentes. A [ADR 008](ADR-008-deployment.md) registra o contêiner único de produção, a mesma origem para API e web, os cabeçalhos de segurança e a política de segredos mínimos. Plano de estudos, repetição espaçada e os demais módulos continuam propostos. Consulte o README para comandos e limites efetivamente verificados.
