# Dudu: refazer todas as imagens em alta (07/11/2026)

Pedido de Gabriel em 07/11/2026. As 14 poses atuais foram recortadas de uma única folha com todas as poses, em JPG, com cerca de 300 px por pose, por isso ficam borradas perto das três poses novas (`novidade`, `plano` e `forca`). A solução é gerar **uma imagem por vez, em 1024×1536**, todas a partir da mesma referência nítida.

São 24 imagens em três grupos, nesta ordem:

| Grupo | Imagens | Para que serve |
| --- | ---: | --- |
| 1. Imagem-base | 1 | Referência de tudo o que vem depois |
| 2. Camadas para animar | 9 | Acenar, piscar, comemorar, pular com os pés no chão, olhos felizes |
| 3. Poses | 14 | As poses usadas nas telas, agora nítidas |

As três poses novas já estão boas e ficam como estão.

## Como gerar

1. **Referência:** anexe a imagem do **Dudu fazendo joinha** que você acabou de gerar (só ela, sem as outras duas). É a mais nítida e neutra.
2. **Ordem:** gere primeiro a imagem-base (seção 1). Depois, **anexe a imagem-base** em todas as outras gerações, sempre ela e não a imagem anterior, para o personagem não ir mudando aos poucos.
3. **Prompt:** em cada geração, cole o **bloco fixo** abaixo e depois o prompt do item.
4. **Uma imagem por geração:** sem folha com várias poses.
5. **Formato:**
   - PNG de 1024×1536, em retrato, com fundo transparente;
   - se o GPT não fizer transparência, peça fundo magenta puro `#FF00FF`, liso, sem sombra, e eu recorto.
6. **Nome do arquivo:** o código do item (por exemplo, `dudu-base.png`, `pose-lupa.png`). Pode mandar num zip.

## Bloco fixo (colar em todas)

```text
Use o Dudu da imagem anexada como referência obrigatória de identidade. É o mesmo personagem, sem redesenhar o rosto nem mudar as proporções: pato amarelo de borracha, visual 3D de brinquedo de vinil fosco, formas arredondadas, cabeça grande e redonda, barriga amarelo-clara, bico e pés laranja, olhos ovais azul-marinho com um pequeno brilho branco. O lápis azul-marinho com ponta laranja fica atrás da cabeça, à direita de quem olha a imagem. Nunca espelhe o personagem.

Paleta: amarelo quente #F6C945, barriga #FCE7A1, bico e pés #F08A2C, olhos #151E2F, lápis #0F285A. Iluminação de estúdio suave vinda do alto à esquerda, igual à referência. Aparência simpática e inteligente, para estudantes universitários, sem exagero infantil. Asas arredondadas de pato de brinquedo, sem dedos humanos.

Saída: um único PNG de 1024 × 1536 pixels, em retrato, com transparência alfa real (ou, se não for possível, fundo magenta puro #FF00FF liso). Personagem nítido, em alta definição. Sem texto, letras, números, rótulos, marca d'água, cenário, chão, confete ou sombra projetada no fundo. Mantenha o sombreamento do próprio material.
```

## 1. Imagem-base

### `dudu-base.png`

```text
Crie a imagem-base do Dudu inteiro, visto de frente, câmera ortográfica na altura do peito, sem inclinar a cabeça. Em pé, os dois pés apoiados na mesma linha horizontal e um pouco afastados entre si, olhos abertos, expressão acolhedora e neutra. As duas asas relaxadas para baixo e levemente afastadas do tronco, com um pequeno espaço visível entre cada asa e o corpo, para os contornos e ombros ficarem claros. Barriga e pés inteiros visíveis. Lápis atrás da cabeça à direita de quem olha.

Centralize o personagem na tela, ocupando cerca de 70% da altura, com margem transparente acima, abaixo e dos lados para levantar as asas e inclinar a cabeça sem cortar nada. Sem acessórios. Esta imagem define a posição e a proporção de todas as camadas e poses seguintes.
```

## 2. Camadas para animar

**Regra para todas as camadas:** anexe a `dudu-base.png` e peça a peça **no mesmo lugar e no mesmo tamanho** em que está na base, numa tela inteira de 1024×1536. Não pode centralizar, ampliar nem recortar a peça isolada; o espaço vazio transparente é o que garante o encaixe.

O GPT costuma deslocar um pouco as peças. Eu alinho cada camada à base no código e confiro a montagem antes de animar, mas quanto mais fiel ao lugar, melhor.

Cole este trecho depois do bloco fixo, em todas as camadas:

```text
Esta é uma camada para remontar o personagem, não uma nova ilustração. Mantenha exatamente a escala, a posição na tela, a câmera e a iluminação da imagem-base anexada. Não recentralize, não amplie e não recorte a peça: preserve a tela inteira de 1024 × 1536, com tudo fora da peça pedida transparente.
```

### `camada-corpo.png` (tronco, sem pés)

```text
Produza somente o TRONCO com a barriga clara, sem cabeça, lápis, olhos, bico, asas e sem os pés. Reconstrua com suavidade as partes do tronco que estavam escondidas pela cabeça e pelas asas. Na parte de baixo, onde os pés se encaixavam, feche o tronco com uma base arredondada e lisa, sem buracos nem marcas de corte. O alto do tronco deve permitir que a cabeça se sobreponha ao pescoço.
```

### `camada-pe-esquerdo.png`

```text
Produza somente o PÉ QUE APARECE À ESQUERDA DE QUEM OLHA A IMAGEM, laranja, com a mesma forma, posição e tamanho da imagem-base. Complete a parte de cima do pé que ficava escondida sob o tronco, em formato arredondado, para o pé poder ficar parado enquanto o corpo se move. Remova todo o resto, inclusive o outro pé.
```

### `camada-pe-direito.png`

```text
Produza somente o PÉ QUE APARECE À DIREITA DE QUEM OLHA A IMAGEM, laranja, com a mesma forma, posição e tamanho da imagem-base. Complete a parte de cima do pé que ficava escondida sob o tronco, em formato arredondado. Não espelhe o outro pé: mantenha a iluminação e a perspectiva deste lado. Remova todo o resto.
```

### `camada-cabeca.png` (com bico e lápis, sem olhos)

```text
Produza somente a CABEÇA, com o bico e o lápis. Remova corpo, pés, asas e os dois olhos, inclusive os brilhos. Onde os olhos estavam, reconstrua a superfície amarela lisa e contínua, sem cavidades nem manchas. Complete de forma arredondada a borda de baixo, que se encaixa sobre o corpo, sem criar pescoço comprido.
```

### `camada-asa-esquerda.png`

```text
Produza somente a ASA QUE APARECE À ESQUERDA DE QUEM OLHA A IMAGEM, com a forma, a pose relaxada, a posição e o tamanho da imagem-base. Complete a pequena região arredondada do ombro que ficava escondida pelo tronco, para a asa poder girar no encaixe. Remova todo o resto, inclusive a outra asa, sem deixar sombra ou pedaço do tronco.
```

### `camada-asa-direita.png`

```text
Produza somente a ASA QUE APARECE À DIREITA DE QUEM OLHA A IMAGEM, com a forma, a pose relaxada, a posição e o tamanho da imagem-base. Complete a pequena região arredondada do ombro que ficava escondida pelo tronco. Não espelhe a outra asa: mantenha a iluminação e a perspectiva deste lado. Remova todo o resto, sem deixar sombra ou pedaço do tronco.
```

### `camada-olhos-abertos.png`

```text
Produza somente OS DOIS OLHOS ABERTOS, ovais, azul-marinho, com os pequenos brilhos brancos e volume suave, na mesma forma, distância, tamanho e posição da imagem-base. Remova todo o resto; o espaço entre os olhos também fica transparente. Sem sobrancelhas, cílios ou óculos.
```

### `camada-olhos-fechados.png` (piscada)

```text
Produza somente OS DOIS OLHOS FECHADOS de uma piscada breve: cada olho é uma curva azul-marinho discreta, levemente voltada para baixo, com acabamento de brinquedo 3D. Centro de cada curva no centro do olho correspondente da imagem-base, mesma distância entre eles. Sem cabeça, pele, bico, cílios ou sobrancelhas. Tudo fora das duas curvas transparente.
```

### `camada-olhos-felizes.png` (sorriso com os olhos)

```text
Produza somente OS DOIS OLHOS FELIZES, fechados de alegria: cada olho é um arco azul-marinho voltado para cima, como um sorriso com os olhos, com acabamento de brinquedo 3D. Centro de cada arco no centro do olho correspondente da imagem-base, mesma distância entre eles. Sem cabeça, pele, bico, cílios ou sobrancelhas. Tudo fora dos dois arcos transparente.
```

**O que as camadas novas permitem:**
- **Pés separados:** no pulo de comemorar, os pés ficam no chão enquanto o corpo agacha e sobe, o que é mais natural que o corpo inteiro saltar junto.
- **Olhos felizes:** trocar os olhos no meio do gesto de comemorar e no aceno.

As regras continuam: sem laço contínuo, sem olhos seguindo o cursor e sem boca falando.

## 3. Poses

Anexe a `dudu-base.png`. Cada pose é o Dudu inteiro, de frente ou em 3/4 leve, centralizado, ocupando cerca de 70% da altura, como na base. Os objetos não têm letras nem números.

| Arquivo | Onde aparece |
| --- | --- |
| `pose-acenando.png` | Entrar e cadastro |
| `pose-comemorando.png` | Meta batida, resultado bom |
| `pose-sequencia.png` | Sequência de dias, em Conquistas |
| `pose-medalha.png` | Aviso de conquista |
| `pose-ouvindo.png` | "Explique para o pato", discursivas |
| `pose-contente.png` | Início, caderno vazio |
| `pose-lupa.png` | Caderno de erros com revisões |
| `pose-relogio.png` | Treino cronometrado |
| `pose-cartoes.png` | Fim da sessão de flashcards |
| `pose-dormindo.png` | Nenhum flashcard vencendo hoje |
| `pose-lendo.png` | Biblioteca |
| `pose-em-obras.png` | Partes "Em breve" |
| `pose-boiando.png` | Carregando |
| `pose-bug.png` | Erro, página não encontrada |

### `pose-acenando.png`

```text
O Dudu em pé, de frente, acenando: a asa à esquerda de quem olha erguida acima da cabeça, aberta num aceno amigável; a outra asa relaxada junto ao corpo. Olhos abertos, expressão acolhedora. Pés no chão. O lápis continua visível atrás da cabeça, à direita.
```

### `pose-comemorando.png`

```text
O Dudu comemorando: as duas asas erguidas para o alto em diagonal, olhos felizes fechados em arco voltado para cima, bico aberto num sorriso discreto, corpo levemente esticado para cima com os pés ainda tocando o chão. Alegria contida, sem confete.
```

### `pose-sequencia.png`

```text
O Dudu em pé, de frente, confiante, com uma pequena chama estilizada laranja e amarela flutuando logo acima da cabeça, no centro, como símbolo de sequência de dias de estudo. A chama é limpa e arredondada, no mesmo estilo 3D de vinil, sem faíscas espalhadas. Asas relaxadas, olhos abertos e expressão orgulhosa.
```

### `pose-medalha.png`

```text
O Dudu em pé, de frente, segurando com as duas asas, à altura do peito, uma medalha dourada redonda e lisa com fita azul-marinho #0F285A. A medalha não tem números, letras nem desenhos. Olhos felizes em arco, expressão orgulhosa e tranquila.
```

### `pose-ouvindo.png`

```text
O Dudu em pé, com a cabeça levemente inclinada para o lado esquerdo de quem olha, atento, como quem escuta uma explicação com interesse. Uma asa encostada na lateral do corpo e a outra levemente erguida à frente do peito, num gesto de "estou ouvindo". Olhos abertos, expressão calma e interessada, sem sorriso exagerado.
```

### `pose-contente.png`

```text
O Dudu em pé, de frente, contente e relaxado: olhos felizes fechados em arco voltado para cima, bico num sorriso suave, asas relaxadas junto ao corpo, levemente afastadas. Postura tranquila e acolhedora.
```

### `pose-lupa.png`

```text
O Dudu em pé, em leve 3/4, segurando com uma asa uma lupa de aro azul-marinho #0F285A e cabo laranja à frente do rosto, olhando através dela com curiosidade; o olho atrás da lente aparece ampliado. A outra asa relaxada. Expressão investigativa e simpática.
```

### `pose-relogio.png`

```text
O Dudu em pé, segurando com as duas asas, à frente do corpo, um relógio de bolso redondo azul-marinho com mostrador creme sem números, apenas dois ponteiros. Olha para o relógio com expressão atenta e serena, não ansiosa.
```

### `pose-cartoes.png`

```text
O Dudu em pé, abraçando junto ao peito uma pequena pilha de cartões de estudo retangulares, creme, com bordas azul-marinho e algumas linhas azuis no lugar do texto, sem letras. Olhos felizes em arco, expressão satisfeita, como quem terminou de revisar.
```

### `pose-dormindo.png`

```text
O Dudu sentado no chão, de frente, cochilando tranquilo: olhos fechados em curva suave, cabeça levemente inclinada, asas descansando sobre a barriga. Nada de letras "Z", bolhas ou gorro; apenas a expressão serena de quem dorme. Os pés aparecem à frente do corpo.
```

### `pose-lendo.png`

```text
O Dudu em pé, de frente, usando óculos redondos de aro fino azul-marinho, segurando com as duas asas um livro aberto de capa azul-marinho #0F285A, lendo com atenção. As páginas são creme, com linhas azuis no lugar do texto, sem letras. Expressão concentrada e serena.
```

### `pose-em-obras.png`

```text
O Dudu em pé, de frente, usando um capacete de obra azul-marinho #0F285A com aba, segurando com uma asa uma pequena chave inglesa laranja. Expressão animada e prestativa, como quem está construindo algo novo.
```

### `pose-boiando.png`

```text
O Dudu boiando de frente numa pequena área circular de água azul (#1649AE), visto levemente de cima, com duas ou três ondinhas suaves ao redor. A água aparece só em volta da base dele; o resto da tela transparente. Olhos abertos e relaxados, asas abertas para os lados, flutuando tranquilo como um pato de borracha.
```

### `pose-bug.png`

```text
O Dudu em pé, de frente, olhando para cima, curioso e levemente surpreso, para um pequeno besouro azul-marinho arredondado e simpático pousado no alto da sua cabeça. Uma asa levemente erguida, sem drama. O besouro é pequeno e estilizado, no mesmo acabamento 3D de vinil.
```

## Antes de mandar, conferir em cada imagem

- [ ] O lápis está **atrás da cabeça, à direita** de quem olha (o GPT às vezes espelha).
- [ ] As asas não têm dedos; o joinha da pose `forca` é exceção e já está pronta.
- [ ] Não há letras, números nem "Zzz".
- [ ] As cores batem com a base: o amarelo não ficou esverdeado ou alaranjado, e os olhos são azul-marinho.
- [ ] Não há sombra no chão nem fundo quadriculado desenhado (quadriculado falso não é transparência).
- [ ] Nas camadas: a peça está no mesmo lugar em que está na base, numa tela inteira de 1024×1536.

## O que eu faço quando chegar

1. Recorte e limpeza das bordas: magenta, se vier, e resíduos de alfa.
2. **Camadas:** alinhamento automático de cada camada à base, montagem e conferência sobreposta em 56, 64, 80 e 120 px. Só depois troco as camadas atuais e ajusto os pivôs.
3. **Animação:**
   - aceno com a asa acima da cabeça e duas oscilações;
   - comemorar com agachada e pulo do corpo, os pés firmes e os olhos felizes;
   - piscada no fim do gesto.
4. **Arquivos:**
   - camadas reduzidas para cerca de 384×576, de 40 a 60 kB no total;
   - poses em WebP de cerca de 600 px de altura e 15 a 35 kB cada;
   - originais guardados fora do Git, com o SHA-256 registrado.
