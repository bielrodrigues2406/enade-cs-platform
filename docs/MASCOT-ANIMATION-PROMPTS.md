# Dudu articulado — prompts para gerar as camadas

Pedido de Gabriel em 02/11/2026: mover olhos, cabeça e asas, além dos gestos do corpo inteiro de MAS-3.

Escolha para a próxima entrega: imagens PNG em camadas, preservando o Dudu 3D. Cabeça e asas terão pivôs próprios; olhos abertos/fechados ficam dentro do grupo da cabeça. Isso permite acenar, piscar, inclinar a cabeça e levantar as asas sem instalar um player de animação. A implementação depende dos arquivos e da conferência do encaixe; ainda não está entregue.

## Como gerar

1. Anexe uma imagem atual do Dudu como referência e gere a imagem 1. Prefira uma referência nítida que mostre o lápis e a forma do rosto.
2. Use a imagem 1 como referência em **todas** as outras gerações. Escolha editar essa imagem, sempre a partir da mesma referência, sem encadear uma camada na outra.
3. Cole o bloco fixo abaixo e, depois, o prompt da imagem desejada. Gere **um PNG por vez**, sem montagem ou folha de poses. Salve os arquivos com os nomes indicados.
4. As peças devem permanecer no mesmo lugar e tamanho da imagem 1, dentro de uma tela completa de 1024 × 1536. **Não centralize nem recorte cada peça isolada.** O vazio transparente preserva o encaixe.
5. Entregue os PNGs originais, com transparência alfa, sem captura de tela ou fundo magenta. Antes de integrar, sobrepor as camadas e conferir alinhamento, bordas e nitidez nas dimensões reais de uso.

## Bloco fixo — usar em todas as gerações

```text
Use o Dudu da imagem anexada como referência obrigatória de identidade. É o mesmo personagem, sem redesenhar o rosto ou mudar suas proporções: pato amarelo de borracha, visual 3D de brinquedo de vinil fosco, formas arredondadas, barriga amarelo-clara, bico e pés laranja, olhos ovais azul-marinho com um pequeno brilho branco. O lápis azul-marinho fica atrás da cabeça, à direita de quem olha a imagem. Nunca espelhe o personagem.

Paleta: amarelo quente #F6C945, barriga #FCE7A1, bico/pés #F08A2C, olhos #151E2F, lápis #0F285A. Iluminação de estúdio suave pelo alto à esquerda. Aparência simpática e inteligente, adequada a estudantes universitários, sem exagero infantil.

Saída: um PNG de 1024 × 1536 pixels, com transparência alfa real. Sem fundo branco, magenta ou quadriculado desenhado. Sem texto, rótulos, marca-d'água, cenário, chão ou sombra projetada no fundo. Mantenha o sombreamento do próprio material.

Para as camadas: mantenha exatamente a escala, a posição, a câmera e a iluminação da imagem-base. Não recentralize, não amplie e não recorte a peça. Preserve a tela inteira; tudo fora da peça pedida deve ser transparente. Esta é uma camada para remontagem de um personagem, não uma nova composição ilustrada.
```

## 1. Referência completa — `dudu-base.png`

```text
Crie a imagem-base do Dudu inteiro, visto de frente, com câmera ortográfica e sem inclinação da cabeça. Personagem em pé, os dois pés apoiados na mesma linha, olhos abertos e expressão acolhedora neutra. As duas asas ficam relaxadas para baixo e ligeiramente afastadas do tronco, permitindo reconhecer seus contornos e ombros. Barriga e pés inteiros visíveis. Lápis atrás da cabeça à direita de quem olha.

Centralize o personagem completo na tela, com margem transparente suficiente acima, abaixo e dos lados para levantar as asas e inclinar a cabeça sem cortar nada. Não acrescente acessórios, confete, medalha, roupa ou elementos flutuantes. Esta imagem definirá a posição e a proporção de todas as camadas seguintes.
```

## 2. Corpo e pés — `dudu-corpo.png`

```text
Edite a imagem-base anexada para produzir somente a camada CORPO E PÉS. Preserve o tronco, a barriga clara e os dois pés exatamente nas posições e dimensões originais. Remova a cabeça, o lápis, os olhos, o bico e as duas asas; essas partes serão arquivos separados.

Reconstrua suavemente as superfícies do tronco que estavam escondidas pela cabeça e pelas asas. O corpo deve ficar inteiro, arredondado, sem buracos, marcas de recorte ou sombras de partes removidas. A região superior precisa permitir que a cabeça se sobreponha ao pescoço. Todo o restante da tela deve ser transparente. Não mova nem centralize o corpo resultante.
```

## 3. Cabeça, bico e lápis — `dudu-cabeca.png`

```text
Edite a imagem-base anexada para produzir somente a camada CABEÇA, incluindo o bico e o lápis. Preserve exatamente o tamanho, a posição, a forma e a iluminação da cabeça original. Remova corpo, pés, asas e os dois olhos, incluindo seus brilhos. Os olhos serão uma camada independente.

Onde os olhos estavam, reconstrua a superfície amarela lisa e contínua da cabeça, sem cavidades ou manchas. Complete de forma arredondada a borda inferior que se encaixa sobre o corpo. Não acrescente pescoço comprido. Todo o restante deve ser transparente. Não mova nem centralize a cabeça resultante.
```

## 4. Asa do lado esquerdo da imagem — `dudu-asa-esquerda.png`

```text
Edite a imagem-base anexada para produzir somente a ASA QUE APARECE À ESQUERDA DE QUEM OLHA A IMAGEM. Preserve sua forma, sua pose relaxada, sua posição e seu tamanho originais. É uma asa arredondada de pato de brinquedo, sem dedos humanos.

Complete a pequena região arredondada do ombro que estava escondida pelo tronco, para permitir sobreposição e rotação da asa no encaixe. Remova todo o restante do personagem, inclusive a outra asa. Não deixe sombra ou pedaço do tronco nesta camada. O restante da tela deve ser transparente. Não mova nem centralize a asa resultante.
```

## 5. Asa do lado direito da imagem — `dudu-asa-direita.png`

```text
Edite a imagem-base anexada para produzir somente a ASA QUE APARECE À DIREITA DE QUEM OLHA A IMAGEM. Preserve sua forma, sua pose relaxada, sua posição e seu tamanho originais. É uma asa arredondada de pato de brinquedo, sem dedos humanos.

Complete a pequena região arredondada do ombro que estava escondida pelo tronco, para permitir sobreposição e rotação da asa no encaixe. Remova todo o restante do personagem, inclusive a outra asa. Não espelhe a outra asa: mantenha a iluminação e a perspectiva deste lado. Não deixe sombra ou pedaço do tronco. O restante da tela deve ser transparente. Não mova nem centralize a asa resultante.
```

## 6. Olhos abertos — `dudu-olhos-abertos.png`

```text
Edite a imagem-base anexada para produzir somente OS DOIS OLHOS ABERTOS, com seus pequenos brilhos brancos e volume suave. Preserve exatamente a forma oval azul-marinho, a distância entre os olhos, o tamanho, a orientação e a posição dos olhos originais.

Remova todo o restante: cabeça, pele amarela, bico, lápis, corpo e asas. Também deve haver transparência entre os dois olhos. Não acrescente sobrancelhas, cílios, óculos ou sombras externas. Não aproxime, não amplie e não centralize os olhos isolados; eles devem se encaixar sobre a cabeça no mesmo lugar que ocupavam na imagem-base.
```

## 7. Olhos fechados — `dudu-olhos-fechados.png`

```text
Use a imagem-base anexada para criar somente OS DOIS OLHOS FECHADOS do mesmo Dudu, com expressão tranquila de uma piscada breve. Cada olho fechado é uma curva azul-marinho discreta e suave, com acabamento compatível com o brinquedo 3D. Preserve a distância e a posição dos olhos da imagem-base, alinhando o centro de cada curva ao centro do olho correspondente.

Não desenhe cabeça, pele amarela, bico, lápis, corpo, asas, sobrancelhas ou cílios. Não desenhe olhos de personagem dormindo com expressão exagerada. Tudo fora das duas pequenas curvas deve ser transparente, inclusive o espaço entre elas. Não aproxime, não amplie e não centralize as curvas isoladas; esta camada deve substituir a dos olhos abertos sem deslocar o rosto.
```

## Conferência e implementação

- Ordem de montagem: asas atrás do tronco; corpo/pés; cabeça com olhos como filhos. Ajustar a sobreposição dos ombros conforme a arte real, sem esconder a asa inteira.
- Validar a reconstrução contra a imagem-base antes de animar. O gerador pode deslocar peças; essa conferência é necessária, não uma garantia dada pelos prompts.
- Pivôs: ombro para asas, base da cabeça para inclinação; os olhos acompanham a cabeça.
- Primeiro escopo: cumprimento com uma asa e piscada; comemoração com as duas asas e salto curto; escuta com inclinação breve depois da resposta. Nada de boca falando, voz ou olhos seguindo o cursor.
- Gestos por contexto, sem repetição contínua durante leitura. Movimento reduzido e preferência de ocultar Dudu continuam obrigatórios.
- Medir o peso dos arquivos reais e gerar derivados de produção após a conferência. Não carregar as sete imagens grandes no pacote inicial.
- Guardar originais em `design/mascot/`; apresentação em HTML, animação em CSS e apenas estado em TypeScript. Sem strings de HTML/CSS em TS e sem introduzir framework de animação por antecipação.
