# Imagens para gerar (pedido a Gabriel, 07/11/2026)

Lista completa do que gerar no GPT Image, em ordem de prioridade. Cada prompt já está pronto para colar, com o estilo incluído. Contexto e regras em [IMAGE-PROMPTS.md](IMAGE-PROMPTS.md).

## Como enviar

- **Formato:** PNG no tamanho indicado em cada item.
- **Nome do arquivo:** o código do item (por exemplo, `MAS-FORCA.png`).
- **Fundo transparente** nas poses do Dudu. Se o GPT não fizer, pode ser fundo de uma cor só, bem diferente do amarelo (magenta puro, `#ff00ff`); eu recorto.
- **Antes de mandar, conferir:**
  - imagem sem texto, letras ou números;
  - Dudu igual ao atual: mesmas cores, rosto e lápis atrás da cabeça.
- **Pode mandar aos poucos.** Eu converto, ligo ao conteúdo e escrevo o texto alternativo.
- **Diagramas exatos não estão aqui:** grafos, circuitos, autômatos e gráficos com números eu faço em código.

## 1. Dudu (anexar uma pose atual como referência)

Anexe ao GPT a pose `apps/web/public/mascot/contente.webp` ou `acenando.webp`, ou a folha `design/mascot/poses-sheet.jpg`. Sem referência, ele desenha outro pato.

### NEWS-01. Dudu com novidade

Tamanho: 1536×1024. Arquivo: `NEWS-01.png`.

```
Usando a imagem anexada como referência exata do personagem (mesmas cores, proporções, traço e rosto), desenhe o mesmo mascote segurando com as duas asas um caderno aberto do qual sai uma pequena folha nova destacada em azul (#1649ae), como quem mostra uma página recém-escrita. Expressão contente e calma. Mesmo estilo de renderização, iluminação e proporções da referência (não transformar em desenho plano). Fundo transparente. Sem texto, letras, números, confete ou brilhos.
```

### MAS-PLANO. Dudu com o plano até a prova

Tamanho: 1024×1536. Arquivo: `MAS-PLANO.png`.

```
Usando a imagem anexada como referência exata do personagem, desenhe o mesmo mascote em pé, de frente, segurando com uma asa um calendário de mesa pequeno com alguns dias marcados por traços azuis (#1649ae), sem números nem letras, e com a outra asa apontando para ele. Expressão confiante. Mesmo estilo, iluminação e proporções da referência. Fundo transparente. Sem texto.
```

### MAS-FORCA. Dudu dando força

Tamanho: 1024×1536. Arquivo: `MAS-FORCA.png`.

```
Usando a imagem anexada como referência exata do personagem, desenhe o mesmo mascote em pé, de frente, com uma asa erguida no gesto de "joinha" e um sorriso acolhedor, transmitindo "vamos de novo". Mesmo estilo, iluminação e proporções da referência. Fundo transparente. Sem texto.
```

### MAS-ORIGINAL. Folha original das poses em alta resolução (não é prompt)

A folha com fundo magenta que está no repositório é uma captura de tela (cerca de 110 px por pose), baixa demais para recortar as poses com acessórios (lupa, relógio, medalha, cartões…). Se você ainda tiver o arquivo original gerado no Gemini, em tamanho cheio, mande. Assim as poses ficam nítidas também em telas grandes.

## 2. Formação Geral (charges e cenas sem falas)

### Q-FG-01. gen-fg-desinformacao

Tamanho: 1536×1024. Arquivo: `Q-FG-01.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Charge sem falas. Sala de estar simples. Uma pessoa idosa no sofá segura um celular na vertical; na tela, um político discursa, mas uma linha fina e irregular, como uma costura, atravessa o rosto dele, sugerindo montagem. Do celular saem várias setas curvas finas em azul de destaque indo para pequenos celulares espalhados pelo quadro, como um vídeo se espalhando. Expressão neutra, sem caricatura ofensiva. Nenhum balão de fala.
```

### Q-FG-02. gen-fg-texto-mobilidade

Tamanho: 1536×1024. Arquivo: `Q-FG-02.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Charge sem falas em dois quadros lado a lado. No primeiro, uma avenida larga recém-alargada com poucos carros e máquinas de obra indo embora. No segundo, a mesma avenida, mais tarde, completamente tomada por carros parados, e na calçada estreita um ponto de ônibus vazio. Ponto de vista elevado, mesma composição nos dois quadros para facilitar a comparação.
```

### Q-FG-03. gen-fg-inclusao-deficiencia

Tamanho: 1536×1024. Arquivo: `Q-FG-03.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Cena urbana calma. Uma pessoa em cadeira de rodas parada diante da entrada de um prédio público que só tem uma escadaria. Ao lado, em segundo plano, uma pessoa com bengala branca diante de uma calçada esburacada. A composição mostra que o obstáculo está no ambiente, não nas pessoas: as pessoas estão em postura digna e tranquila, os obstáculos em azul de destaque.
```

### Q-FG-04. gen-fg-clima-mitigacao

Tamanho: 1536×1024. Arquivo: `Q-FG-04.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Vista aérea de uma cidade amazônica à beira de um rio largo, com floresta ao fundo. À esquerda da imagem, uma área de floresta sendo replantada com mudas em fileiras; à direita, um bairro ribeirinho com casas sobre palafitas. Sem destacar nenhum dos dois lados mais que o outro. Céu limpo, luz suave.
```

### Q-FG-05. gen-fg-redes-saude-mental

Tamanho: 1024×1024. Arquivo: `Q-FG-05.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Charge sem falas. Mesa de jantar de uma família de quatro pessoas; cada pessoa olha para o próprio celular, e a luz azul de destaque das telas ilumina os rostos de baixo. A comida no centro da mesa está intocada. Tom reflexivo, sem exagero.
```

### Q-FG-06. gen-fg-fome-producao

Tamanho: 1536×1024. Arquivo: `Q-FG-06.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Duas cenas separadas por uma linha vertical fina. À esquerda, um porto com silos altos e um navio graneleiro carregado de grãos. À direita, a cozinha simples de uma casa com a geladeira aberta e quase vazia e uma panela pequena no fogão. Mesmo enquadramento e escala nas duas metades.
```

## 3. Cenas de questões específicas

### Q-SEG-01. gen-seg-aviso-certificado

Tamanho: 1536×1024. Arquivo: `Q-SEG-01.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Saguão de aeroporto com poltronas. Uma pessoa com notebook no colo olha a tela, onde aparece um grande ícone de cadeado aberto em azul de destaque. Ao fundo, discretamente, outra pessoa com um notebook e um pequeno roteador portátil sobre a mesa, ambiente comum, sem aparência de vilão de filme.
```

### Q-IA-01. gen-ia-injecao-prompt

Tamanho: 1536×1024. Arquivo: `Q-IA-01.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Metáfora visual. Um assistente representado por um pequeno robô de escritório, simpático e simples, lê uma carta numa mesa. Dentro da carta, escondido entre as linhas, há um pequeno bilhete dobrado em azul de destaque. Ao lado do robô, uma gaveta aberta com envelopes e uma chave, sugerindo acesso a coisas importantes.
```

### Q-SD-01. gen-sd-pix-idempotencia

Tamanho: 1024×1024. Arquivo: `Q-SD-01.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Mão segurando um celular cuja tela mostra apenas um círculo de carregamento. O polegar está prestes a tocar de novo no botão grande da tela. Ao redor do celular, duas moedas idênticas em azul de destaque saindo em direções diferentes, sugerindo pagamento em dobro.
```

## 4. Metáforas de conceito (núcleo e fichas)

### MET-01. Condição de corrida

Tamanho: . Arquivo: `MET-01.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Duas mãos, vindas de lados opostos, escrevendo ao mesmo tempo na mesma linha de um caderno, os traços se sobrepondo e embaralhando. Uma das mãos em azul de destaque.
```

### MET-02. Deadlock

Tamanho: . Arquivo: `MET-02.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Vista de cima de um cruzamento estreito: quatro carrinhos, cada um com o nariz bloqueando o caminho do seguinte, formando um ciclo fechado no centro. Nenhum consegue andar.
```

### MET-03. Pipeline

Tamanho: . Arquivo: `MET-03.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Lavanderia vista de lado com quatro estações em sequência: máquina de lavar, secadora, mesa de dobrar e prateleira. Quatro cestos de roupa, cada um numa estação diferente ao mesmo tempo, em diagonal, como uma escada.
```

### MET-04. Localidade e cache

Tamanho: . Arquivo: `MET-04.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Uma estante longa de biblioteca ao fundo e, em primeiro plano, uma mesa pequena com uma pilha de livros vizinhos retirados juntos da mesma prateleira. Uma lacuna na estante marca de onde saíram. Os livros da mesa em azul de destaque.
```

### MET-05. Tabela hash com encadeamento

Tamanho: . Arquivo: `MET-05.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Parede de caixas de correio numeradas apenas por formas geométricas simples (sem números). De algumas caixas pende uma corrente de envelopes presos uns aos outros, de comprimentos diferentes; a maioria das correntes é curta.
```

### MET-06. Heap

Tamanho: . Arquivo: `MET-06.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Pirâmide de caixas empilhadas em que cada caixa é um pouco maior que as duas logo abaixo dela; a maior está no topo, em azul de destaque.
```

### MET-07. Sobreajuste

Tamanho: . Arquivo: `MET-07.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Um alfaiate ajusta um terno perfeitamente a um manequim cheio de calombos e ângulos estranhos. Ao lado, três pessoas reais de corpos diferentes olham o terno com dúvida.
```

### MET-08. Precisão e revocação

Tamanho: . Arquivo: `MET-08.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Uma rede de pesca sendo puxada de um lago: dentro dela alguns peixes em azul de destaque e alguns objetos indesejados (bota, lata). Na água, fora da rede, alguns peixes azuis que escaparam.
```

### MET-09. Encapsulamento em camadas de rede

Tamanho: . Arquivo: `MET-09.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Uma carta sendo colocada dentro de um envelope, que vai dentro de outro maior, que vai dentro de uma caixa, em sequência da esquerda para a direita. A carta original em azul de destaque.
```

### MET-10. NAT e CGNAT

Tamanho: . Arquivo: `MET-10.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Um prédio de apartamentos com uma única caixa de correio na entrada e um porteiro distribuindo cartas para várias portas internas. Ao fundo, um prédio ainda maior que abriga vários prédios menores, com um único portão.
```

### MET-11. Partição na rede (CAP)

Tamanho: . Arquivo: `MET-11.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Duas agências bancárias, uma em cada margem de um rio, ligadas por uma ponte quebrada ao meio. Cada agência tem o próprio livro-razão aberto no balcão. Um caixa de cada lado olha para a ponte.
```

### MET-12. Idempotência

Tamanho: . Arquivo: `MET-12.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Um dedo apertando repetidamente o botão de chamar do elevador, com marcas de movimento; acima da porta, uma única luz acesa em azul de destaque, indicando que só uma chamada foi registrada.
```

### MET-13. Homem no meio

Tamanho: . Arquivo: `MET-13.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Duas pessoas trocando cartas por um tubo pneumático; no meio do tubo, uma terceira figura discreta abre um envelope, lê e o fecha de novo.
```

### MET-14. Redução entre problemas

Tamanho: . Arquivo: `MET-14.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Uma ferramenta adaptadora: um parafuso de formato estranho entra num adaptador que o transforma num parafuso comum, que então entra numa chave de fenda universal. Fluxo da esquerda para a direita.
```

### MET-15. Ataque à cadeia de dependências

Tamanho: . Arquivo: `MET-15.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Prateleira de supermercado com dezenas de caixas iguais; uma delas tem a embalagem quase idêntica, diferindo só por um detalhe na forma do rótulo, destacada em azul. Uma mão está prestes a pegá-la.
```

## 5. Capas das áreas (mesma série visual)

Gere a primeira, veja se gostou do estilo e use a mesma conversa para as outras, pedindo "mesma série, mesmo estilo".

### CAPA-ALG. Algoritmos

Tamanho: 1536×1024. Arquivo: `CAPA-ALG.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: uma pequena árvore de galhos binários feita de clipes e fio, com nós redondos. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-MAT. Matemática

Tamanho: 1536×1024. Arquivo: `CAPA-MAT.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: dois dados, um baralho em leque e um diagrama de Venn desenhado a lápis. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-ARQ. Arquitetura

Tamanho: 1536×1024. Arquivo: `CAPA-ARQ.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: um chip de processador visto de cima, com trilhas que se espalham como ruas. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-SO. Sistemas operacionais

Tamanho: 1536×1024. Arquivo: `CAPA-SO.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: um semáforo de trânsito de mesa ao lado de várias fichas de papel em fila. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-ES. Engenharia de software

Tamanho: 1536×1024. Arquivo: `CAPA-ES.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: um quadro de cartões adesivos em três colunas, sem escrita. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-TC. Teoria da computação

Tamanho: 1536×1024. Arquivo: `CAPA-TC.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: uma fita de papel longa com quadradinhos e uma pequena cabeça de leitura de metal. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-RED. Redes

Tamanho: 1536×1024. Arquivo: `CAPA-RED.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: envelopes encaixados uns dentro dos outros, do maior para o menor. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-IA. Inteligência artificial

Tamanho: 1536×1024. Arquivo: `CAPA-IA.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: uma rede de pinos ligados por fios em camadas, como um tear. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-PROG. Programação

Tamanho: 1536×1024. Arquivo: `CAPA-PROG.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: blocos de montar encaixados formando uma escada. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-BD. Banco de dados

Tamanho: 1536×1024. Arquivo: `CAPA-BD.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: um fichário de gavetas com fichas e algumas fichas ligadas por barbante. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-CG. Computação gráfica

Tamanho: 1536×1024. Arquivo: `CAPA-CG.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: um prisma de vidro decompondo um feixe de luz sobre uma grade de pixels. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-COMP. Compiladores

Tamanho: 1536×1024. Arquivo: `CAPA-COMP.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: um funil que recebe tiras de papel e solta peças de engrenagem. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-SOC. Sociedade e ética

Tamanho: 1536×1024. Arquivo: `CAPA-SOC.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: uma balança de pratos com um celular num prato e um pequeno livro no outro. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-SD. Sistemas distribuídos

Tamanho: 1536×1024. Arquivo: `CAPA-SD.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: três relógios de mesa iguais marcando horas levemente diferentes. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-IHC. IHC

Tamanho: 1536×1024. Arquivo: `CAPA-IHC.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: uma mão tocando um grande botão redondo de um protótipo de papel. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-SEG. Segurança

Tamanho: 1536×1024. Arquivo: `CAPA-SEG.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: um cadeado aberto ao lado de uma chave e de um envelope lacrado com cera. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

### CAPA-FG. Formação Geral

Tamanho: 1536×1024. Arquivo: `CAPA-FG.png`.

```
Ilustração editorial plana, traço de tinta azul-escuro (#151e2f) sobre papel creme (#f4f3ef), com uma única cor de destaque azul (#1649ae) e sombras em tons do próprio papel. Estilo de caderno de estudos: linhas firmes, poucos detalhes, formas simples, leve textura de papel. Composição limpa com bastante espaço vazio. Sem nenhum texto, letra, número, logotipo ou marca d'água na imagem. Sem gradientes coloridos, sem brilho, sem estilo 3D, sem aparência de banco de imagens. Natureza-morta sobre a mesa de estudo vista de cima: um caderno aberto ao centro, um lápis e uma régua. Sobre o caderno, o objeto central: um jornal dobrado, um gráfico de barras recortado e um globo pequeno. O objeto ocupa um terço da imagem, à direita, deixando espaço vazio à esquerda para o título da página.
```

## Resumo

| Grupo | Itens | Prioridade |
| --- | ---: | --- |
| Dudu | 3 poses e a folha original | 1 |
| Formação Geral | 6 | 2 |
| Cenas de questões | 3 | 3 |
| Metáforas | 15 | 4 (comece pelas MET-01 a MET-08) |
| Capas | 17 | 5 |
