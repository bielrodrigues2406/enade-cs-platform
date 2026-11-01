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
| `apps/web/src/mascot.component.*` | `<app-mascot pose="…" [size]="96" motion="pop|bob|none" [decorative]="true">` |
| `apps/web/src/mascot.service.ts` | preferência "mostrar o mascote" (hoje no navegador) |

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
| Flashcards, nada vencendo | "Nada vence hoje" | `dormindo` | a fazer |
| Página pública | cena principal ao lado do título (gerar a cena, ver §6) | cena | a fazer |
| Entrar / cadastro | aceno pequeno | `acenando` | a fazer |
| Início | uma frase pela situação: falta X para a meta, erros para revisar, treino pela metade | `contente` / `lupa` / `relogio` | a fazer |
| Aviso de meta batida | trocar o anel do aviso pelo pato | `comemorando` | a fazer |
| Sequência (Conquistas) | ao lado da chama | `sequencia` | a fazer |
| Aviso de conquista | pato com a medalha | `medalha` | a fazer |
| Depois de errar (estudo) | **"Explique para o pato"**: campo curto, salvo no caderno de erros (etapa 3) | `ouvindo` | a fazer |
| Caderno de erros | vazio: "Nada para revisar hoje"; com revisões: lupa | `contente` / `lupa` | a fazer |
| Treino cronometrado | **gestor de ritmo** (etapa 2) | `relogio` | a fazer |
| Resultado do treino | reação por faixa de nota (<40, 40–69, ≥70) | `ouvindo` / `contente` / `comemorando` | a fazer |
| Discursivas | "Explique como se fosse para o pato" acima da folha | `ouvindo` | a fazer |
| Biblioteca | cabeçalho; cartões "Em breve" | `lendo` / `em-obras` | a fazer |
| Carregando | `motion="bob"` | `boiando` | a fazer |
| Erro / página não encontrada | sem drama | `bug` | a fazer |
| Ícone do app / favicon | cabeça e lápis sobre `#0f285a` (gerar, ver §6) | ícone | a fazer |

## 5. Ordem de construção

1. **Só tela, sem banco**: as linhas "a fazer" que não dependem das etapas 2 e 3, e um
   interruptor "Mostrar o mascote" no Meu perfil (`MascotService`). Depois, guardar a
   preferência na conta (migration).
2. **Gestor de ritmo** (só no navegador): no treino com cronômetro, quando a pessoa passa de
   6 min na mesma questão (1,5× o ritmo de 4 min), mostrar **uma vez por questão**, ao lado da
   folha, sem animação: "Está há 6 min nesta. Marcar para revisar e seguir?" com o botão
   "Marcar e seguir" (usa a marcação de revisão que já existe). Desligado por padrão na prova
   completa da edição (simula a prova real). Testar com relógio falso no Playwright.
3. **"Explique para o pato"** (migration nova): depois de errar no estudo, um campo opcional
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

Ainda faltam:
- **cena da página pública** (16:9, pato sobre um caderno aberto, notebook com linhas de
  código ilegíveis e pilha de cartões; 45% à esquerda livre para o título);
- **ícone do app** (cabeça e lápis, 70% de um quadrado arredondado, fundos `#0F285A`,
  `#F4F3EF` e `#1649AE`; legível a 48 px);
- se possível, **PNG com fundo transparente** de todas as poses.

Para recortar uma folha nova: ajuste `bounds` (colunas) e `bands` (faixas) em
`scripts/crop-mascot.py` e rode
`python3 scripts/crop-mascot.py design/mascot/<folha>.jpg apps/web/public/mascot/`.
Confira o resultado sobre fundo claro e escuro antes de commitar.
