# Instruções para colaboradores e agentes

## Trabalho paralelo (Claude Code × Codex)

Siga docs/COLLABORATION.md e mantenha docs/WORKBOARD.md atualizado: pegue apenas tarefas da sua trilha, reserve número de migration antes de criar, registre handoff no diário e faça push antes de encerrar a sessão.

Comece por docs/HANDOFF.md: estado atual, como testar, regras de design, mascote, pendências e melhorias.

Antes de trabalho de interface, leia .claude/skills/README.md e as skills de design listadas ali.

## Manutenção humana — requisito obrigatório

Pedido explícito de Gabriel em 30/10/2026: o projeto será disponibilizado à fábrica de software e deve ser compreensível e modificável por mantenedores humanos. **Claude Code e Codex devem aplicar esse requisito em cada entrega**, além de fazer a revisão integral de código prevista em CQ-2 antes da passagem institucional. Funcionar e passar nos testes não bastam para considerar o código pronto para essa passagem.

Organize módulos por responsabilidade, separe apresentação, regras e persistência, use nomes claros, funções pequenas e retornos tipados e previsíveis. Elimine redundâncias, funções que acumulam tarefas e fluxos difíceis de acompanhar. Reescreva trechos quando isso os tornar mais simples e legíveis, preservando o comportamento validado. Não adie problemas novos para a revisão final. Os critérios e o procedimento estão em [ENGINEERING-AND-DELIVERY §1.3](docs/ENGINEERING-AND-DELIVERY.md#13-manutenção-humana-e-passagem-à-fábrica-de-software).

## Antes de trabalhar

1. Leia README e os documentos relevantes em docs/. Confira o estado atual do código; o planejamento não comprova implementação.
2. Confira branch, status local, origem remota, mudanças recentes e PRs abertos. Preserve trabalho existente.
3. Trabalhe em uma branch por objetivo, criada a partir de uma base atualizada. Use worktree ou checkout isolado quando houver trabalho paralelo.
4. Para bibliotecas, confirme documentação da versão escolhida, estabilidade, licença e compatibilidade. Fixe versões e mantenha lockfile. Não instale versões de preview por acidente com latest.
5. As nove skills de docs/SKILLS-ASSESSMENT.md são candidatas avaliadas por descrição. Não declare que foram carregadas ou executadas sem ler seus arquivos reais.

## Implementação

- Entregue fluxos completos com contratos, estados e persistência coerentes. Identifique claramente fixtures, demonstrações e integrações reais.
- Preserve regras de domínio, origem e revisão editorial do conteúdo. Não invente questões oficiais, citações ou resultados de aprendizagem.
- Prefira soluções claras, módulos por domínio e dependências justificadas. Não crie frameworks internos, repositórios genéricos ou camadas vazias por antecipação.
- Separe apresentação e lógica: templates Angular em arquivos `.html` referenciados por `templateUrl`, estilos em `.css` e comportamento/estado em `.ts`. Não acrescente blocos de HTML ou CSS em strings TypeScript. Classes representam estados visuais; bindings de estilo ficam restritos a valores dinâmicos dos dados, com as regras no CSS. Veja ENGINEERING-AND-DELIVERY §1.1.
- Reutilize componentes e tokens. Adapte a composição de cada tela à tarefa; não replique a mesma grade de cards em todo o produto.
- Registre mudanças arquiteturais relevantes em docs/ARCHITECTURE.md ou ADR dedicado. Não altere regras de produto silenciosamente.
- Valide entradas nas fronteiras, autorização no servidor e integridade no banco. Conteúdo de PDF ou IA é não confiável.
- Não exponha segredos, dados pessoais nem credenciais em logs, fixtures, capturas ou commits.

## Validação e conclusão

- Execute os comandos documentados quando existirem; não invente comandos nem resultados.
- Testes devem cobrir riscos e comportamento. Use PostgreSQL real para contratos dependentes de constraints, transações e concorrência.
- Mudanças de interface exigem execução no navegador, estados relevantes, teclado e larguras desktop/mobile. Build e screenshot isolado não validam o fluxo completo.
- Se o ambiente impedir uma verificação, registre a limitação e não declare que ela passou.
- Antes de publicar trabalho, revise diff e mudanças remotas. Não sobrescreva commits concorrentes; atualize a base e resolva conflitos preservando a intenção de ambos.
- Use Conventional Commits com descrição curta no imperativo e escopo quando ajudar: feat, fix, refactor, test, docs ou chore.
- Divida incrementos maiores em alguns commits coesos por responsabilidade: banco/API com seus testes, interface com seus testes e documentação quando fizer sentido. Cada commit deve ser revisável e manter o projeto coerente; mudanças pequenas podem ficar em um commit.
- Use títulos objetivos de PR. Descreva a mudança em uma ou duas frases, informe a validação executada e inclua limitações somente quando relevantes. Siga o template do repositório.
- Quando a criação do PR e o merge já estiverem autorizados no contexto, conclua ambos após validar e revisar o diff. Confirme o HEAD revisado antes de integrar e preserve os commits no merge; use squash somente quando solicitado.
- Não faça force push, merge em main, deploy ou mudanças destrutivas sem autorização que cubra a ação.
