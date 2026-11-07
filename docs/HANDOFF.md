# Passagem para o próximo agente (03/11/2026)

Leia antes: `AGENTS.md`, `docs/WORKBOARD.md` (diário no fim, reservas de migration), `docs/ENGINEERING-AND-DELIVERY.md` §1.3 (manutenção humana) e `docs/UX-DESIGN-SPEC.md`. Responda a Gabriel sempre em pt-BR.

## 1. Estado atual

- **AUD-C1, PR #61 (07/11):** [revisão rigorosa do progresso e do experimental](reviews/2026-11-07-claude-review.md), main auditada `e3538df` (PRs #51–#59). **Correções R1–R10 ainda pendentes:** primeiro resolver caminhos de figuras no Docker e imprecisões conceituais; depois vínculos históricos, métricas e consistência dos fluxos. Material tem 163 geradas/23 lições, mas ainda não está certificado integralmente. Antes de ampliar, melhorar duas ou três lições piloto com explicação, condições, contraexemplo, transferência e fonte realmente consultada (edição/versão/seção). Não inventar citação de Tanenbaum ou outro autor. Há script/recibo de 13 cálculos no relatório; build/231 API/20 Chromium selecionados passaram localmente. Sem alteração da aplicação, publicação ou AWS. PR #60 de modo escuro não está abrangido pelos testes.
- Gabriel publicou `https://cadernocc.com.br` em Docker Compose numa EC2 dos EUA (04/11) e relatou a plataforma online e funcionando em 06/11. PROD-CSS1 corrige estilos Angular bloqueados pela CSP e cache de chunks; ver [diagnóstico de produção](reviews/2026-11-04-production-css.md). O servidor não foi acessado por SSH nesta análise. Não desativar a CSP como contorno.
- Base do ajuste SIM-UX1: `main` em `c6d6d5c`, com DS-6/7/8 integrados nos PRs #39–#41. A auditoria DS-5 usou `0db9671`; MAS-4 já está integrado no PR #37. Veja MASCOT §10.
- Gabriel autorizou criar PR e fazer merge após revisão/validação, com commits preservados e descrições curtas. Também pediu o deploy no servidor IFSP PEP; faltam acesso SSH e domínio para concretizá-lo. Não fazer force push. Para atualizar a branch, faça merge da `main` nela.
- Antes de encerrar: commit, push e entrada no diário do WORKBOARD.
- **ERR-UX1, PR #50:** mensagens de erro e manutenção preparadas por pedido adicional de Gabriel; integração condicionada às verificações finais. [Operação e contrato](SERVICE-MESSAGES.md): helper HTTP tipado sem retry automático, aviso informativo programado e fallback Caddy independente do app. Manter status/conflitos/rascunhos; 503 comum não comprova manutenção. Arquivos do proxy precisam ser instalados no host pelo operador; não houve SSH/deploy.
-Preparação para publicar no servidor do câmpus IFSP (`ADM-2`, `DEP-4` e `SEC-AUDIT` em 03/11):
  - **Manutenção administrativa de contas (`ADM-2`) pronta:** modal `Gerenciar` em Administração permite corrigir nome, prontuário e e-mail (com senha do admin), redefinir senha provisória (encerrando sessões), revogar sessões avulsas e excluir conta/dados de estudo conforme LGPD (`POST /api/admin/accounts/:id/delete`), além do CLI de servidor `admin:role grant|revoke|reset-password|delete-account`.
  - **Docker e scripts de ciclo de vida do câmpus (`DEP-4`) prontos em [`deploy/campus/`](../deploy/campus/README.md):** `docker-compose.yml` isolado (sem depender de Caddy/VPS externa, aceita caracteres especiais em `POSTGRES_PASSWORD` via `PGPASSWORD`), `atualizar.sh`, `backup.sh`, `desligar.sh` (para encerrar o mês 11 com backup verificado por SHA-256 sem perder volumes) e `restaurar.sh` (para religar ou migrar para outro servidor da Fábrica de Software), além de `nginx.conf.example`. Veja `docs/DEPLOY.md` §5.1–§5.2.
  - **Auditoria completa de segurança (`SEC-AUDIT`):** [relatório completo](reviews/2026-11-03-full-security-audit.md) e [revisão preliminar](reviews/2026-11-03-security-privileges.md). Endurecidos cookie `__Host-enade_session` contra *cookie tossing* entre subdomínios `*.ifsp.edu.br`, `Sec-Fetch-Site`, limites em NAT compartilhado do câmpus com reembolso pós-login, vínculo prontuário+e-mail nas turmas, proteção contra injeção de fórmulas no CSV e limites de memória/páginas na importação de PDFs.
- Migrations reservadas: **028** para MAS-2 e **029** para SIM26-1. Próxima livre: **030**; conferir WORKBOARD antes de reservar.
- Conteúdo integrado no PR #33: 246 objetivas com explicação e 39 discursivas, incluindo quatro de 2005/2008, conferidas por agente. Ainda faltam cinco padrões antigos de Formação Geral e os 33 PDFs recentes; não chamar essas edições de integralmente completas.
- Funções prontas: banco de questões, caderno de erros espaçado, treino parcial e por área (com cronômetro opcional), provas completas (`/provas`), simulado no formato ENADE 2026, discursivas com autoavaliação, turmas/aulas/presença, painel do professor, papéis e manutenção administrativa de contas, importação de provas, registro de atividades, **meta diária, conquistas, ranking de constância, flashcards (FSRS-5) e biblioteca** (ver `docs/FLASHCARDS.md`).
- Main `b4c8146` contém até o PR #43 (`SEC-UI1`), seguido da entrega `ADM-2` + `DEP-4` + `SEC-AUDIT`. Rodapé global expira automaticamente a data fixa `29 de novembro` após `29/11/2026`. Não confundir validações locais/CI com deploy: a subida física no servidor do câmpus será executada pela equipe local usando `deploy/campus/README.md`.

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
- Movimento: curvas `cubic-bezier(0.22, 1, 0.36, 1)`, 300–600 ms na interface e 1,1 s nos gestos do mascote, sem laços infinitos; respeitar `prefers-reduced-motion`.
- Celular primeiro: conferir 320, 390, 768 e 1440 px; sem rolagem horizontal; alvos de toque ≥ 44 px; topo fixo não pode cobrir o foco (use `focus({ preventScroll: true })` após rolar ao topo).
- Conteúdo escrito por IA é sempre sinalizado na tela ("Gerado por IA") e no dado.

## 4. Mascote

**Dudu articulado:** as quatro poses sem acessórios usam seis camadas transparentes. Acena com uma asa, comemora com as duas, inclina a cabeça e pisca; os gestos terminam em 1,1 s. Leitura e ritmo continuam estáticos, com movimento reduzido e preferência de ocultar respeitados. Fontes/proveniência em `design/mascot/articulated/`; implementação lazy, sem biblioteca nova e com pose estática de reserva. Poses com acessórios mantêm a arte anterior. Não há laços de piscada/respiração nem olhos seguindo cursor. Enquadramento e pivôs ficam no CSS.

## Questões geradas por IA (GEN-1, 06/11)

120 questões por área em `data/generated-questions/`, separadas das oficiais (filtro "Origem" no banco, botão no núcleo). Formato, regras de qualidade, conferência e próximos lotes em **`docs/GENERATED-QUESTIONS.md`**.

## Núcleo por área (NUC-1, 06/11)

A bússola da preparação está em **`docs/CORE-CONCEPTS.md`**: 16 áreas e a Formação Geral com conceitos, fatos que cortam alternativas, pares, pistas e pegadinhas, ligados às questões oficiais, com autoavaliação e confiança por área na Biblioteca. Próximos incrementos para a reta final na seção 7 desse documento.

## Evolução da prova e imagens (06/11)

[ENADE-EVOLUTION.md](ENADE-EVOLUTION.md) mede como formato e áreas mudaram de 2005 a 2021 e o que muda na geração. [IMAGE-PROMPTS.md](IMAGE-PROMPTS.md) lista as imagens: SVG para diagramas exatos (o agente faz) e prompts de GPT Image para ilustrações (Gabriel gera e envia).

## Próxima sessão: plano da reta final (07/11)

O plano completo, com a ordem dos PRs (A a H), metas até 29/11 e o critério de "pronto" de cada etapa, está em **[PLANO-RETA-FINAL.md](PLANO-RETA-FINAL.md)**. Os PRs A, B, C e D estão feitos (o C em parte: faltam enunciados longos, que passam ao PR E). O PR D, piloto das lições da Biblioteca ([LIBRARY-LESSONS.md](LIBRARY-LESSONS.md)), aguarda a leitura de Gabriel antes do PR F. Siga pelo PR E (lote 2 de questões).

- **Material pronto:**
  - 41 ilustrações em `apps/web/public/illustrations/`, com catálogo em `data/illustrations/catalog.json`;
  - poses novas do Dudu (`novidade`, `plano`, `forca`).
- **Migrations:** 032 usada (GEN-4); 033 reservada (NEWS-1).

## 5. O que falta (por prioridade)

1. **Preservar a publicação AWS em cadernocc.com.br:** Gabriel relatou funcionamento em 06/11. Conferências operacionais de backups/restauração continuam próprias; não reabrir o diagnóstico CSS como falha atual sem evidência. O mesmo Compose de [`deploy/campus/`](../deploy/campus/README.md) serve como referência; eventual implantação IFSP PEP depende da infraestrutura institucional.
2. **Design aplicado (DS-6/7/8):** [implementação e validação](reviews/2026-11-03-design-implementation.md). PRs #39–#42 integrados. Preservar o nome Questões, escolhido por Gabriel.
3. **Revisão humana** dos 135 flashcards e 12 fichas (escritos por IA) por um professor; depois, trocar o selo para "Revisado por …".
4. **CQ-2**: revisão integral do código para a Fábrica de Software (obrigatória antes da passagem institucional definitiva).
5. **Conteúdo:** 33 PDFs recentes, cinco padrões antigos de FG e fonte legível para 2005 Q60.
   Plano de expansão proposto em [CONTENT-EXPANSION-PLAN.md](CONTENT-EXPANSION-PLAN.md): inventário local de cobertura, matérias prioritárias, pesquisa ENADE SI/ADS e piloto de 20–30 candidatas. Na fase inicial, origem ENADE; PND/POSCOMP separados. Pesquisa, taxonomia e publicação são tarefas futuras, não questões novas já importadas. Gate antes de outro curso: curso/cobertura visíveis e elegibilidade de edições e do formato 2026 preservada.
   **Guia ENADE experimental (EST-EXP1):** [proposta e prompt expandido](ENADE-STUDY-LAB.md) para histórico por tema/edição, guias aprofundados, pesquisa de temas atuais e exercícios autorais, dentro da Biblioteca. Seis edições não justificam chances de cair; usar estatística descritiva e separar atualidade, matriz e evidência histórica. Funcionalidade ainda não implementada. Primeiro incremento deve tratar taxonomia/cobertura e obter matriz; pilotos com dois guias e três dossiês. Corrigir no incremento funcional a perda do contexto da área no CTA de treino e retirar/fundamentar “Cai todo ano” na ficha de complexidade.
   **EST-BASE1:** [inventário executável](../data/study-analysis/README.md) e artefato reproduzível: 460 ocorrências históricas, 246 aprovações objetivas/39 discursivas em arquivos, 30 relações de duplicidade documentadas e 71 grupos candidatos por texto. Estados analíticos/identidade canônica e incidência continuam pendentes/nulos. Não é consulta à produção nem prova de publicação. Portarias 157/154 de 2026 localizadas no índice do Inep; textos DOU retornaram 403. Próximo incremento: amostra da taxonomia conferida independentemente, classificação por tema/habilidade e panorama. Nenhuma tela nova entregue nesta etapa.
6. **Operação/acessibilidade:** revisão institucional do texto de privacidade (LGL-1) e auditoria com leitor de tela. Pacote inicial em ~435,8 kB; preservar carregamento lazy.

**Depois do essencial, sem bloquear o próximo lote:** Plano e Materiais, hoje "Em breve" na Biblioteca. Validar necessidade antes de adicionar migration, upload ou fluxos novos. Poses do mascote com acessórios/cenas exigem artes próprias; MAS-4 básico já está integrado e não exige nova biblioteca de animação.

## 6. O que pode melhorar

- Flashcards: cartões com imagem/código, modo "digitar a resposta", criar cartão a partir de uma questão errada, otimizar os pesos do FSRS por pessoa quando houver ~400 revisões (`flashcard_review` já guarda tudo), meta diária contando flashcards também.
- Conquistas: medalhas por área e por prova completa por edição; compartilhar medalha como imagem.
- Ranking por turma (professor vê a constância da turma no painel).
- PWA (instalar no celular, lembrete diário por notificação) — o ícone do mascote serve aqui.
- Modo escuro (tokens já existem em `styles.css`, falta a variante).
- Acessibilidade: auditoria WCAG 2.2 com leitor de tela nas telas novas.
