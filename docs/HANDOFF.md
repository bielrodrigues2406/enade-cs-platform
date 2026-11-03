# Passagem para o próximo agente (03/11/2026)

Leia antes: `AGENTS.md`, `docs/WORKBOARD.md` (diário no fim, reservas de migration), `docs/ENGINEERING-AND-DELIVERY.md` §1.3 (manutenção humana) e `docs/UX-DESIGN-SPEC.md`. Responda a Gabriel sempre em pt-BR.

## 1. Estado atual

- Base da auditoria DS-5: `main` em `0db9671` (PRs #31–#37 integrados). MAS-4 foi integrado no PR #37 após revisão e CI completo: 182 API, 82 Chromium e imagem de produção. Veja MASCOT §10.
- Gabriel autorizou nesta conversa criar PR e fazer merge após revisão/validação, com commits preservados e descrições curtas. Essa autorização não inclui deploy nem force push. Para atualizar a branch, faça merge da `main` nela.
- Antes de encerrar: commit, push e entrada no diário do WORKBOARD.
- Migrations reservadas: **028** para MAS-2 e **029** para SIM26-1. Próxima livre: **030**; conferir WORKBOARD antes de reservar.
- Conteúdo integrado no PR #33: 246 objetivas com explicação e 39 discursivas, incluindo quatro de 2005/2008, conferidas por agente. Ainda faltam cinco padrões antigos de Formação Geral e os 33 PDFs recentes; não chamar essas edições de integralmente completas.
- Funções prontas: banco de questões, caderno de erros espaçado, treino parcial e por área (com cronômetro opcional), provas completas (`/provas`), discursivas com autoavaliação, turmas/aulas/presença, painel do professor, papéis e administração, importação de provas, registro de atividades, **meta diária, conquistas, ranking de constância, flashcards (FSRS-5) e biblioteca** (ver `docs/FLASHCARDS.md`).
- Main `08ecdf7` contém a árvore revisada `0e02ba7` do PR #35: CI completo passou com 182 API e 76 Chromium; pacote inicial **494,36 kB**. Acervo real montou 45+1 com 47 FG/159 específicas/16 discursivas elegíveis. Não confundir essas verificações com deploy: Gabriel informou que a plataforma não está rodando.

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

## 4. Mascote

**Dudu articulado:** as quatro poses sem acessórios usam seis camadas transparentes. Acena com uma asa, comemora com as duas, inclina a cabeça e pisca; os gestos terminam em 610 ms. Leitura e ritmo continuam estáticos, com movimento reduzido e preferência de ocultar respeitados. Fontes/proveniência em `design/mascot/articulated/`; implementação lazy, sem biblioteca nova e com pose estática de reserva. Poses com acessórios mantêm a arte anterior. Não há laços de piscada/respiração nem olhos seguindo cursor. Enquadramento e pivôs ficam no CSS.

## 5. O que falta (por prioridade)

1. **Deploy em VPS própria e domínio** (Gabriel comprando). `deploy/vps/` foi feito para dividir o servidor do Mira; adaptar para Caddy próprio com HTTPS do domínio. Nomes sugeridos: cadernocc.com.br (preferido), bitabit.app, gabaritou.com.br. Só publicar com autorização.
2. **Design aplicado (DS-6/7/8):** [implementação e validação](reviews/2026-11-03-design-implementation.md). PR #39 integrado; #40/#41 entram após CI do HEAD final. Menu A com **Questões/Treinar/Revisar/Apoio**, conta reunida, rotas estáveis, filtros compactos, curadoria paginada/gabarito explícito, tabelas e formulários corrigidos, Início/Biblioteca/Conquistas enxutos. As propostas antigas ficam como histórico. Preservar o nome Questões, escolhido por Gabriel. Capturas locais: 128/37 estados, mais dobras/menu. Antes de repetir a auditoria inteira, verificar se há achado novo.
3. **Revisão humana** dos 135 flashcards e 12 fichas (escritos por IA) por um professor; depois, trocar o selo para "Revisado por …".
4. **CQ-2**: revisão integral do código para a Fábrica de Software (obrigatória, ainda não iniciada). A auditoria de design não a substitui.
5. **Conteúdo:** 33 PDFs recentes, cinco padrões antigos de FG e fonte legível para 2005 Q60. Quatro discursivas 2005/2008 já entraram no PR #33; não listar novamente todas essas edições como pendentes.
6. **Operação/acessibilidade:** texto de privacidade institucional (LGL-1), leitor de tela e estados de erro ainda não auditados. Pacote inicial em 434,70 kB no lote de design; preservar carregamento lazy e evitar aumentar o shell.

**Depois do essencial, sem bloquear o próximo lote:** Plano e Materiais, hoje "Em breve" na Biblioteca. Validar necessidade antes de adicionar migration, upload ou fluxos novos. Poses do mascote com acessórios/cenas exigem artes próprias; MAS-4 básico já está integrado e não exige nova biblioteca de animação.

## 6. O que pode melhorar

- Flashcards: cartões com imagem/código, modo "digitar a resposta", criar cartão a partir de uma questão errada, otimizar os pesos do FSRS por pessoa quando houver ~400 revisões (`flashcard_review` já guarda tudo), meta diária contando flashcards também.
- Conquistas: medalhas por área e por prova completa por edição; compartilhar medalha como imagem.
- Ranking por turma (professor vê a constância da turma no painel).
- PWA (instalar no celular, lembrete diário por notificação) — o ícone do mascote serve aqui.
- Modo escuro (tokens já existem em `styles.css`, falta a variante).
- Acessibilidade: auditoria WCAG 2.2 com leitor de tela nas telas novas.
