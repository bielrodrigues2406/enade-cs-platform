# Colaboração entre Claude Code e Codex

Status: protocolo operacional. Referência: 26/10/2026. Complementa AGENTS.md e a seção 6 de ENGINEERING-AND-DELIVERY.md; não substitui suas regras.

Dois agentes trabalham em paralelo no mesmo repositório. Este documento define quem faz o quê, como evitar conflitos e como uma entrega passa de um agente para outro. O quadro vivo de tarefas está em [WORKBOARD.md](WORKBOARD.md).

## 1. Papéis

| Papel | Responsável | Decide |
| --- | --- | --- |
| Produto e conteúdo | Gabriel (humano) | Escopo, prioridades, regras de produto, revisão editorial, concessão de curadoria, merge em main e deploy |
| Trilha Claude | Claude Code | Tarefas marcadas `Claude` no quadro |
| Trilha Codex | Codex | Tarefas marcadas `Codex` no quadro |
| Revisor cruzado | O outro agente | Revisa o PR antes do merge (seção 6) |

Nenhum agente transcreve questões oficiais, gabaritos ou comentários editoriais por conta própria. Conteúdo oficial exige fonte conferida e revisão humana (MASTER-SPEC §5, ADR-004).

## 2. Uma tarefa, uma branch, um dono

1. Pegue a próxima tarefa `pronta` da sua trilha no quadro. Não pegue tarefa da outra trilha sem registrar a transferência no quadro.
2. Antes de começar, atualize o quadro na main ou na sua branch: status `em andamento`, branch e data. Se o outro agente já marcou a tarefa, não a inicie.
3. Branch a partir de `origin/main` atualizada, com o prefixo da trilha:
   - Claude: `claude/<tipo>-<assunto>` (ou a branch designada pela sessão)
   - Codex: `codex/<tipo>-<assunto>`
4. Um PR por tarefa. Se a tarefa crescer, divida no quadro antes de dividir no código.
5. Não faça commit na branch do outro agente. Para sugerir mudança, comente no PR dele ou registre no quadro.

## 3. Ownership de arquivos e pontos de conflito

A divisão por domínio evita a maior parte dos conflitos. Cada tarefa do quadro lista os arquivos que pretende criar ou alterar. Os arquivos abaixo são compartilhados e seguem regras próprias:

| Arquivo / área | Regra |
| --- | --- |
| `migrations/NNN_*.sql` | O número é **reservado no quadro** (seção "Reservas de migration") antes do primeiro commit. Nunca editar migration já aplicada em main. Se a main ganhar uma migration com número maior que a sua antes do merge, renumere a sua antes de integrar (o runner aplica por ordem alfabética). |
| `apps/api/src/main.ts` | Só acrescentar o controller na lista do `@Module` e imports. Novas rotas ficam em arquivo próprio do domínio (`<dominio>.ts`), como `review.ts` e `sources.ts`. |
| `apps/web/src/main.ts` (shell, navegação, catálogo, resolução) | Alterações mínimas para registrar a nova tela/navegação. Nova tela = novo `<dominio>.component.ts`. Refatoração do shell só pela tarefa de design que o declara no quadro. |
| `apps/web/src/styles.css` | Durante a tarefa DS-1 (tokens), o dono é a trilha de design. Outras tarefas acrescentam blocos ao final do arquivo com comentário `/* <dominio> */` e usam apenas tokens existentes. |
| `README.md`, `docs/API.md`, `docs/ARCHITECTURE.md` | Cada PR atualiza apenas a seção do seu domínio. Contagens de testes do README são atualizadas por quem integra por último, depois de rodar as suítes. |
| `package.json`, `package-lock.json` | Nova dependência exige justificativa no PR (AGENTS.md). Em conflito no lockfile, regenerar com `npm install` sobre a main atualizada; nunca editar à mão. |
| `docs/WORKBOARD.md` | Ambos editam. Mudanças pequenas, linha a linha, sem reordenar a tabela inteira. |

## 4. Contratos antes de código paralelo

Quando uma tarefa de uma trilha depende de dados ou rotas da outra (por exemplo, desempenho por assunto consumindo resultados de simulado), o dono da dependência publica primeiro o contrato em `docs/API.md` (rota, payload, erros) em um PR pequeno, ou registra no quadro. O consumidor trabalha contra esse contrato. Não invente forma de dados do outro domínio.

## 5. Definição de pronto (por PR)

- Fluxo completo: banco, API e interface coerentes, com estados de carregamento, vazio, erro e sucesso.
- Validação executada e informada no PR com os comandos reais do README: `npm run build`, `npm test`, `npm run test:e2e` (em sequência, não simultâneos). Se o ambiente impediu algum, escrever qual e por quê; não declarar que passou.
- Mudança de UI verificada no navegador em 320/390/768/1440 px e por teclado.
- Documentação do domínio atualizada; mudança arquitetural registrada em ADR.
- Conventional Commits, commits coesos, template de PR preenchido.
- Quadro atualizado: status `em revisão`, link do PR.

## 6. Revisão cruzada e integração

1. O autor abre o PR e marca a tarefa como `em revisão` no quadro.
2. O outro agente revisa: correção, propriedades P01–P16 afetadas, segurança e escopo. Achados com arquivo/linha e evidência (ENGINEERING §7).
3. Gabriel decide o merge, ou autoriza explicitamente um agente a fazê-lo. Merge preserva os commits (sem squash, salvo pedido).
4. Depois do merge, quem integrou marca `entregue` com o hash e avisa no quadro se a outra trilha precisa atualizar a base.

Ordem de merge quando dois PRs estão prontos: primeiro o que tem migration de número menor; o segundo atualiza a base e roda as suítes de novo.

## 7. Passagem de bastão (handoff)

Quando um agente para no meio de uma tarefa (fim de sessão, bloqueio), registra no **Diário** do quadro:

- tarefa e branch;
- último commit enviado (`git push` feito);
- o que falta, em itens verificáveis;
- bloqueios e decisões pendentes para Gabriel.

Trabalho não enviado ao remoto não existe para o outro agente. Os ambientes são efêmeros: faça push antes de encerrar.

## 8. Ambiente

- Node 24.19.0 (`.node-version`), Docker Compose para PostgreSQL 17.6. Se o ambiente tiver outra versão de Node, registre a limitação no PR.
- Suítes API e E2E em sequência; dois agentes não devem compartilhar o mesmo banco local ao mesmo tempo.
- Cada agente usa seu próprio `.env`/volume; nunca commitar `.env`, `.local/` ou PDFs arquivados.
