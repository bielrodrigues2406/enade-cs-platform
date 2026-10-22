# Direção visual e experiência de uso

Status: direção e critérios de aceitação. Catálogo e resolução da base demonstrativa foram implementados e exercitados em Chromium; demais telas permanecem propostas. Referência: 22/10/2026.

## 1. Intenção e identidade

Uma ferramenta de estudo de Computação com clareza editorial, leitura confortável, precisão e personalidade discreta. A qualidade deve aparecer no conteúdo, na composição e no comportamento. A interface deve servir a sessões prolongadas e questões tecnicamente densas.

"Não parecer feita por IA" é uma preferência de produto, não um teste técnico universal. Traduzir essa intenção em decisões observáveis: hierarquia própria por tarefa, dados reais, microcopy específica, poucos elementos decorativos, estados completos e revisão visual. Não medir qualidade apenas pelo número de cards, gradientes ou bibliotecas usados.

## 2. Direção inicial de linguagem visual

- Superfícies claras e neutras para leitura, texto de alto contraste e uma cor principal de ação em azul profundo/petróleo. Tema escuro pode ser acrescentado com tokens próprios e validação equivalente; não apenas inverter cores.
- Tipografia sem serifa de boa legibilidade para navegação e conteúdo; monoespaçada para código e dados que exijam alinhamento. Escolher famílias e pesos com licença e arquivos verificados antes de distribuir. O sistema deve funcionar com fallback local.
- Corpo inicial de 16–18 px, entrelinha aproximadamente 1,55–1,75 e largura de leitura de cerca de 60–75 caracteres. São pontos de partida ajustáveis após teste com enunciados reais.
- Hierarquia tipográfica curta e consistente. Títulos informativos; metadados de ano, área e origem subordinados ao conteúdo principal.
- Espaçamento e alinhamento formam a organização antes de bordas e sombras. Raios, espessuras e elevações seguem tokens, sem inventar uma variante em cada tela.
- Cor comunica ação e estado. Acerto, erro, revisão e indisponibilidade também usam texto/ícone, sem depender exclusivamente de cor.
- Ícones têm função concreta; botões somente com ícone possuem nome acessível. Não usar ícone em todo título por decoração.

Tokens de cor, contraste, tamanho, espaçamento, borda, foco e movimento devem ser definidos na implementação e conferidos em suas combinações reais. Valores iniciais não equivalem a contraste validado.

## 3. Evitar padrões genéricos sem proibir padrões úteis

Não repetir automaticamente: hero promocional dentro da área de estudo; quatro KPIs acima de toda tela; cards com barra lateral colorida sem significado; ícones de brilho para toda função; gradientes extensos; fundos com blobs; sombras em todas as superfícies; títulos vagos; textos motivacionais que ocupem o lugar de orientação; gráfico sem pergunta analítica; contadores e percentuais fictícios.

Cards são permitidos quando agrupam conteúdo relacionado ou uma escolha real. Para informação repetitiva, considerar lista, tabela, linha editorial ou seções com divisores. Consistência se aplica a componentes e interação; composição responde à tarefa. Não criar layouts distintos apenas para parecer original.

Não tornar um card inteiro clicável quando isso conflitar com links, botões ou seleção internos. Preferir destinos e ações explícitos. Componentes de alternativas devem preservar semântica de formulário, mesmo quando visualmente personalizados.

## 4. Composição por tela

| Tela | Hierarquia e composição | Atenções |
| --- | --- | --- |
| Início | Retomar sessão, próxima ação e resumo curto do estudo | Sem mural de métricas ou saudação que empurre o estudo para baixo |
| Banco | Busca, filtros, contagem e lista de itens | Filtros na URL quando apropriado, limpar filtros, vazio distinto de falha |
| Resolução | Fonte discreta, enunciado, mídias, alternativas, ação e feedback | Foco na leitura; painel secundário recolhível; nenhuma pista de gabarito antecipada |
| Caderno de erros | Fila por assunto/revisão e motivo da inclusão | Ação de revisar clara; evitar transformar cada erro em card grande |
| Plano | Sequência/agenda de sessões e prioridades explicadas | Editável, viável e com reagendamento sem punição visual |
| Simulado | Enunciado, navegação entre questões, marcação e tempo | Contraste do timer, revisão antes de finalizar, persistência e adaptações |
| Resultado | Resumo, evidências e revisão das respostas | Distinguir nota de treino, percentual e nota oficial; sem precisão inventada |
| Desempenho | Cobertura por assunto, amostra e tendências | Tabela acessível; gráficos só se melhorarem a interpretação |
| Guia | Conteúdo editorial com exemplos e prática associada | Boa leitura, referências e origem; evitar scroll infinito de cards |
| Curadoria | Tabela/fila e editor com fonte para conferência | Status, conflitos de edição, histórico e confirmação de publicação |

No mobile, adaptar a hierarquia: filtros em painel acessível, navegação compacta e ações próximas ao conteúdo. Não reduzir a versão desktop inteira até caber. Em telas amplas, área secundária pode conter navegação da sessão ou notas; não preencher espaço com widgets sem necessidade.

## 5. Resolução como primeira referência de qualidade

1. Mostrar enunciado com largura controlada, parágrafos, listas, fórmulas e código preservados.
2. Usar radio inputs e labels, ou semântica equivalente completamente testada. Alternativa longa é um caso normal, não uma exceção de layout.
3. Separar seleção, envio e correção. O modo de estudo define quando revelar feedback.
4. Manter ID da alternativa independente da letra/ordem exibida. Seleção por teclado e toque tem o mesmo resultado.
5. Após responder, explicar raciocínio e alternativas, identificar fonte/autoria da explicação e oferecer próximo passo.
6. Anunciar sucesso ou falha de persistência com linguagem humana. Não afirmar "salvo" antes da confirmação.
7. Código largo, tabela e diagrama podem usar rolagem local ou ampliação quando precisarem de duas dimensões. Nunca causar overflow da página inteira.
8. Imagens essenciais têm descrição apropriada sem revelar a resposta; descrição técnica deve ser revisada. Ampliação tem foco, fechamento por teclado e retorno ao elemento de origem.

## 6. Estados obrigatórios

Documentar e exercitar os estados relevantes de cada componente/fluxo: inicial, hover, foco, pressionado, selecionado, inválido, indisponível, carregando, vazio, sem resultado, erro recuperável, sucesso e conteúdo parcial.

Cenários de aceitação: enunciado de várias páginas; alternativas com parágrafos; código largo; fórmula; tabela; diagrama; imagem ausente; rede lenta; falha ao salvar; retry; reload; envio duplicado; sessão expirada; retorno a tentativa; ausência de conteúdo revisado.

Skeleton não deve ser usado em todo bloco sem necessidade; reservar dimensões quando útil e evitar deslocamento de conteúdo. Erro informa o que aconteceu, se a resposta está preservada e qual ação é possível. Ações essenciais nunca ficam como botões decorativos sem comportamento.

## 7. Acessibilidade e responsividade

Meta: WCAG 2.2 AA, validada por critérios aplicáveis. Testes automatizados são apoio e não certificação completa.

- Teclado completo, foco visível e ordem coerente; cabeçalho/rodapé fixo não deve ocultar controles focados.
- Reflow a 320 CSS px e cenário equivalente de zoom 400%, sem perda de informação/ação e sem scroll horizontal global. Exceções locais para conteúdo genuinamente bidimensional.
- Contraste mínimo aplicável: 4,5:1 para texto comum, 3:1 para texto grande e critérios de contraste não textual para controles e estados relevantes.
- Alvos principais com meta de produto de pelo menos 44 × 44 CSS px. O critério WCAG 2.5.8 AA exige 24 × 24 ou atende exceções de espaçamento/outros casos; não confundir a meta do produto com esse mínimo.
- Labels, instruções e erros associados aos campos; avisos dinâmicos anunciados sem interromper indevidamente a leitura.
- Gráficos acompanhados de resumo e dados acessíveis. Amostra pequena e dados ausentes são estados informativos, não zero por padrão.
- Cronômetro possui atualização acessível sem anunciar cada segundo. Oferecer prática sem tempo e adaptações de tempo como modos declarados; revisar critérios de limite temporal aplicáveis.

Testar ao menos 320, 390, 768 e 1440 CSS px, com conteúdo realista e medidas adicionais conforme problemas encontrados. Os pontos não substituem reflow contínuo. Cobrir Chromium e outros navegadores conforme público e risco, incluindo WebKit para fluxos móveis relevantes.

## 8. Movimento e linguagem

Movimento comunica feedback e continuidade: seleção, abertura de painel e transição de estado. Durações curtas são pontos de partida, não licença para animar cada superfície. Evitar contadores rolando, cards flutuando, confete recorrente, parallax e sequências de entrada que atrasem leitura.

Respeitar prefers-reduced-motion, reduzindo ou substituindo movimento sem remover funcionalidade. Uma arquitetura seek(t) é reservada a simulações didáticas ou produção audiovisual que precisem de reprodução determinística; não é requisito para hover, modal ou lista.

Microcopy específica: "Continuar sessão", "Revisar 6 questões", "Não foi possível confirmar o salvamento. Tentar novamente". Evitar slogans genéricos, urgência artificial e culpa por não estudar. Quando o conteúdo vier de IA, informar isso no contexto em que ajuda o usuário a avaliar a resposta.

## 9. Critério de conclusão visual

Uma tela só está concluída após comparar sua composição com a tarefa, conferir conteúdo adversarial, exercitar estados e navegação e inspecionar capturas desktop/mobile da versão executada. Uma captura bonita com dados fixos é uma referência visual, não prova de persistência ou integração.

Revisar lado a lado banco, resolução, revisões e desempenho: componentes consistentes, layouts adequados a cada tarefa e ausência de decoração automática. Registrar problemas e correções; "parece profissional" sozinho não é critério de aceitação.

## Fontes e alcance

- [GOV.UK: question pages](https://design-system.service.gov.uk/patterns/question-pages/) — foco e títulos específicos; adaptação para estudo é decisão deste produto.
- [IBM Carbon: tiles](https://www.carbondesignsystem.com/building-blocks/core/components/tile/guidelines) — agrupamento, variantes e interação; não constitui proibição de cards.
- [W3C: reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [W3C: target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [W3C: foco não obscurecido](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [MDN: movimento reduzido](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)

Fontes consultadas em 22/10/2026. As decisões estéticas são nossas propostas; as referências não prometem um detector universal de interface feita por IA.
