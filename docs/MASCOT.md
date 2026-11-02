# Mascote: Dudu, o pato de borracha

Decidido com Gabriel em 01/11/2026. Leia isto antes de colocar o mascote em qualquer tela.

## 1. Por que um pato

*Rubber duck debugging*: o programador explica o problema a um pato de borracha e,
ao explicar, entende. A plataforma inteira se apoia nisso (tentar lembrar e explicar em vez
de reler). O traço próprio dele é o **lápis azul-marinho atrás do lado direito da cabeça**;
sem o lápis, é um pato de borracha qualquer.

Descartados: coruja (é o mascote do Duolingo), tatu-bola (lembra o Fuleco, da Copa de 2014),
polvo (lembra o Octocat do GitHub e não conta uma história da plataforma).

Nome: **Dudu**. Alternativa: "Bit".

## 2. Arquivos

| Onde | O quê |
| --- | --- |
| `design/mascot/turnaround.jpg` | vistas de frente, 3/4, lado e costas (referência de forma; a fileira apagada no alto é defeito da geração) |
| `design/mascot/poses-sheet.jpg` | folha original das 14 poses, gerada no Gemini |
| `apps/web/public/mascot/<pose>.webp` | poses recortadas, fundo transparente, ~300×400 px, ~15 kB cada |
| `scripts/crop-mascot.py` | recorte da folha (Pillow + numpy) |
| `design/mascot/scene-wide.jpg`, `scene-mobile.jpg` → `apps/web/public/mascot/scene-*.webp` | cena da página pública (seção "Explique para o pato") |
| `design/mascot/icon-navy-head.jpg` → `apps/web/public/icons/` | favicon 32/48, apple-touch-icon 180, ícones 192/512 do `manifest.webmanifest` |
| `design/mascot/icons-three-backgrounds.jpg` | ícones alternativos (papel e azul), ainda sem uso |
| `design/mascot/poses-magenta-lowres.jpg` | folha com fundo magenta para recorte limpo, **mas é captura de tela (1179 px, ~110 px por pose)**: baixa demais. Pedir a Gabriel o arquivo original em alta e recortar por chroma key |
| `apps/web/src/mascot.component.*` | `<app-mascot pose="…" [size]="96" motion="pop|greet|celebrate|bob|none" [decorative]="true">` |
| `apps/web/src/mascot.service.ts` | preferência "mostrar o mascote" (conta no servidor; visitante neste navegador) |

Poses: `acenando`, `comemorando`, `sequencia` (chama), `medalha`, `ouvindo`, `contente`,
`lupa`, `relogio`, `cartoes`, `dormindo`, `lendo` (óculos), `em-obras` (capacete),
`boiando`, `bug` (besourinho na cabeça). Textos alternativos em `MASCOT_ALT`.

Limitação dos recortes atuais: vieram de um JPG com fundo papel. A sombra sob os pés ficou
como mancha clara, invisível sobre `#f4f3ef`/branco e feia sobre fundo escuro. **Use o
mascote só sobre fundo claro** até existir uma versão em PNG com transparência real.

## 3. Regras

1. Aparece em **momentos**: comemorar, telas vazias, carregar, erro, resumo. Nunca no meio
   da resolução sem a pessoa pedir.
2. **Nunca dá dica da resposta.** Nada que reaja à alternativa antes do gabarito.
3. Nunca bloqueia nada e nunca é o único portador de uma informação (o texto ao lado diz tudo;
   por isso `decorative` é o padrão).
4. Fala pouco: frases curtas, sem infantilizar e sem excesso de exclamações. Voz: um colega
   calmo que já fez a prova.
5. Pode ser desligado (`MascotService.set(false)`); respeita "reduzir movimento".
6. Só nas telas de estudante. Professor e administração continuam sóbrios.
7. Imagens sempre `loading="lazy"`; nada do mascote entra no pacote inicial (limite de 500 kB).

## 4. Onde cada pose entra

| Tela | Comportamento | Pose | Estado |
| --- | --- | --- | --- |
| Flashcards, fim da sessão | resumo da sessão | `cartoes` | **feito** |
| Flashcards, nada vencendo | "Nada vence hoje" | `dormindo` | **feito (MAS-2)** |
| Página pública | seção "Explique para o pato" antes do convite final; texto sobre a cena a partir de 1100 px, acima dela abaixo disso | cena | **feito** |
| Entrar / cadastro | aceno pequeno | `acenando` | **feito (MAS-2)** |
| Início | uma frase pela situação: falta X para a meta, erros para revisar, treino pela metade | `contente` / `lupa` / `relogio` | **feito (MAS-2)** |
| Aviso de meta batida | trocar o anel do aviso pelo pato | `comemorando` | **feito (MAS-2)** |
| Sequência (Conquistas) | ao lado da chama | `sequencia` | **feito (MAS-2)** |
| Aviso de conquista | pato com a medalha | `medalha` | **feito (MAS-2)** |
| Depois de errar (estudo) | **"Explique para o pato"**: campo curto, salvo no caderno de erros (etapa 3) | `ouvindo` | **feito (MAS-2)** |
| Caderno de erros | vazio: "Nada para revisar hoje"; com revisões: lupa | `contente` / `lupa` | **feito (MAS-2)** |
| Treino cronometrado | **gestor de ritmo** (etapa 2) | `relogio` | **feito (MAS-2)** |
| Resultado do treino | reação por faixa de nota (<40, 40–69, ≥70) | `ouvindo` / `contente` / `comemorando` | **feito (MAS-2)** |
| Discursivas | "Explique como se fosse para o pato" acima da folha | `ouvindo` | **feito (MAS-2)** |
| Biblioteca | cabeçalho; cartões "Em breve" | `lendo` / `em-obras` | **feito (MAS-2)** |
| Carregando | `motion="bob"` | `boiando` | **feito (MAS-2)** |
| Erro / página não encontrada | sem drama | `bug` | **feito (MAS-2)** |
| Ícone do app / favicon | cabeça e lápis sobre `#0f285a`, `manifest.webmanifest` | ícone | **feito** |

## 5. Etapas implementadas e continuação

1. **Telas e preferência** (MAS-2, migration 028): as linhas "a fazer" que não dependem das etapas 2 e 3, e um
   interruptor "Mostrar o mascote" no Meu perfil (`MascotService`). A conta guarda a
   preferência no servidor. Visitantes têm um botão no rodapé e guardam a escolha no navegador.
2. **Gestor de ritmo** (só no navegador): no treino com cronômetro, quando a pessoa passa de
   6 min na mesma questão (1,5× o ritmo de 4 min), mostrar **uma vez por questão**, ao lado da
   folha, sem animação: "Está há 6 min nesta. Marcar para revisar e seguir?" com o botão
   "Marcar e seguir" (usa a marcação de revisão que já existe). Desligado por padrão na prova
   completa da edição (simula a prova real). Testar com relógio falso no Playwright.
3. **"Explique para o pato"** (MAS-2, migration 028): depois de errar no estudo, um campo opcional
   "Por que você marcou essa? Explique em uma frase." O texto fica no caderno de erros e
   volta na revisão espaçada. Base: autoexplicação e elaboração (Dunlosky et al., 2013).
4. **Depois**: "por que essa alternativa atrai", escrito na curadoria e mostrado **só depois**
   do gabarito; variação POSCOMP (óculos ou capelo) se o escopo crescer.

Ideias recusadas: marca-texto automático no enunciado (as questões são imagens; precisaria
transcrição e IA por questão) e alerta de pegadinha antes do gabarito (entrega a resposta).

## 6. Gerar mais imagens (Gemini)

Sempre anexar `design/mascot/turnaround.jpg` e começar com "Using the exact same duck
character from the attached image (… do not redesign it)". Terminar com o bloco:

```
STYLE LOCK: soft 3D clay/vinyl toy render, rounded chunky shapes, matte surface with subtle subsurface glow, soft studio key light from top-left, gentle contact shadow, no outlines, no text, no logos. Palette only: duck body warm yellow #F6C945 with lighter belly #FCE7A1, beak and feet orange #F08A2C, eyes deep navy #151E2F with one small white highlight, brand navy #0F285A, brand blue #1649AE, paper off-white #F4F3EF, accent amber #B77B29. Friendly, clever, calm — a study buddy for university Computer Science students, not a baby toy.
```

Ainda falta: a **folha de poses em alta resolução** com fundo magenta liso `#FF00FF`, sem
sombra (a recebida é captura de tela). As cenas e o ícone também vieram como captura
(1179 px de largura); se Gabriel tiver os originais, trocar pelos arquivos em alta.

Para recortar uma folha nova: ajuste `bounds` (colunas) e `bands` (faixas) em
`scripts/crop-mascot.py` e rode
`python3 scripts/crop-mascot.py design/mascot/<folha>.jpg apps/web/public/mascot/`.
Confira o resultado sobre fundo claro e escuro antes de commitar.

## 7. Acabamento e arte recebida em 02/11/2026

O pedido é um companheiro expressivo e com movimento breve: entrada nas comemorações,
boiar apenas durante carregamento, nenhuma animação no aviso de ritmo ou na resolução.
Todos respeitam `prefers-reduced-motion`. O interruptor esconde imagens do companheiro e
a cena pública; reflexões, textos e ações continuam disponíveis. Ícones do aplicativo
continuam sendo a marca. As telas administrativas/professor não ganham o mascote.

O aviso de conquista perdeu a faixa lateral colorida e os raios giratórios. Usa o papel,
a borda e a tipografia do caderno com uma entrada curta do Dudu. Evitar repetir grades,
etiquetas e decorações por hábito; cada composição deve servir à tarefa da tela.
Referência lida: [anti-slop](https://github.com/miqdadbadjuber/anti-slop), MIT, commit
`941b1532f9cc8ffde766bca5921d75257c9e5762`, somente como referência, sem instalar instruções.
Os links antiwebslop e do artigo da Anthropic ficaram inacessíveis pelo proxy nesta sessão;
não foram usados como se tivessem sido lidos.

Gabriel enviou duas tiras de sete poses, um ícone, uma cena vertical e outra horizontal.
A comparação visual favorece o rosto/lápis das novas cenas e do ícone; as tiras têm
expressões consistentes, porém cada pose ocupa menos pixels que os recortes atuais.
Magenta ainda não é transparência: conferir bordas sem halo a 64/96/120 px antes de trocar.
Os anexos inline não forneceram arquivos originais locais; **nenhuma dessas novas artes
foi incorporada ou declarada como substituída**. Mantidos os arquivos atuais até a extração
dos originais, sem ampliar artificialmente e chamar isso de mais resolução.

A reflexão é pessoal, opcional, até 600 caracteres, salva por ação explícita e só aparece
depois de uma resposta errada confirmada no estudo livre. A navegação protege rascunhos;
um erro de rede preserva o texto. Não há avaliação por IA nem alteração da nota.
O caderno a apresenta junto à questão. Contratos em API.md e decisão em ADR-015.

## 8. Movimento contextual (MAS-3)

Pedido de Gabriel em 02/11/2026, depois de conferir as capturas: dar mais vida ao Dudu.
As poses atuais são imagens únicas. O movimento entregue por CSS desloca, inclina e
comprime levemente o corpo inteiro; não é animação independente dos olhos ou das asas.

| Movimento | Uso | Duração e repetição |
| --- | --- | --- |
| `greet` | Entrar/cadastro e acolhimento no início | cumprimento com inclinação curta, uma vez, ~0,6 s |
| `celebrate` | conquista, meta, fim de flashcards e resultado ≥70% | pequeno salto com acomodação, uma vez, ~0,6 s |
| `pop` | entrada simples quando não há gesto específico | token de mola rápida, uma vez |
| `bob` | exclusivamente enquanto uma requisição carrega | flutuação de 2,4 s; para ao sair da espera |
| `none` | leitura, reflexão, aviso de ritmo e resultados abaixo de 70% | estático |

O gesto só começa após o evento `load` da imagem, inclusive se o arquivo demora ou
já está em cache. Trocar a pose reinicia essa preparação. As animações usam apenas
`transform`/`opacity`, não alteram o espaço do texto nem aguardam terminar para liberar
ações. Não há temporizadores de movimento, eventos de mouse, seguidores de cursor ou
animação de repouso contínua. Reduzir movimento desativa todos os gestos, inclusive
se a preferência mudar com a tela aberta. Ocultar o mascote continua funcionando.

### Próximo passo para olhos e asas

Gabriel reforçou que quer movimento das partes, não apenas a inclinação da imagem.
Escolha inicial de MAS-4: **PNG em camadas** do mesmo Dudu 3D, com cabeça, asas e olhos
separados e alinhados. [Prompts completos e nomes dos sete arquivos](MASCOT-ANIMATION-PROMPTS.md).
O grupo dos olhos acompanha a cabeça; as asas giram no ombro. A montagem exige conferir
as peças reais antes de implementar. As artes e a animação articulada estão pendentes.

Uma sequência curta de quadros continua sendo alternativa para gestos que mudem muito
a perspectiva. Nesse caso, comparar sprite e WebP animado só após medir o peso real, a
nitidez a 56/64/96/120 px e o controle de reprodução/interrupção. Manter sempre a imagem
estática equivalente para movimento reduzido.

SVG em camadas também permite articular olhos/asas, mas exige redesenho para preservar
a identidade. Rive/Lottie acrescentariam arte e runtime; não incluir essas dependências
sem um ganho demonstrado. As folhas anteriores com 14 poses não fornecem as
camadas ou os quadros intermediários: não simular uma piscada colando formas sobre o rosto.
Esta etapa de arte articulada fica pendente; não foi implementada por MAS-3.

## 9. Revisão visual das sete camadas recebidas

Gabriel enviou as sete prévias em 02/11/2026. O desenho mantém a identidade do Dudu,
o lápis do lado correto e as partes necessárias para MAS-4. Ordem real do envio:
referência completa, corpo/pés, cabeça, asa à direita da imagem, asa à esquerda,
olhos fechados e olhos abertos. Nomear pelos elementos visíveis, não pela ordem dos prompts.

A cabeça e os olhos aparecem mais abaixo na tela que os elementos correspondentes
da referência. Ajustar posição/escala e pivôs na montagem; não pedir novas gerações
apenas por esse deslocamento. As asas mostram a região arredondada do ombro necessária
à articulação. A composição ainda não foi sobreposta nem testada: são observações visuais.

Algumas prévias têm fundo branco e outras mostram quadriculado. A aparência no chat
não permite confirmar canal alfa real ou distinguir com certeza um quadriculado
desenhado. Os arquivos originais não foram disponibilizados no workspace; é necessário
receber os mesmos sete PNGs em um ZIP para verificar canais, dimensões, bordas e encaixe.
Nenhuma dessas camadas foi incorporada ao aplicativo. Não há necessidade de pedir
novas imagens antes de conferir os arquivos existentes.
