# Melhoria de design: avaliação de referências e plano

Status: avaliação e plano para DS-1/DS-2/DS-3; paleta e página inicial em §5 (DS-4/HOME-1, 28/10/2026). Ver [WORKBOARD.md](WORKBOARD.md). Referência: 26/10/2026. A direção de produto continua em [UX-DESIGN-SPEC.md](UX-DESIGN-SPEC.md); este documento não a substitui.

## 1. Diagnóstico da interface atual

Leitura de `apps/web/src/styles.css` (1257 linhas) e do shell em `apps/web/src/main.ts`. Capturas de referência feitas em 26/10/2026 (390 e 1440 px) antes de DS-1.

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
2. Tipografia: escolher família sem serifa e monoespaçada por critério, não por imitação de um design system: legibilidade em enunciados longos e código, acentuação completa do português, pesos reais necessários, licença aberta verificada, arquivos auto-hospedados e fallback de sistema. Comparar 2–3 candidatas com enunciados reais antes de decidir. Definir papéis tipográficos de produto (corpo, enunciado, rótulo, metadado, código, título de seção), com peso e entrelinha por papel, em vez de títulos grandes. Escala de UI 13/14/16/18/20/24/32 em `rem`; corpo de 17 px no enunciado com entrelinha 1,6 e medida de 65–72 caracteres.
3. Tokens em `:root`: cores semânticas (superfície, texto, texto secundário, borda, ação, ação-hover, sucesso, erro, aviso, foco), espaçamento em base 4, raios (2 valores), sombra (1 valor), duração/curva de movimento. Substituir todas as cores soltas.
4. Contraste: conferir cada par texto/fundo e estado (≥ 4,5:1 texto, ≥ 3:1 bordas de controle e foco) e registrar a tabela no PR.
5. Hierarquia de ações: uma ação primária por região; secundárias e terciárias com peso visual menor; tamanhos de botão relacionados ao contexto, não um tamanho por tela.
6. Elevação com significado: superfície base, superfície elevada (menus, diálogos, painéis sobrepostos) e nada além disso. Sombra indica camada, não decoração; conteúdo de leitura fica sem sombra.
7. Carregamento: distinguir espera inicial da tela (estrutura reservada, sem salto de layout) de espera local (indicador no próprio controle, como "Salvando…"). Não usar skeleton em botão, menu ou diálogo.
8. Foco e alvo: conferir o indicador de foco em cada componente e fundo (área, contraste, não encoberto por elementos fixos) e a área efetiva de toque de cada controle, inclusive ícones; uma regra CSS global não comprova conformidade.
9. Ícones: um único conjunto, peso óptico compatível com o texto ao lado, ícone preenchido apenas para estado ativo/ênfase.
10. Shell: header compacto (56–64 px), navegação clara da seção atual, ação de conta acessível; no mobile, navegação compacta sem esconder o estudo.
11. Estados de botão e campo: hover, pressionado, desabilitado, carregando e foco como tokens, não `filter`.
12. Movimento: tokens de mola e duração da seção 4, com versão reduzida para `prefers-reduced-motion`.
13. Validação: E2E existentes passam; inspeção manual por teclado e em 320/390/768/1440 px; capturas depois comparadas com as de referência.

## 3.1 Padrões de interface gerada por IA que não usamos

Pedido de Gabriel em 26/10/2026. Lista de revisão para todo PR de interface; a pesquisa está nas fontes ao final. Os guias são opinião de design da comunidade, não estudo controlado.

| Padrão | Regra no projeto |
| --- | --- |
| Cartão arredondado com borda colorida de um lado (menu ativo, alerta, feedback) | Proibido. Estado ativo por peso, cor e marcador tipográfico; separação por espaço, mudança de fundo ou fio completo |
| Rótulo em caixa alta acima de todo título ("eyebrow" + H1 + subtítulo) | Só quando informa algo (ex.: "QUESTÃO OFICIAL · VERSÃO 2", "RESPOSTA SALVA"); nunca como slogan |
| Frases motivacionais no lugar de orientação | Proibido (UX-DESIGN-SPEC §3) |
| Gradiente roxo/azul, índigo padrão, glassmorphism, blobs | Proibido; acento único azul de caneta (OKLCH h 262, cobalto, não índigo), sempre chapado |
| Grade de cartões iguais, cartão dentro de cartão | Listas e linhas editoriais para conteúdo repetido |
| Emoji como ícone | Ícones SVG de traço único com `currentColor`, só quando têm função |
| Métricas e números inventados | Proibido; contagens sempre com numerador, denominador e período |
| Inter/Arial como fonte única | Figtree (interface) + Source Serif 4 (leitura) + JetBrains Mono (código e índices) |
| Acento usado em tudo | No máximo uma ação primária por região |
| Sombra em toda superfície | Sombra só para camada sobreposta (`--shadow-raised`) |

Escolhas próprias do produto (os ~20% de identidade): enunciado e explicação em serifa de leitura; navegação como índice numerado do caderno; marcador da alternativa que vira o próprio indicador de seleção; feedback como seção editorial abaixo de um fio, não como cartão.

## 4. Motion: molas e transições com padrão alto

Objetivo: movimento que explica o que mudou (seleção, salvamento, troca de tela, feedback) e dá sensação física e precisa, sem decorar nem atrasar o estudo. Pesquisa de 26/10/2026; confirmar versões na documentação no momento de implementar.

### Abordagem: plataforma primeiro, sem dependência nova

| Necessidade | Solução | Observação |
| --- | --- | --- |
| Curvas de mola | Função CSS `linear()` gerada a partir de uma mola (rigidez/amortecimento) e guardada como token. É uma curva amostrada no tempo, não um motor físico: não carrega velocidade quando interrompida | Suporte em Chrome/Edge 113, Firefox 112 e Safari 17.2 segundo a documentação do Chrome; fallback `cubic-bezier` para navegadores antigos |
| Entrada/saída de elementos | `animate.enter` / `animate.leave` do Angular com classes CSS | `@angular/animations` está obsoleto desde a v20.2; não adicioná-lo |
| Troca de tela (catálogo → questão → caderno) | View Transitions API de mesmo documento, com detecção de `document.startViewTransition` e atualização direta como fallback | Disponível em Chrome/Edge 111+, Safari 18+ e Firefox 144+ |
| Estado inicial de entrada | `@starting-style` + `transition` | Sem JavaScript |
| Mola interrompível com continuidade de velocidade (gesto de arrastar e soltar) | Somente se surgir caso real: avaliar `motion` (versão vanilla, MIT) com versão fixada | Exige justificativa no PR; hoje não há gesto que precise disso |

### Interrupção e reversão

Mudanças de estado que o usuário pode desfazer rapidamente (selecionar outra alternativa, abrir e fechar painel, alternar filtro) usam `transition`, não `@keyframes`: uma transição interrompida parte do valor atual e reverte com duração encurtada. Ela não preserva a velocidade, então molas com overshoot ficam restritas a movimentos curtos. `@keyframes` e `animate.enter`/`animate.leave` ficam para entrada e saída de elementos. Toda animação responde no mesmo quadro da ação e pode ser interrompida por uma nova ação.

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
- Desempenho: perfilar no painel Performance do DevTools; nenhuma animação pode disparar layout a cada quadro, e pintura deve ficar restrita à camada animada.
- Movimento reduzido testado por interação (seleção, feedback, navegação, saída de itens), não só pela presença do media query.
- Validação: gravação/inspeção em Chromium em 390 e 1440 px, teste com movimento reduzido e verificação de que os E2E não dependem de tempo de animação.

## 5. Plano de DS-2 — telas de estudo

- Catálogo: lista densa e legível (não grade de cards), filtros visíveis no desktop e em painel no mobile, estado de resposta salva por texto e ícone.
- Resolução: coluna de leitura controlada, metadados de origem discretos acima do enunciado, alternativas como rótulos de formulário amplos, feedback com hierarquia clara (resultado → explicação → autoria → próximo passo).
- Caderno de erros: fila por assunto com contagem honesta e ação de refazer explícita.
- Motion aplicado conforme a seção 4 (seleção, feedback, salvamento, navegação, saída de itens).
- Critério de saída: mesmas assertions de E2E, mais verificação manual de teclado e larguras; nenhuma informação de gabarito antes da confirmação.

## Referências de critério

Curadoria de 18 URLs primárias trazida por Gabriel em 26/10/2026. As referências orientam critérios, sem ditar a aparência. Segundo essa curadoria, algumas páginas da Apple e do Material exigiram JavaScript e foram consultadas pelo conteúdo indexado da própria fonte oficial; as notas completas ficam fora do repositório. As recomendações aplicadas aqui são interpretação de projeto.

| Referência | O que extrair | O que não copiar |
| --- | --- | --- |
| [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Agrupamento, alinhamento e adaptação | Medidas nativas como se fossem CSS |
| [Carbon — Typography](https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview) | Papéis produtivos, peso e entrelinha | Troca por IBM Plex ou títulos gigantes |
| [Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Proximidade e flexibilidade do espaço | Grid e breakpoints inteiros |
| [Fluent 2 — Elevation](https://fluent2.microsoft.design/elevation) | Camadas e sombras com significado | Mais sombras em todo conteúdo |
| [Linear — A calmer interface](https://linear.app/now/behind-the-latest-design-refresh) | Menor competição e ações previsíveis | Densidade, tema e iconografia próprios |
| [Fluent 2 — Iconography](https://fluent2.microsoft.design/iconography) | Peso óptico e uso de ênfase | Um conjunto novo de assets |
| [Carbon — Button](https://www.carbondesignsystem.com/building-blocks/core/components/button/guidelines) | Relação entre ações e tamanhos | Anatomia/posicionamento sem contexto |
| [Carbon — Data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) | Eixos, densidade e espaço de leitura | Tabela de engenharia em todo cadastro |
| [Carbon — Loading](https://www.carbondesignsystem.com/building-blocks/core/patterns/loading) | Distinguir espera inicial e local | Skeleton de modal, menu e botão |
| [W3C — Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) | Verificar indicação e contexto de foco | Supor conformidade por uma regra CSS |
| [W3C — Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Avaliar alvo efetivo e exceções | Confundir desenho do ícone com área |
| [Apple WWDC18 — Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/) | Resposta e possibilidade de interromper | Gestos nativos sem necessidade web |
| [Apple WWDC23 — Animate with springs](https://developer.apple.com/videos/play/wwdc2023/10158/) | Continuidade e acomodação | Preset físico como receita universal |
| [Material 3 — Motion physics](https://m3.material.io/styles/motion/overview/how-it-works) | Separar espaço de efeitos | Exuberância ou parâmetros de outra plataforma |
| [W3C — CSS Easing Level 2](https://www.w3.org/TR/css-easing-2/) | Entender a função amostrada | Confundir curva com motor dinâmico |
| [W3C — CSS Transitions](https://www.w3.org/TR/css-transitions-1/#starting) | Entender interrupção e reversão | Supor continuidade de velocidade garantida |
| [web.dev — Animation guide](https://web.dev/articles/animations-guide) | Perfilar layout, pintura e composição | Prometer animação sem custo |
| [W3C — Technique C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39) | Testar preferência reduzida por interação | Certificar todo o produto por um media query |

Separação espaço × efeito (Material): molas com acomodação para movimento espacial (posição, escala); curvas sem overshoot para efeitos (opacidade, cor).

## Fontes consultadas

- [open-design: anti-AI-slop rules](https://github.com/nexu-io/open-design/blob/main/craft/anti-ai-slop.md)
- [Impeccable: anti-patterns](https://mintlify.wiki/pbakaus/impeccable/concepts/anti-patterns) (lido pelo resumo da busca; o acesso direto foi bloqueado pela rede do ambiente)
- [Apple WWDC23 — Animate with springs](https://developer.apple.com/videos/play/wwdc2023/10158/) e [WWDC18 — Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/) (transcrições lidas)

- [Angular: migração de @angular/animations para CSS nativo](https://angular.dev/guide/animations/migration)
- [Chrome for Developers: função de easing `linear()`](https://developer.chrome.com/docs/css-ui/css-linear-easing-function)
- [Chrome for Developers: View Transitions em 2025](https://developer.chrome.com/blog/view-transitions-in-2025)
- [Motion: índice oficial](https://motion.dev/llms.txt)
- Repositórios da seção 2, lidos em clone local somente leitura.

## 5. Paleta "caderno" e página inicial (DS-4, HOME-1)

Pedido de Gabriel em 28/10/2026: melhoria geral do design e das cores e uma página inicial de alto nível com motion, tendo como referência o design do Portal FSA. O repositório do portal (organização Fábrica de Software Acadêmica IFSP-PEP) não é acessível a esta sessão; a referência lida foi o artefato "Portal FSA — redesenho" da conversa Portal-FSA de Gabriel (telas "Início · aluno", "Início · professora" e as abas de edição).

### O que veio do Portal FSA

- Fundo de papel `#f4f3ef` com painéis brancos de fio fino (`#e3e0d8`) e raio de 10 px; um acento escuro; cores de estado sempre com texto.
- Início orientado a tarefa: capa em cor profunda com data em mono, saudação, situação real e ação principal; faixa de tempo com os dias (lá) ou as semanas até a prova (aqui); "Para você resolver" em grupos por prioridade; coluna lateral com andamento em barras e a próxima data em bloco "29 NOV".
- Metadados em mono acima do título de cada cartão; listas em painel branco com fios entre as linhas.

Ficou de fora: Public Sans/IBM Plex Mono (o produto mantém Figtree, Source Serif 4 e JetBrains Mono, já auto-hospedadas) e o verde institucional do IFSP, que é marca do portal e não deste caderno.

### Paleta

A marca é um caderno. A paleta usa os objetos dele, cada um com uma única função:

| Papel | Token semântico | Valor | Uso |
| --- | --- | --- | --- |
| Papel | `--color-bg`, `--color-surface`, `--color-surface-sunken` | `#f4f3ef`, `#ffffff`, `#ecebe6` | Fundo, painéis, notas |
| Tinta | `--color-text`, `--color-text-muted` | `#151e2f` (15,0:1), `#505868` (6,4:1) | Texto |
| Caneta azul | `--color-accent` e variações | `#1649ae` (7,3:1; texto sobre ela 8,1:1) | Ação primária, seleção, links |
| Capa | `--color-cover`, `--color-on-cover`, `--color-on-cover-muted` | `#0f285a` / `#ffffff` (14,3:1), `#bccfef` (9,1:1) | Capa da página inicial; única superfície escura |
| Caneta de correção | `--color-success-*`, `--color-danger-*` | verde `#106c3e`, vermelho `#aa2a27` sobre fundos claros (≥ 5,8:1) | Só certo/errado e "para retomar", sempre com texto |
| Marca-texto | `--color-highlight` | `#f9e77b` | Destaque raro: sublinhado da contagem, seleção de texto, hover da ação na capa; nunca estado |
| Foco | `--color-focus` | `#c44c00` (4,3:1); marca-texto sobre a capa | Anel de foco distinto da seleção azul |

Valores calculados em OKLCH e convertidos para sRGB; contraste pela fórmula WCAG. Componentes usam apenas tokens semânticos; a troca de paleta não exigiu mudar componentes.

### Tipografia

Títulos de página (`h1`) na serifa de leitura (Source Serif 4 com eixo de tamanho óptico, `opsz.css`); interface em Figtree; índices, datas e metadados em JetBrains Mono. Contadores grandes (banco, caderno de erros) usam numerais da serifa.

### Página inicial

1. **Capa**: data, "Boa noite. Faltam 32 dias para o ENADE.", situação real ("Você respondeu 1 de 3 questões do banco · 1 para retomar no caderno de erros"), "Continuar estudando" e semanas até a prova (hoje e a semana da prova marcadas).
2. **Para você estudar**: "Para retomar" (erradas na última resposta, as mais antigas primeiro, até 3) e "Ainda não respondidas" (até 3); cada cartão com assunto e origem, título, situação e ação.
3. **Lateral**: "Seu andamento" (respondidas e acertos em barras, com frase), "A prova de 2026" (bloco 29 NOV, mapa das 46 questões, fonte Inep) e "De onde vêm as questões" com contagens do catálogo.
4. **Como o caderno funciona** (passos e demonstração animada) e **Em construção**.

Motion, com os tokens da seção 4 e desligado por `prefers-reduced-motion` (estado final imediato):

| Elemento | Movimento |
| --- | --- |
| Capa | Entra por mola (`--spring-gentle`); semanas em sequência, 60 ms entre elas |
| Contagem | Sublinhado de marca-texto corre sob "32 dias" (900 ms, `--ease-out`) |
| Cartões | Sobem em sequência quando os dados chegam |
| Barras e mapa | Barras crescem de zero; quadrados do mapa entram em sequência (`@starting-style`) |
| Demonstração | Hesita em B, escolhe D, confirma; visto e volta de caneta desenhados por `stroke-dashoffset` |
| Seções de baixo | Revelação ao rolar por `IntersectionObserver`, uma vez, sem loop |

Nenhuma métrica é inventada: contagens vêm do catálogo e das respostas salvas; o formato da prova vem de MASTER-SPEC §2 com link para o Inep.
