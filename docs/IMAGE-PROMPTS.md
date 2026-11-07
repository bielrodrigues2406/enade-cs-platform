# Imagens didáticas: o que gerar e como

Pedido de Gabriel em 06/11/2026: imagens que deixem as questões geradas, o núcleo e a Biblioteca mais didáticos. Gabriel gera no GPT Image e envia. O agente converte, liga ao conteúdo e escreve o texto alternativo.

## 1. Regra de escolha: SVG ou GPT Image

Modelo de imagem erra rótulos, números e ligações. Um grafo com o peso errado numa aresta muda o gabarito.

| Tipo de imagem | Ferramenta | Por quê |
| --- | --- | --- |
| Diagrama exato: grafo com pesos, árvore, circuito, autômato, pipeline, tabela, gráfico de dados, topologia de rede | **SVG feito pelo agente no código** | Fiel ao enunciado, legível no tema escuro, acessível e leve |
| Ilustração: charge sem falas, cena de situação, metáfora visual de um conceito, capa de área | **GPT Image** | Exatidão não muda a resposta, e a ilustração ajuda a lembrar |

Regras para toda ilustração:

1. **Sem texto na imagem.** Rótulos e legendas ficam no HTML, porque o modelo erra letras em português.
2. **Não entregar a resposta.** A imagem mostra a situação do enunciado, nunca o raciocínio.
3. **Selo e texto alternativo:** a tela mostra "Ilustração gerada por IA", e cada imagem leva `alt` escrito pelo agente.
4. **Sem pessoas reais, marcas ou logotipos.**
5. **Envio:**
   - PNG em 1536×1024 (paisagem) ou 1024×1024 (quadrada), como cada prompt indica;
   - nome do arquivo igual ao código do item, por exemplo `Q-FG-01.png`;
   - o agente converte para WebP e guarda em `apps/web/public/illustrations/`.

## 2. Estilo comum (colar no início de todo prompt)

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens.
```

## 3. Questões geradas

### Desenho exato em SVG (o agente faz, sem prompt)

| Questão | Imagem |
| --- | --- |
| `gen-alg-dijkstra-ordem` | Grafo com os pesos do enunciado |
| `gen-alg-abb-degenerada` | Árvore degenerada ao lado da balanceada |
| `gen-alg-heap-insercao` | Heap como vetor e como árvore |
| `gen-arq-mux-xor` | Multiplexador 4×1 com as entradas |
| `gen-arq-pipeline-conflitos` | Diagrama de ciclos do pipeline de 5 estágios |
| `gen-arq-localidade` | Matriz com a ordem de percurso por linha e por coluna |
| `gen-red-dominio-broadcast` | Topologia com hub, switch e roteador |
| `gen-tc-paridade-uns` | Autômato com os estados do enunciado |
| `gen-tc-subconjuntos` | AFN do enunciado |
| `gen-cg-ordem-transformacoes` | Quadrado antes e depois de cada ordem |
| `gen-cg-mediana` | Vizinhança 3×3 de pixels com o ruído |
| `gen-ihc-contraste-wcag` | Amostra real das duas cores |
| `gen-fg-pontos-percentuais` | Gráfico de barras dos dados ilustrativos |
| `gen-fg-envelhecimento` | Pirâmide etária de hoje e projetada |
| `gen-fg-concentracao-renda` | Barras da parte da renda de cada grupo |

### Ilustrações para gerar no GPT Image

**Q-FG-01. `gen-fg-desinformacao`** (1536×1024)
```
[estilo comum] Charge sem falas. Sala de estar simples. Uma pessoa idosa no sofá segura um celular na vertical; na tela, um político discursa, mas uma linha fina e irregular, como uma costura, atravessa o rosto dele, sugerindo montagem. Do celular saem várias setas curvas finas em azul de destaque indo para pequenos celulares espalhados pelo quadro, como um vídeo se espalhando. Expressão neutra, sem caricatura ofensiva. Nenhum balão de fala.
```

**Q-FG-02. `gen-fg-texto-mobilidade`** (1536×1024)
```
[estilo comum] Charge sem falas em dois quadros lado a lado. No primeiro, uma avenida larga recém-alargada com poucos carros e máquinas de obra indo embora. No segundo, a mesma avenida, mais tarde, completamente tomada por carros parados, e na calçada estreita um ponto de ônibus vazio. Ponto de vista elevado, mesma composição nos dois quadros para facilitar a comparação.
```

**Q-FG-03. `gen-fg-inclusao-deficiencia`** (1536×1024)
```
[estilo comum] Cena urbana calma. Uma pessoa em cadeira de rodas parada diante da entrada de um prédio público que só tem uma escadaria. Ao lado, em segundo plano, uma pessoa com bengala branca diante de uma calçada esburacada. A composição mostra que o obstáculo está no ambiente, não nas pessoas: as pessoas estão em postura digna e tranquila, os obstáculos em azul de destaque.
```

**Q-FG-04. `gen-fg-clima-mitigacao`** (1536×1024)
```
[estilo comum] Vista aérea de uma cidade amazônica à beira de um rio largo, com floresta ao fundo. À esquerda da imagem, uma área de floresta sendo replantada com mudas em fileiras; à direita, um bairro ribeirinho com casas sobre palafitas. Sem destacar nenhum dos dois lados mais que o outro. Céu limpo, luz suave.
```

**Q-FG-05. `gen-fg-redes-saude-mental`** (1024×1024)
```
[estilo comum] Charge sem falas. Mesa de jantar de uma família de quatro pessoas; cada pessoa olha para o próprio celular, e a luz azul de destaque das telas ilumina os rostos de baixo. A comida no centro da mesa está intocada. Tom reflexivo, sem exagero.
```

**Q-FG-06. `gen-fg-fome-producao`** (1536×1024)
```
[estilo comum] Duas cenas separadas por uma linha vertical fina. À esquerda, um porto com silos altos e um navio graneleiro carregado de grãos. À direita, a cozinha simples de uma casa com a geladeira aberta e quase vazia e uma panela pequena no fogão. Mesmo enquadramento e escala nas duas metades.
```

**Q-SEG-01. `gen-seg-aviso-certificado`** (1536×1024)
```
[estilo comum] Saguão de aeroporto com poltronas. Uma pessoa com notebook no colo olha a tela, onde aparece um grande ícone de cadeado aberto em azul de destaque. Ao fundo, discretamente, outra pessoa com um notebook e um pequeno roteador portátil sobre a mesa, ambiente comum, sem aparência de vilão de filme.
```

**Q-IA-01. `gen-ia-injecao-prompt`** (1536×1024)
```
[estilo comum] Metáfora visual. Um assistente representado por um pequeno robô de escritório, simpático e simples, lê uma carta numa mesa. Dentro da carta, escondido entre as linhas, há um pequeno bilhete dobrado em azul de destaque. Ao lado do robô, uma gaveta aberta com envelopes e uma chave, sugerindo acesso a coisas importantes.
```

**Q-SD-01. `gen-sd-pix-idempotencia`** (1024×1024)
```
[estilo comum] Mão segurando um celular cuja tela mostra apenas um círculo de carregamento. O polegar está prestes a tocar de novo no botão grande da tela. Ao redor do celular, duas moedas idênticas em azul de destaque saindo em direções diferentes, sugerindo pagamento em dobro.
```

## 4. Núcleo e Biblioteca

### Capas das áreas (série única, 1536×1024)

Para cada área, usar o prompt-base trocando o objeto central. Todas da mesma série visual.

```
[estilo comum] Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: {OBJETO}. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

| Código | Área | {OBJETO} |
| --- | --- | --- |
| CAPA-ALG | Algoritmos | uma pequena árvore de galhos binários feita de clipes e fio, com nós redondos |
| CAPA-MAT | Matemática | dois dados, um baralho em leque e um diagrama de Venn desenhado a lápis |
| CAPA-ARQ | Arquitetura | um chip de processador visto de cima, com trilhas que se espalham como ruas |
| CAPA-SO | Sistemas operacionais | um semáforo de trânsito de mesa ao lado de várias fichas de papel em fila |
| CAPA-ES | Engenharia de software | um quadro de cartões adesivos em três colunas, sem escrita |
| CAPA-TC | Teoria da computação | uma fita de papel longa com quadradinhos e uma pequena cabeça de leitura de metal |
| CAPA-RED | Redes | envelopes encaixados uns dentro dos outros, do maior para o menor |
| CAPA-IA | Inteligência artificial | uma rede de pinos ligados por fios em camadas, como um tear |
| CAPA-PROG | Programação | blocos de montar encaixados formando uma escada |
| CAPA-BD | Banco de dados | um fichário de gavetas com fichas e algumas fichas ligadas por barbante |
| CAPA-CG | Computação gráfica | um prisma de vidro decompondo um feixe de luz sobre uma grade de pixels |
| CAPA-COMP | Compiladores | um funil que recebe tiras de papel e solta peças de engrenagem |
| CAPA-SOC | Sociedade e ética | uma balança de pratos com um celular num prato e um pequeno livro no outro |
| CAPA-SD | Sistemas distribuídos | três relógios de mesa iguais marcando horas levemente diferentes |
| CAPA-IHC | IHC | uma mão tocando um grande botão redondo de um protótipo de papel |
| CAPA-SEG | Segurança | um cadeado aberto ao lado de uma chave e de um envelope lacrado com cera |
| CAPA-FG | Formação Geral | um jornal dobrado, um gráfico de barras recortado e um globo pequeno |

### Metáforas de conceito (ficha e página da área)

Cada uma acompanha a definição do conceito no núcleo. Tamanho 1024×1024.

**MET-01. Condição de corrida** (`so-regiao-critica`)
```
[estilo comum] Duas mãos, vindas de lados opostos, escrevendo ao mesmo tempo na mesma linha de um caderno, os traços se sobrepondo e embaralhando. Uma das mãos em azul de destaque.
```

**MET-02. Deadlock**
```
[estilo comum] Vista de cima de um cruzamento estreito: quatro carrinhos, cada um com o nariz bloqueando o caminho do seguinte, formando um ciclo fechado no centro. Nenhum consegue andar.
```

**MET-03. Pipeline**
```
[estilo comum] Lavanderia vista de lado com quatro estações em sequência: máquina de lavar, secadora, mesa de dobrar e prateleira. Quatro cestos de roupa, cada um numa estação diferente ao mesmo tempo, em diagonal, como uma escada.
```

**MET-04. Localidade e cache**
```
[estilo comum] Uma estante longa de biblioteca ao fundo e, em primeiro plano, uma mesa pequena com uma pilha de livros vizinhos retirados juntos da mesma prateleira. Uma lacuna na estante marca de onde saíram. Os livros da mesa em azul de destaque.
```

**MET-05. Tabela hash com encadeamento**
```
[estilo comum] Parede de caixas de correio numeradas apenas por formas geométricas simples (sem números). De algumas caixas pende uma corrente de envelopes presos uns aos outros, de comprimentos diferentes; a maioria das correntes é curta.
```

**MET-06. Heap**
```
[estilo comum] Pirâmide de caixas empilhadas em que cada caixa é um pouco maior que as duas logo abaixo dela; a maior está no topo, em azul de destaque.
```

**MET-07. Sobreajuste**
```
[estilo comum] Um alfaiate ajusta um terno perfeitamente a um manequim cheio de calombos e ângulos estranhos. Ao lado, três pessoas reais de corpos diferentes olham o terno com dúvida.
```

**MET-08. Precisão e revocação**
```
[estilo comum] Uma rede de pesca sendo puxada de um lago: dentro dela alguns peixes em azul de destaque e alguns objetos indesejados (bota, lata). Na água, fora da rede, alguns peixes azuis que escaparam.
```

**MET-09. Encapsulamento em camadas de rede**
```
[estilo comum] Uma carta sendo colocada dentro de um envelope, que vai dentro de outro maior, que vai dentro de uma caixa, em sequência da esquerda para a direita. A carta original em azul de destaque.
```

**MET-10. NAT e CGNAT**
```
[estilo comum] Um prédio de apartamentos com uma única caixa de correio na entrada e um porteiro distribuindo cartas para várias portas internas. Ao fundo, um prédio ainda maior que abriga vários prédios menores, com um único portão.
```

**MET-11. Partição na rede (CAP)**
```
[estilo comum] Duas agências bancárias, uma em cada margem de um rio, ligadas por uma ponte quebrada ao meio. Cada agência tem o próprio livro-razão aberto no balcão. Um caixa de cada lado olha para a ponte.
```

**MET-12. Idempotência**
```
[estilo comum] Um dedo apertando repetidamente o botão de chamar do elevador, com marcas de movimento; acima da porta, uma única luz acesa em azul de destaque, indicando que só uma chamada foi registrada.
```

**MET-13. Homem no meio**
```
[estilo comum] Duas pessoas trocando cartas por um tubo pneumático; no meio do tubo, uma terceira figura discreta abre um envelope, lê e o fecha de novo.
```

**MET-14. Redução entre problemas**
```
[estilo comum] Uma ferramenta adaptadora: um parafuso de formato estranho entra num adaptador que o transforma num parafuso comum, que então entra numa chave de fenda universal. Fluxo da esquerda para a direita.
```

**MET-15. Ataque à cadeia de dependências**
```
[estilo comum] Prateleira de supermercado com dezenas de caixas iguais; uma delas tem a embalagem quase idêntica, diferindo só por um detalhe na forma do rótulo, destacada em azul. Uma mão está prestes a pegá-la.
```

## 5. Novidades (modal e cartão)

O modal usa o Dudu articulado que já existe. A ilustração abaixo é opcional, para a página de novidades. Anexe ao GPT uma pose do Dudu (`design/mascot/`) como referência de personagem.

**NEWS-01. Dudu com novidade** (1536×1024, fundo transparente se possível)
```
Usando a imagem anexada como referência exata do personagem (mesmas cores, proporções, traço e rosto), desenhe o mesmo mascote segurando com as duas asas um caderno aberto do qual sai uma pequena folha nova destacada em azul (#1649ae), como quem mostra uma página recém-escrita. Expressão contente e calma. Estilo ilustração plana com traço de tinta azul-escuro (#151e2f), papel creme (#f4f3ef) ao fundo ou fundo transparente. Sem texto, letras, números, confete ou brilhos.
```

## 6. Ordem sugerida

1. Ilustrações de Formação Geral (Q-FG-01 a 06): a charge é comum na prova.
2. Metáforas MET-01 a MET-08, das áreas de maior peso.
3. Capas das áreas.
4. Restante.

Enquanto as imagens não chegam, o agente pode fazer os SVGs da seção 3. Ligar imagens ao conteúdo exige:
- um campo `image` nas questões geradas e nos conceitos do núcleo;
- o selo na tela;
- o carregamento sob demanda.
