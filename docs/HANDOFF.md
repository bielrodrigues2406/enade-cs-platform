# Passagem para o próximo agente (01/11/2026)

Leia antes: `AGENTS.md`, `docs/WORKBOARD.md` (diário no fim, reservas de migration), `docs/ENGINEERING-AND-DELIVERY.md` §1.3 (manutenção humana) e `docs/UX-DESIGN-SPEC.md`. Responda a Gabriel sempre em pt-BR.

## 1. Estado atual

- Branch de trabalho do Claude: `claude/confident-cray-ndnwmk`. O PR #30 foi integrado; meta, conquistas, ranking, flashcards, biblioteca e esta passagem estão no **PR #31** (aguardando CI e merge de Gabriel). Se o #31 já tiver sido integrado, recomece a branch a partir da `main` atualizada.
- Gabriel faz o merge; agentes não fazem merge, deploy nem force push (foi negado uma vez). Para atualizar a branch, faça merge da `main` nela.
- Antes de encerrar: commit, push e entrada no diário do WORKBOARD.
- Próxima migration livre: **028** (reserve no WORKBOARD antes do primeiro commit).
- Conteúdo publicado: 246 objetivas e 35 discursivas (2011–2021) conferidas por agente; 2005/2008 discursivas pendentes (padrão sem blocos).
- Funções prontas: banco de questões, caderno de erros espaçado, treino parcial e por área (com cronômetro opcional), provas completas (`/provas`), discursivas com autoavaliação, turmas/aulas/presença, painel do professor, papéis e administração, importação de provas, registro de atividades, **meta diária, conquistas, ranking de constância, flashcards (FSRS-5) e biblioteca** (ver `docs/FLASHCARDS.md`).
- Validação mais recente (banco `enade_ci`): `npm test` 166/168 (as 2 falhas são de pypdf local), Playwright 65/65, pacote inicial **499,6 kB** (aviso em 500 kB, erro em 1 MB).

## 2. Como rodar e testar

- Node 24, PostgreSQL 17 (`docker compose`), `.env` local (nunca commitar `.env`, `.local/` nem PDFs).
- Testes usam outro banco: troque **só o fim** da URL — `DATABASE_URL="${DATABASE_URL%/enade}/enade_ci"`. Trocar `/enade` no meio troca o usuário e os testes travam sem erro claro.
- `npm run db:migrate`, `npm test`, `npm run build`, `CI=1 CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test`.
- Nada fixo com `role="status"` no app shell: os E2E usam `getByRole('status')` para a resposta (o aviso de conquista usa só `aria-live`).

## 3. Regras de código e design (obrigatórias)

- Angular 22 sem zone, signals, `templateUrl` + `styleUrl`: **HTML, CSS e TS separados por componente**; CSS novo vai no componente, não no `styles.css` global.
- Funções pequenas, nomes claros, comentários curtos em pt-BR explicando o porquê.
- Telas novas carregam sob demanda (`@defer`) para não estourar o pacote inicial.
- Visual "caderno": papel `#f4f3ef`, tinta `#151e2f`, azul `#1649ae`, capa `#0f285a`, serifa para títulos e mono para rótulos. Sem emoji como ícone; ícones em SVG próprio (`badge.component.html`).
- Movimento: curvas `cubic-bezier(0.22, 1, 0.36, 1)`, 300–600 ms, sem laços infinitos; respeitar `prefers-reduced-motion`.
- Celular primeiro: conferir 320, 390, 768 e 1440 px; sem rolagem horizontal; alvos de toque ≥ 44 px; topo fixo não pode cobrir o foco (use `focus({ preventScroll: true })` após rolar ao topo).
- Conteúdo escrito por IA é sempre sinalizado na tela ("Gerado por IA") e no dado.

## 4. Mascote (planejado, ainda não feito)

Proposta aceita para avaliação de Gabriel: **patinho de borracha** (referência ao *rubber duck debugging*: explicar para o pato = prática de recuperação), amarelo `#F6C945`, bico `#F08A2C`, com um lápis azul-marinho atrás da cabeça como traço marcante. Nomes sugeridos: Dudu, Bit, Quack.

Gabriel vai gerar as imagens no Gemini (Nano Banana). Ordem: (1) personagem e vistas; (2) folha de 10 expressões; (3) ícone do app em 3 fundos; (4) cena da página pública; (5) poses por momento. A partir do 2º, anexar sempre a imagem escolhida do 1º e repetir o bloco de estilo:

```
STYLE LOCK: soft 3D clay/vinyl toy render, rounded chunky shapes, matte surface with subtle subsurface glow, soft studio key light from top-left, gentle contact shadow, no outlines, no text, no logos. Palette only: duck body warm yellow #F6C945 with lighter belly #FCE7A1, beak and feet orange #F08A2C, eyes deep navy #151E2F with one small white highlight, brand navy #0F285A, brand blue #1649AE, paper off-white #F4F3EF, accent amber #B77B29. Friendly, clever, calm — a study buddy for university Computer Science students, not a baby toy.
```

Quando as imagens chegarem:
- recortar o fundo liso, exportar WebP (e PNG para ícones), em `apps/web/public/mascot/`;
- usar só em momentos: página pública, meta batida (aviso), fim dos flashcards, telas vazias, erro/404, favicon e ícones PWA. Ícones da interface continuam SVG;
- carregar com `loading="lazy"` e `alt` descritivo (ou `alt=""` quando decorativo); nunca no pacote inicial;
- uma expressão por momento (comemorando na meta, estudando nos flashcards, pensando no vazio).

## 5. O que falta (por prioridade)

1. **Deploy em VPS própria e domínio** (Gabriel comprando). `deploy/vps/` foi feito para dividir o servidor do Mira; adaptar para Caddy próprio com HTTPS do domínio. Nomes sugeridos: cadernocc.com.br (preferido), bitabit.app, gabaritou.com.br. Só publicar com autorização.
2. **Revisão humana** dos 135 flashcards e 12 fichas (escritos por IA) por um professor; depois, trocar o selo para "Revisado por …".
3. **CQ-2**: revisão integral do código para a Fábrica de Software (obrigatória, ainda não iniciada).
4. **Mascote** (seção 4).
5. **Plano até a prova** (aparece como "Em breve" na Biblioteca): semanas até a prova + áreas mais fracas (`/api/me/progress`) → roteiro semanal.
6. **Materiais por área** ("Em breve"): PDFs e links dos professores; precisa de migration, upload no admin e licença de uso.
7. Discursivas de 2005 e 2008 (padrão de resposta sem blocos; recorte manual).
8. Reduzir o pacote inicial (está no limite): mover mais telas para `@defer`, revisar CSS global.

## 6. O que pode melhorar

- Flashcards: cartões com imagem/código, modo "digitar a resposta", criar cartão a partir de uma questão errada, otimizar os pesos do FSRS por pessoa quando houver ~400 revisões (`flashcard_review` já guarda tudo), meta diária contando flashcards também.
- Conquistas: medalhas por área e por prova completa por edição; compartilhar medalha como imagem.
- Ranking por turma (professor vê a constância da turma no painel).
- PWA (instalar no celular, lembrete diário por notificação) — o ícone do mascote serve aqui.
- Modo escuro (tokens já existem em `styles.css`, falta a variante).
- Acessibilidade: auditoria WCAG 2.2 com leitor de tela nas telas novas.
