# Flashcards, meta diária, conquistas e biblioteca

Documento de manutenção das funções de estudo diário (ENG-1, FLASH-1, LIB-1).
Migration: `027_engagement_and_flashcards.sql`.

## 1. Por que flashcards

Duas técnicas têm as evidências mais fortes de aprendizagem duradoura:

- **Prática de recuperação** (tentar lembrar, em vez de reler). Roediger e
  Karpicke (2006) mostraram retenção maior depois de uma semana para quem se
  testou do que para quem releu, mesmo com menos tempo de contato.
- **Prática espaçada** (revisões em intervalos crescentes). Cepeda et al.
  (2006) reuniram mais de 300 experimentos com o mesmo resultado.

As duas foram as únicas com utilidade "alta" na revisão de Dunlosky et al.
(2013) e estão entre as mais eficazes na meta-análise de Donoghue e Hattie
(2021). O cartão força a recuperação; o agendador cuida do espaçamento.

## 2. O agendador: FSRS-5

`apps/api/src/fsrs.ts` implementa o FSRS-5 (Free Spaced Repetition
Scheduler), o algoritmo livre usado no Anki desde a versão 23.10. Funções
puras; o controlador só grava o resultado.

Cada cartão guarda:

| Variável | Significado |
| --- | --- |
| D, dificuldade | 1 a 10 |
| S, estabilidade | dias até a chance de lembrar cair a 90% |
| R, recuperabilidade | chance de lembrar agora, calculada |

Fórmulas (DECAY = −0,5; FACTOR = 19/81; pesos `W` padrão do FSRS-5):

- R(t, S) = (1 + FACTOR·t/S)^DECAY
- próximo intervalo I = S/FACTOR · (r^(1/DECAY) − 1), com r = 0,9 → I = S
- primeira revisão: S₀ = w[G−1]; D₀(G) = w4 − e^(w5·(G−1)) + 1
- dificuldade: amortecimento linear (quanto mais perto de 10, menos sobe) e
  reversão à média para D₀(4)
- acerto: S cresce mais quando R estava baixo (lembrar no limite reforça mais)
- erro: S cai pela fórmula de esquecimento, nunca acima da anterior
- revisão no mesmo dia: S·e^(w17·(G − 3 + w18))

Escolhas da plataforma:

- **retenção desejada 0,9** (padrão do FSRS);
- **intervalo máximo 365 dias**: a plataforma prepara para uma prova;
- **"Errei" volta em 10 minutos** e o cartão entra de novo no fim da sessão;
- sessão: os vencidos primeiro, depois até 10 novos, no máximo 30 cartões;
- "guardado" = estabilidade ≥ 21 dias.

Os pesos não são otimizados por pessoa (seriam precisas centenas de revisões
por conta). `flashcard_review` guarda todas as notas para permitir isso no
futuro.

## 3. Conteúdo

- `data/flashcards/<baralho>.json`: 14 baralhos, 135 cartões, um por área.
- `data/study-sheets/<ficha>.json`: 12 fichas de uma página.

Lidos por `apps/api/src/study-content.ts` (pasta `STUDY_CONTENT_DIR`, padrão
`data`), validados na carga; ids de cartão repetidos são recusados. Para
acrescentar um cartão basta editar o JSON; mudar o `id` de um cartão existente
apaga o histórico dele.

**Todo esse conteúdo foi escrito por IA (Claude) a partir da bibliografia de
cada área, sem revisão humana.** A interface avisa. Uma revisão por professor
é recomendada antes de divulgar.

## 4. Meta diária e sequência

`apps/api/src/engagement.ts`.

- Conta questões distintas por dia (estudo livre e treinos/provas), no fuso
  `America/Sao_Paulo`.
- Meta de 1 a 50 por dia (padrão 5), em `study_goal`.
- A sequência conta dias com a meta batida. Um dia perdido por semana ISO é
  perdoado quando fica entre dois dias batidos; hoje ainda não batido não
  quebra a sequência.

## 5. Conquistas

`apps/api/src/achievements.ts`: 14 medalhas (bronze, prata, ouro), avaliadas
sob demanda em `GET /api/me/engagement`. A primeira vez que uma condição é
atingida grava `achievement_unlock`; a medalha nova aparece num aviso discreto
até `POST /api/me/achievements/seen`. Acrescentar uma medalha: incluir o
código em `ACHIEVEMENTS`, a contagem em `stats()` e, se preciso, o ícone em
`badge.component.html`.

## 6. Ranking de constância

`GET /api/ranking`: dias ativos nos últimos 7 e 30 dias (questões ou
flashcards), só contas, nome "Nome S.". Mede constância, não nota, de
propósito: não expõe desempenho de ninguém. Quem não quiser aparecer desliga
em Conquistas (`PUT /api/me/ranking`, `account.ranking_visible`).

## 7. Biblioteca

Fichas de uma página por assunto, com pegadinhas comuns, "Treinar" e
"Revisar com flashcards". "Materiais por área" (PDFs e links dos professores)
e "Plano até a prova" aparecem como "Em breve".

## Referências

- Ye, J. et al. *The Algorithm* (FSRS-5). open-spaced-repetition/awesome-fsrs wiki.
  https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
- *ABC of FSRS*. https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS
- Dunlosky, J. et al. (2013). Improving students' learning with effective
  learning techniques. *Psychological Science in the Public Interest*, 14(1).
  https://digitalcommons.usf.edu/psy_facpub/1771/
- Donoghue, G. M.; Hattie, J. (2021). A meta-analysis of ten learning
  techniques. *Frontiers in Education*, 6. https://www.doi.org/10.3389/feduc.2021.581216
- Cepeda, N. J. et al. (2006). Distributed practice in verbal recall tasks.
  *Psychological Bulletin*, 132(3).
- Roediger, H. L.; Karpicke, J. D. (2006). Test-enhanced learning.
  *Psychological Science*, 17(3).
