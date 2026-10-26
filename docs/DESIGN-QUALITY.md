# Melhoria de design: avaliação de referências e plano

Status: avaliação e plano para DS-1/DS-2/DS-3 (ver [WORKBOARD.md](WORKBOARD.md)). Referência: 26/10/2026. A direção de produto continua em [UX-DESIGN-SPEC.md](UX-DESIGN-SPEC.md); este documento não a substitui.

## 1. Diagnóstico da interface atual

Leitura de `apps/web/src/styles.css` (1257 linhas) e do shell em `apps/web/src/main.ts`. A UI renderizada ainda não foi inspecionada nesta análise; a captura de referência é o primeiro passo de DS-1.

- Tipografia: `Arial, Helvetica` em tudo e `monospace` genérico para código. Não há escala tipográfica definida; tamanhos estão espalhados pelos seletores.
- Tokens: 8 variáveis de cor (`--paper`, `--ink`, `--primary`…), mas cerca de 10 cores hexadecimais soltas e nenhum token de espaçamento, raio, sombra, tamanho de fonte ou movimento.
- Shell: header fixo de 100 px com padding lateral de 48 px; ocupa muita altura em telas de estudo e no mobile.
- Interação: hover por `filter: brightness`, sem estados de pressionado/selecionado definidos como tokens. O foco visível existe (`--focus`) e deve ser preservado.
- Organização: um único CSS global com breakpoints repetidos por tela (1000/700/400 px).
- Sem tema escuro. Não é requisito de R1; tokens devem permitir acrescentá-lo depois.

A base está correta em acessibilidade de foco, alvo mínimo de 44 px e paleta sóbria. O problema é falta de sistema: a qualidade percebida depende de tipografia, ritmo e consistência, não de efeitos.

## 2. Repositórios sugeridos: o que serve para este projeto

O projeto usa Angular 22 com CSS próprio, sem Tailwind e sem React. A especificação de UX evita gradientes extensos, blobs, decoração sem função e métricas fictícias, e o produto não usa paywall, streak ou ranking (MASTER-SPEC §6). Os repositórios foram clonados em modo somente leitura para leitura de README, licença, dependências e, quando existiam, `SKILL.md`. Nenhum foi instalado, carregado como skill ou executado.

| Repositório | O que é | Licença | Decisão |
| --- | --- | --- | --- |
| madebymustafa/design-taste | 24 skills em Markdown (tipografia, cor, acessibilidade, design system, revisão, estilos como `editorial-minimal`) | MIT | **Usar como guia** em DS-1/DS-2: `taste-typography`, `taste-color`, `taste-design-system`, `taste-accessibility`, `taste-design-review`, `taste-ux-copy`, `editorial-minimal`. Independe de framework. Regras de landing page e GSAP não se aplicam à área de estudo. |
| marvkr/better-design | Skill que delega toda a orientação a um MCP externo | MIT | Não adotar agora: sem o MCP conectado a skill não entrega conteúdo; conectar serviço externo exige decisão. |
| superdesigndev/superdesign | Extensão de IDE descontinuada; produto virou app web | AGPLv3 | Não adotar. |
| heliocosta-dev/revenue-centric-design | Princípios de design para conversão e monetização de SaaS | Fonte disponível com restrições de uso | Não adotar: o objetivo do produto é aprendizagem, não conversão; conflita com MASTER-SPEC §6. |
| DavidHDev/canvas-ui | Efeitos em canvas/WebGL (fluidos, shaders, 3D) | MIT + Commons Clause | Não adotar: decorativo, pesado e com restrição comercial. |
| paper-design/shaders | Shaders de gradiente/ruído (há pacote vanilla) | Apache-2.0 | Não adotar na área de estudo (gradientes decorativos). Reavaliar só para uma página pública, se houver. |
| ibelick/motion-primitives, ui-layouts/ui-layouts | Componentes de animação/layout | MIT | Não adotar: React + Tailwind + framer-motion. Ideias de movimento podem ser reproduzidas com CSS e `prefers-reduced-motion`. |
| ui-layouts/cursify | Cursores customizados | — | Não adotar: prejudica leitura e acessibilidade em uma ferramenta de estudo. |
| akaieuan/trickle, Hyperiux-Immersive/Hyperiux | — | — | Não avaliados: o clone falhou (repositório privado ou inexistente). |

A lista de ferramentas de agentes (Orca, Context Mode, XERJ, plugins oficiais, skills de Matt Pocock, Claude Code MCP, guia) atua no ambiente de cada agente, não no código do produto. Não entra como dependência do repositório. A coordenação entre Claude e Codex usa [COLLABORATION.md](COLLABORATION.md).

Se D3 for aprovada, copiar as skills escolhidas de design-taste para `.claude/skills/` (Claude) e para o diretório de skills do Codex, mantendo o arquivo de licença MIT e a origem, em um PR próprio.

## 3. Plano de DS-1 — fundação visual

Resultado: um sistema de tokens que todas as telas usam, sem mudar fluxos nem textos de produto.

1. Capturar referência antes da mudança: catálogo, resolução (antes/depois de responder), caderno, conta e curadoria em 390 e 1440 px.
2. Tipografia: família sem serifa de licença aberta, auto-hospedada, com fallback de sistema; monoespaçada própria para código. Proposta: IBM Plex Sans + IBM Plex Mono (SIL OFL), a confirmar licença e arquivos na versão fixada. Escala de UI 13/14/16/18/20/24/32 em `rem`; corpo de 17 px no enunciado com entrelinha 1,6 e medida de 65–72 caracteres.
3. Tokens em `:root`: cores semânticas (superfície, texto, texto secundário, borda, ação, ação-hover, sucesso, erro, aviso, foco), espaçamento em base 4, raios (2 valores), sombra (1 valor), duração/curva de movimento. Substituir todas as cores soltas.
4. Contraste: conferir cada par texto/fundo e estado (≥ 4,5:1 texto, ≥ 3:1 bordas de controle e foco) e registrar a tabela no PR.
5. Shell: header compacto (56–64 px), navegação clara da seção atual, ação de conta acessível; no mobile, navegação compacta sem esconder o estudo.
6. Estados de botão e campo: hover, pressionado, desabilitado, carregando e foco como tokens, não `filter`.
7. Movimento: tokens de mola e duração da seção 4, com versão reduzida para `prefers-reduced-motion`.
8. Validação: E2E existentes passam; inspeção manual por teclado e em 320/390/768/1440 px; capturas depois comparadas com as de referência.

## 4. Motion: molas e transições com padrão alto

Objetivo: movimento que explica o que mudou (seleção, salvamento, troca de tela, feedback) e dá sensação física e precisa, sem decorar nem atrasar o estudo. Pesquisa de 26/10/2026; confirmar versões na documentação no momento de implementar.

### Abordagem: plataforma primeiro, sem dependência nova

| Necessidade | Solução | Observação |
| --- | --- | --- |
| Curvas de mola | Função CSS `linear()` gerada a partir de uma mola (rigidez/amortecimento) e guardada como token | Suporte em Chrome/Edge 113, Firefox 112 e Safari 17.2 segundo a documentação do Chrome; fallback `cubic-bezier` para navegadores antigos |
| Entrada/saída de elementos | `animate.enter` / `animate.leave` do Angular com classes CSS | `@angular/animations` está obsoleto desde a v20.2; não adicioná-lo |
| Troca de tela (catálogo → questão → caderno) | View Transitions API de mesmo documento, com detecção de `document.startViewTransition` e atualização direta como fallback | Disponível em Chrome/Edge 111+, Safari 18+ e Firefox 144+ |
| Estado inicial de entrada | `@starting-style` + `transition` | Sem JavaScript |
| Mola interrompível guiada por gesto (arrastar, soltar) | Somente se surgir caso real: avaliar `motion` (versão vanilla, MIT) com versão fixada | Exige justificativa no PR; hoje não há gesto que precise disso |

### Tokens propostos (DS-1)

- `--ease-spring-snappy`: mola rígida, quase sem overshoot, para seleção de alternativa, botões e toggles (~250 ms).
- `--ease-spring-gentle`: mola suave com overshoot mínimo (≤ 2%), para painéis e revelação de feedback (~400 ms).
- `--ease-out`: desaceleração padrão para opacidade e cor (~150–200 ms).
- `--duration-fast` / `--duration-base` / `--duration-slow`: 150 / 250 / 400 ms.

Os valores exatos são ajustados olhando a tela, e cada token documenta a mola de origem.

### Onde aplicar

- Alternativa: marcação com mola rápida (escala 0,98 → 1 no pressionar, preenchimento do radio), sem mover o texto.
- Confirmar resposta: feedback entra com `--ease-spring-gentle` (translateY curto + opacidade); a cor do resultado vem com texto e ícone, nunca apenas animação.
- Salvamento: indicador "Salvando… → Salvo" com transição curta. A animação nunca anuncia sucesso antes da confirmação do servidor (P12).
- Navegação: indicador da seção atual desliza entre itens; troca de tela com View Transition curta (crossfade + deslocamento leve).
- Caderno de erros: item resolvido sai com `animate.leave` e a lista se reorganiza sem salto.
- Simulado: tempo restante sem animação contínua; apenas mudança de estado ao entrar nos últimos minutos.

### Regras

- Animar só `transform` e `opacity` (e cor quando necessário); nada de animar `height`/`top` em listas.
- Nenhum movimento em loop, parallax, cursor customizado ou efeito de fundo na área de estudo.
- `prefers-reduced-motion: reduce` troca molas por transições de opacidade de até 100 ms ou nenhuma.
- Interação continua disponível durante a animação; nenhum clique espera a animação terminar.
- Validação: gravação/inspeção em Chromium em 390 e 1440 px, teste com movimento reduzido e verificação de que os E2E não dependem de tempo de animação.

## 5. Plano de DS-2 — telas de estudo

- Catálogo: lista densa e legível (não grade de cards), filtros visíveis no desktop e em painel no mobile, estado de resposta salva por texto e ícone.
- Resolução: coluna de leitura controlada, metadados de origem discretos acima do enunciado, alternativas como rótulos de formulário amplos, feedback com hierarquia clara (resultado → explicação → autoria → próximo passo).
- Caderno de erros: fila por assunto com contagem honesta e ação de refazer explícita.
- Motion aplicado conforme a seção 4 (seleção, feedback, salvamento, navegação, saída de itens).
- Critério de saída: mesmas assertions de E2E, mais verificação manual de teclado e larguras; nenhuma informação de gabarito antes da confirmação.

## Fontes consultadas

- [Angular: migração de @angular/animations para CSS nativo](https://angular.dev/guide/animations/migration)
- [Chrome for Developers: função de easing `linear()`](https://developer.chrome.com/docs/css-ui/css-linear-easing-function)
- [Chrome for Developers: View Transitions em 2025](https://developer.chrome.com/blog/view-transitions-in-2025)
- [Motion: índice oficial](https://motion.dev/llms.txt)
- Repositórios da seção 2, lidos em clone local somente leitura.
