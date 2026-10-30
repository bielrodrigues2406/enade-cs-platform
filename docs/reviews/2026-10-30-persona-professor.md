# Avaliação de professor e coordenação: Prof. Ricardo (IFSP PEP)

Data: 30/10/2026, 30 dias antes da prova. Ambiente: web local `http://localhost:4200`, API `:3000`, base `d162334` (branch `claude/confident-cray-ndnwmk`, igual a `origin/main`). Nenhum arquivo do repositório foi alterado.

## Resumo em 5 linhas

1. A plataforma é um bom caderno de estudo **individual**, com procedência honesta das questões, versões imutáveis e métricas que mostram o denominador. Ainda **não existe nada para professor ou coordenação**: não há turma, aula, sala, presença, painel nem relatório.
2. Para o aluno, o acervo real ainda é mínimo: 3 demos e 5 oficiais só em prévia local. Nenhuma área tem 10 questões, então o treino parcial não abre. Hoje eu não conseguiria passar uma lista por área à turma.
3. O histórico de respostas guarda só a **última escolha**. Refazer logo após ver o gabarito apaga o erro e infla o acerto. Qualquer painel docente construído sobre isso mostraria números enganosos.
4. As contas não confirmam o e-mail, não recuperam senha e não têm nome, prontuário, aviso de privacidade nem exclusão. Isso não sustenta vínculo aluno↔turma nem dados de presença sob a LGPD.
5. Para a FSA manter o produto faltam licença, repositório institucional, guia de onboarding humano (a documentação atual é voltada à coordenação Claude×Codex), administração de papéis com auditoria e configuração de edição em dados, em vez de código.

## Como avaliei

- **Navegação real com Playwright/Chromium**, scripts em `/tmp/claude-0/personas/professor/*.cjs` e capturas em `/tmp/claude-0/personas/professor/shots/`. Visitei o início e o banco sem conta, criei uma conta de professor, filtrei por área e respondi questões com erros propositais. Também passei pelo caderno de erros, refiz uma questão, abri o treino parcial, conferi o layout em 390 px e testei URLs que um professor tentaria.
- **Leitura** de README, MASTER-SPEC, ARCHITECTURE, WORKBOARD, API, ADR-002/003/005/007, DEPLOY, ENGINEERING-AND-DELIVERY, das revisões em `docs/reviews/`, das migrations e de `apps/api/src` e `apps/web/src`.
- **Limitações:**
  - Sem papel de curadoria, não exercitei a tela de curadoria; li o código.
  - O banco de desenvolvimento é compartilhado. Durante a sessão, fixtures de testes de outra execução ("Fixture caderno 1…21", "TEST ONLY treino · Questão 10…") apareceram no catálogo da minha conta: o total foi de 8 para 38, depois 29, depois 8.
  - Não consegui ler o texto da Portaria Inep nº 157/2026: `mecnormas.mec.gov.br` e `abmes.org.br` estão fora da rede permitida nesta sessão. Uma busca confirmou que a portaria existe (14/04/2026) e trata do componente específico de Ciência da Computação.
  - Não houve alunos reais, leitor de tela nem Firefox/WebKit.
- **Dado deixado no banco local:** a conta `prof.ricardo.persona.1793379960959@example.test`, com 4 respostas. Não há como excluí-la pela interface (ver P0-2).

---

## Achados priorizados

### P0: impedem o uso pretendido por professores e coordenação

**P0-1. Não há papel, telas ou dados de professor, turma, aula, sala, presença ou relatório.**
- *Evidências:*
  - `/professor`, `/turmas`, `/aulas`, `/presenca`, `/relatorios`, `/admin` e `/desempenho` respondem 200 e mostram o "Banco de questões", com a URL inalterada (`shots/03-url-professor.png`).
  - `GET /api/curation/access` → `{"canCurate":false}`. Os únicos papéis existentes são conta comum e `curator_role` (`migrations/003_editorial_workflow.sql:1`).
  - Nenhuma migration (001–012) tem turma, aula, sala ou presença. A auditoria AUD-2 (`docs/reviews/2026-10-29-study-readiness.md`) registra "Há função específica de professor/turmas? Não… turmas ficam adiadas".
- *Impacto:* nenhum dos meus objetivos (quem está se preparando, presença, aulas, salas, relatório) é atendido. A planilha Excel continua sendo o sistema.
- *Sugestão:* criar um incremento próprio, "Preparação presencial", **desacoplado das contas de aluno** na primeira fatia:
  - professores convidados;
  - roster da turma importado de CSV (nome, prontuário, e-mail institucional);
  - aulas com sala e professor;
  - chamada no celular;
  - exportação CSV/XLSX no formato da planilha atual.

  Esse caminho não depende de alunos criarem conta, nem de conteúdo publicado, e expõe menos dados. O painel de desempenho fica para uma etapa posterior (P1-1). Modelo na seção "Proposta de modelo de dados".

**P0-2. A conta não serve como identidade institucional e não há base LGPD para vincular aluno à turma.**
- *Evidências:*
  - O cadastro pede só e-mail e senha (`shots/10-register-form.png`) e avisa: "o e-mail ainda não é confirmado e não há recuperação de senha".
  - ADR-002 §Limites: sem confirmação de e-mail, recuperação/troca de senha, MFA, exclusão de conta ou política de retenção.
  - O aviso de privacidade (LGL-1) está em backlog sem dono. O cabeçalho mostra o e-mail, mas não há página de conta para ver, exportar ou apagar dados.
- *Impacto:* não dá para confiar que "fulano@…" é o aluno da turma. Um professor que esquecer a senha perde o acesso. Não há finalidade, retenção nem canal do titular declarados.
- *Sugestão:*
  - verificação de e-mail obrigatória para qualquer papel além de aluno;
  - recuperação de senha;
  - nome e prontuário opcionais, preenchidos apenas no vínculo com a turma;
  - aviso de privacidade versionado, com ciência registrada;
  - exclusão ou anonimização de conta;
  - MFA (TOTP) para professor e administrador.

  Validar finalidade, base legal e retenção com o Encarregado de Dados (DPO) do IFSP antes de lançar presença ou desempenho individual.

**P0-3. O conteúdo disponível não permite aplicar nada à turma.**
- *Evidências:*
  - O catálogo tem 8 itens: 3 demos e 5 oficiais de 2021 em prévia local (`shots/02-banco-anon-1440.png`). README: "nenhuma questão oficial publicada nesta entrega".
  - Treino: "8 questões publicadas disponíveis… Para 20 questões, faltam 12", com o botão desabilitado (`shots/41-treino.png`).
  - Por área: 0 em Teoria da computação, Matemática, Segurança e outras dez áreas; no máximo 2 por área.
  - Segundo AUD-2, há 11 aprovadas por imagem que continuam privadas.
- *Impacto:* para a preparação de novembro de 2026, o sistema não substitui o material que o professor já usa.
- *Sugestão:*
  - publicar já os itens aprovados;
  - priorizar os lotes pelas áreas das aulas marcadas, não só por ano da prova;
  - mostrar ao professor a cobertura por área (questões publicadas, revisadas e bloqueadas) para planejar a aula.

### P1: distorcem dados ou dificultam muito o uso docente

**P1-1. O histórico de respostas é sobrescrito: o erro desaparece ao refazer.**
- *Evidências:*
  - `answer` tem `PRIMARY KEY (owner_id, question_id)` (`migrations/001_base.sql:35`, renomeada na 002) e o salvamento faz `ON CONFLICT … DO UPDATE` (`apps/api/src/main.ts:199`). ADR-005: "não há histórico de cada alteração dentro de uma versão".
  - Reprodução (`08-retry.cjs`, `shots/60-retry.png`): resumo antes `{"answered":4,"correct":0,"incorrect":4}`. Errei a demo de Redes, vi o feedback "Alternativa correta: TCP", cliquei "Tentar novamente", marquei TCP e o resumo passou a `{"correct":1,"incorrect":3}`. A questão saiu do caderno.
- *Impacto:*
  - acerto "na última resposta" mede memória do gabarito recém-visto, não aprendizagem;
  - não existe acerto de primeira tentativa, a métrica mais útil para o professor;
  - um painel de turma sobre essa tabela seria otimista e enganoso.
- *Sugestão:* manter um evento de resposta somente de inserção. Cada evento registra:
  - número da tentativa;
  - contexto (estudo livre, caderno, treino, lista, simulado);
  - tempo desde a resposta anterior.

  Derivar "primeira tentativa" e "recuperado após N dias". O caderno passa a usar espaçamento (resposta à pergunta 4).

**P1-2. A classificação mistura área e assunto num único campo livre.**
- *Evidências:*
  - O catálogo só reconhece área se `topic` for exatamente um dos 18 nomes: `CASE WHEN q.topic=ANY($8::text[])` (`apps/api/src/catalog.ts:47`).
  - O editor da curadoria tem um campo "Assunto" de texto livre (`apps/web/src/curation.component.ts:395`). Uma questão autoral de "Normalização" fica "sem classificação".
  - O filtro "Assunto" repete os nomes do filtro "Área" (`shots/20-banco-redes.png`).
  - A lista de 18 áreas está em `apps/api/src/question-areas.ts` **e** num `CHECK` da `migrations/012_partial_practice.sql:9`: mudar uma área exige migration.
  - Não há mapeamento documentado para a Portaria Inep 157/2026, embora o MASTER-SPEC §5 exija "mapeamento auditável". As tabelas `Topic`/`QuestionTopic` da ARCHITECTURE §3 não existem.
  - Na prévia local (dado de teste), a Q12/2021, sobre LGPD, aparece como "Redes" (`shots/21-questao-oficial.png`); no arquivo real `data/agent-reviews/…q9-q16.json` ela está BLOCKED e sem área. Não é um erro publicado, mas mostra que nada no sistema revisa a classificação.
- *Sugestão:* taxonomia em dados, por edição, em três níveis:
  - área;
  - conteúdo da portaria (com referência a artigo/inciso);
  - competência, opcional.

  Uma questão pode ter mais de um conteúdo, um deles principal. A classificação tem autor e revisor. A área deixa de ser um `CHECK` de migration.

**P1-3. Papéis são concedidos por CLI com UUID, sem auditoria nem escopo.**
- *Evidências:*
  - `npm run curator:role -- grant <identity-uuid>` exige acesso direto ao banco (README §Acesso à curadoria, `scripts/curator-role.ts`).
  - `curator_role` só tem `identity_id`: não guarda quem concedeu, quando, por quê nem até quando.
  - Em produção, o mesmo comando roda no shell do contêiner (DEPLOY §5.8).
- *Impacto:* com turmas da FSA mudando todo ano, ninguém saberá por que alguém é curador. Também não há como dar a um professor acesso apenas à própria turma.
- *Sugestão:* uma tabela de atribuição de papéis com escopo e trilha de auditoria, convite por e-mail institucional verificado e tela de administração. O CLI fica só para criar o primeiro administrador.

**P1-4. Não dá para apontar a turma para uma questão ou para o caderno.**
- *Evidências:*
  - Ao abrir uma questão, a URL continua `/questoes?area=Redes` (`03-study.cjs`).
  - No caderno de erros, a URL é `/questoes` e o reload leva ao "Banco de questões" (`07-mobile.cjs`: "após reload, h1 = Banco de questões").
  - O roteamento é manual, sem Angular Router, num componente raiz de 1.583 linhas (`apps/web/src/main.ts`).
- *Impacto:* não consigo mandar "resolvam a Q28 de 2021" no grupo da turma.
- *O que já funciona:* o link de seleção filtrada (`/questoes?area=Redes&year=2021`).
- *Sugestão:* rotas próprias para `/questoes/:id`, `/caderno` e, no futuro, `/listas/:id`.

**P1-5. Explicações de IA sem revisão humana, sem caminho para o docente endossar ou corrigir.**
- *Evidência:* na questão oficial aparece "Explicação gerada por IA (Codex), sem revisão humana" (`shots/52-questao-390.png`; decisão D11 no WORKBOARD). Não existe "relatar problema" na resolução.
- *Impacto:* não posso indicar a explicação em aula sem conferir cada uma.
- *Sugestão:*
  - botão "relatar problema", que gera um item na fila da curadoria;
  - selo "revisada por docente", aplicado por meio da nova versão que a curadoria já suporta;
  - filtro "somente explicações revisadas" para montar listas.

**P1-6. A entrega à FSA não está pronta.**
- *Evidências:*
  - não há arquivo `LICENSE`;
  - o remoto é `github.com/bielrodrigues2406/enade-cs-platform`, conta pessoal;
  - AGENTS.md, COLLABORATION.md e WORKBOARD (194 linhas, muitas com mais de 900 caracteres) descrevem o fluxo "Claude × Codex" e decisões "de Gabriel";
  - o README mistura situação do produto, setup, papéis, fontes, validação e importação;
  - não há guia de contribuição para humanos;
  - ARCHITECTURE §4 promete OpenAPI, mas nada é gerado (`grep swagger/openapi` vazio);
  - `npm test` e E2E usam o banco de desenvolvimento, e fixtures de teste apareceram no meu catálogo durante a sessão.
- *Sugestão:* ver a resposta à pergunta 7.

**P1-7. Data e formato da prova estão fixos no código.**
- *Evidências:* `const EXAM_DATE = new Date(2026, 10, 29)` (`apps/web/src/home.component.ts:33`). O formato 15/30/1 é um array no mesmo componente, com `aria-label` fixo: "O caderno treina hoje as objetivas de Computação".
- *Impacto:* para a próxima edição, outra turma terá de caçar constantes no front e no `CHECK` de migration.
- *Sugestão:* uma entidade "edição" em dados: data, formato por bloco, portaria e taxonomia vigente.

### P2: melhorias

- **P2-1.** Rotas desconhecidas mostram o banco de questões sem página 404 nem correção da URL (`shots/03-url-professor.png`).
- **P2-2.** O mapa "A prova de 2026" pinta de azul as 30 objetivas de Computação ("o que o caderno já treina") e deixa Formação Geral vazia, embora o catálogo tenha 1 de FG e só 7 de Computação (`shots/01-home-anon-1440.png`). Para a coordenação, isso pode parecer cobertura. Sugestão: mostrar "itens publicados por bloco" com números reais.
- **P2-3.** A 390 px, o recorte da questão oficial fica com letra muito pequena (`shots/52-questao-390.png`). O botão "Ampliar" resolve, mas convém deixá-lo mais evidente no celular.
- **P2-4.** A navegação usa `<button>` em vez de links. Não é possível abrir uma seção em nova aba, o que é útil ao professor que projeta uma questão enquanto consulta outra.
- **P2-5.** O CLI de papéis e o seed não criam dados sintéticos de professor, turma ou aluno para demonstração. Quando o módulo existir, o seed deve trazê-los marcados como fictícios.

---

## Respostas às perguntas do dono do produto

### 1. Perfis: o que cada um vê e faz; como cadastrar professores com segurança

| Perfil | Vê | Faz | Não vê |
| --- | --- | --- | --- |
| **Aluno** | Banco, treino, caderno de erros, as próprias aulas e presença, as listas e simulados atribuídos à sua turma e os próprios resultados | Estuda, responde listas e simulados, justifica falta, vincula a conta à turma por convite ou código | Dados de outros alunos, ranking |
| **Professor** | Turmas em que leciona: roster, aulas, presença, agregados da turma por área e por item e resultados individuais **apenas** em listas e simulados aplicados por ele | Cadastra aulas, lança presença, monta listas por área ou conteúdo, aplica simulado, exporta a chamada | Estudo livre individual dos alunos, turmas de outros professores |
| **Coordenação** | Relatórios consolidados: presença por aula e turma, participação, cobertura por área, resultados agregados de simulados | Exporta relatórios, acompanha a programação de aulas e salas | Respostas item a item de cada aluno, salvo necessidade justificada e registrada |
| **Curadoria** | Fila editorial, fontes, importação (já existe) | Cria e revisa questões, endossa explicações, trata problemas relatados | Dados de alunos; a separação atual já é correta (ADR-003) |
| **Administrador** | Contas, papéis, turmas, edições, log de acessos | Convida professores, concede e revoga papéis com escopo, configura edição e taxonomia | Não precisa ver desempenho de alunos |

Um professor pode acumular o papel de curadoria. Os papéis são independentes e não decorrem um do outro.

**Cadastro seguro de professores:**

1. O primeiro administrador é criado por CLI uma única vez, como já se faz com a curadoria, e registrado em ata.
2. Daí em diante, o administrador **convida** pelo e-mail institucional. O convite tem token aleatório de uso único, guardado só como hash (padrão já usado nas sessões), e expira em 72 h. O papel só é ativado depois que o convidado confirma o e-mail e define a senha.
3. Cada atribuição registra quem concedeu, quando, motivo, escopo (turma ou edição) e validade, por exemplo até o fim da edição. A revogação também é registrada.
4. Professor e administrador usam MFA (TOTP). Se a TI do câmpus oferecer login institucional (por exemplo, Google Workspace ou outro provedor OIDC), essa é a melhor opção para servidores, mas é preciso confirmar com a TI.
5. Nunca conceder papel pelo e-mail digitado nem por autodeclaração ("sou professor"). Esse princípio já está no README e deve ser mantido.
6. Conceder o papel de administrador deve exigir um segundo administrador, a mesma lógica de "quatro olhos" da curadoria.

### 2. Painel do professor: indicadores úteis, vaidade e exposição; LGPD

**Úteis de verdade (turma):**
- **Questões com mais erro na turma**, com a alternativa mais escolhida (distrator). É o que eu levaria para a aula seguinte.
- **Acerto de primeira tentativa por área ou conteúdo**, sempre com n (por exemplo, "12 de 31 em Redes, 8 alunos") e aviso de amostra pequena. Depende de P1-1.
- **Cobertura:** quantas questões a turma resolveu por área, comparada às áreas das aulas dadas.
- **Participação:** alunos ativos nas últimas 2 semanas e quem não abriu a lista ou o simulado atribuído. Interessa para intervir, não para punir.
- **Presença por aula e por aluno** (percentual e faltas justificadas).
- **Resultado consolidado de cada simulado:** por bloco (FG e específico), por área e por item.

**Úteis (por aluno, só dentro da turma):** presença, se fez as atividades atribuídas e o resultado nelas, e as 3 áreas com menor acerto de primeira tentativa, com n.

**Vaidade ou risco:**
- tempo online e número de logins;
- streak;
- ranking;
- "nota prevista no ENADE": o próprio produto, corretamente, diz que não estima nota;
- radar das 18 áreas com 1–2 questões em cada;
- total de questões respondidas sem considerar primeira tentativa.

**Expõe demais:**
- horários em que o aluno estuda (vigilância);
- caderno de erros e estudo livre individuais;
- respostas item a item fora de atividades atribuídas;
- qualquer lista ordenada por desempenho visível à turma.

**Regra que proponho:** o estudo livre é privado do aluno e só entra em agregados da turma, com um mínimo de 5 alunos por agregado para não identificar ninguém. O professor vê individualmente apenas o que atribuiu (listas e simulados) e a presença. O aluno vê exatamente o que o professor vê sobre ele.

**LGPD (pontos práticos; validar com o DPO do IFSP):**
- **Finalidade explícita:** "preparação para o ENADE <edição> no câmpus PEP". Nada de reutilizar os dados para avaliação disciplinar sem nova finalidade.
- **Minimização:** nome, prontuário e e-mail institucional. Sem CPF, telefone ou foto.
- **Falta justificada:** guardar só a categoria (por exemplo, "saúde", "trabalho", "outro") e um texto curto. **Não anexar atestado**, que contém dado de saúde, dado sensível pelo art. 5º, II, da LGPD. O atestado continua no fluxo institucional.
- **Retenção:** apagar ou anonimizar dados individuais N meses após a prova e manter só agregados anônimos para comparar edições.
- **Transparência e acesso:** aviso de privacidade versionado, ciência registrada, exportação e exclusão pelo titular. Também um log de quem consultou ou exportou dados individuais.
- **Exportações** (CSV para a coordenação) são registradas. O arquivo sai sem dados além dos necessários.
- **Base legal:** o próprio repositório já lembra que "consentimento não é uma solução universal" (ENGINEERING-AND-DELIVERY §5). Numa instituição pública a base provável é outra, mas a definição cabe ao DPO, não ao time de desenvolvimento.

### 3. Aulas de preparação: modelo mínimo, chamada rápida, faltas, exportação, alunos sem conta

**Modelo mínimo:** edição → turma → participantes (roster) → aula (data, início e fim, sala, professor ou professores, área ou matéria, tema, lista vinculada opcional, status agendada, realizada ou cancelada) → presença por participante. Detalhes na seção de modelo de dados.

**Chamada rápida em sala (celular):**
- Tela "Aula de hoje" com a lista do roster em botões grandes. Toque alterna entre ausente, presente e atrasado.
- Botão "marcar todos presentes", para depois corrigir as exceções.
- Busca por nome e contador "23 de 31 presentes".
- Cada toque é salvo com revisão, como o treino já faz (ADR-007: confirmação do servidor e retry sem perder estado). Ao final, "fechar chamada". Edições posteriores ficam registradas com quem e quando.
- Opcional e posterior: autochamada por código ou QR rotativo projetado na sala, válido por poucos minutos, com confirmação final do professor. Só funciona para alunos com conta e não deve ser o único caminho.

**Justificar falta:** o aluno com conta solicita (categoria e texto curto) ou o professor registra diretamente. O professor aprova ou recusa, e o status vira "justificada". Sem anexos de saúde.

**Exportação:**
- CSV/XLSX no **mesmo layout da planilha atual**. Peça uma cópia sem dados à coordenação para replicar as colunas.
- Formato sugerido: uma linha por participante (nome, prontuário), uma coluna por aula (data, matéria, sala) com P, F, J ou A, e ao final o total e o percentual de presença.
- Também um relatório por aula (lista de presentes) e o calendário de aulas com salas, para a coordenação.

**Alunos sem conta:** o roster é independente da conta. O participante existe com nome e prontuário, e a presença funciona sem conta nenhuma. Quando o aluno cria e verifica uma conta, ele a vincula ao participante:
- por convite enviado ao e-mail institucional;
- ou por código da turma, confirmado pelo professor.

Até lá, o participante não tem dados de estudo, e o painel deve mostrar isso como "sem conta vinculada", não como "0% de acerto".

### 4. Faz sentido "refazer a questão que errou"? Como deveria ser

Faz sentido, mas **não do jeito atual**. Hoje o feedback mostra a alternativa correta e a explicação. "Tentar novamente" pode ser clicado no mesmo minuto, e o acerto apaga o erro (P1-1). O aluno treina a memória do gabarito, e o sistema registra um sucesso que não houve.

Proposta pedagógica, compatível com 30 dias até a prova:
1. **Espaçar:** a questão errada só volta depois de 1 dia, depois de 3 e depois de 7 (caixas de Leitner). Sai do caderno após dois acertos espaçados, não um imediato. Prática de recuperação e prática distribuída estão entre as técnicas de maior utilidade na revisão de Dunlosky et al. (2013, *Psychological Science in the Public Interest*).
2. **Pedir o motivo do erro**, em um toque, antes de mostrar a explicação: não sabia o conceito, li errado, errei a conta, chutei, fiquei entre duas. Isso também alimenta o professor ("60% erraram a Q28 por não saber o conceito de bolha no pipeline").
3. **Pedir uma justificativa curta** ao refazer ("por que a alternativa escolhida é a correta?"), uma ou duas frases, autoexplicativas. Só para o aluno; nada é corrigido automaticamente.
4. **Marcar "acertei no chute"**, que coloca a questão no caderno mesmo com acerto (hipótese já registrada na revisão de 28/10).
5. **Preferir uma questão irmã** (mesmo conteúdo) em vez da mesma, quando houver acervo. Repetir o mesmo item mede memória; uma questão nova mede transferência. O MASTER-SPEC §7 já faz essa distinção.
6. **Revisão de véspera** (REV-2 do banco de ideias): lista curta dos conceitos errados com as explicações.

### 5. A classificação por área e conteúdo está adequada? O que falta para o professor usá-la

As 18 áreas amplas (`question-areas.ts`) são um primeiro nível razoável e cobrem os nomes que uso: Teoria da computação, Matemática, Banco de dados, Redes, Segurança. Para o meu uso faltam, porém:
- **Rastreabilidade à portaria da edição.** Não há tabela que ligue cada área ou conteúdo ao item da Portaria Inep 157/2026, como exige o MASTER-SPEC §5. Não consegui ler o texto da portaria nesta sessão (rede bloqueada) para conferir a lista; essa conferência precisa ser feita e registrada.
- **Segundo nível (conteúdo):** "Banco de dados → normalização, SQL, transações". O professor prepara aula por conteúdo, não por área.
- **Várias classificações por questão.** A Q12/2021 trata de LGPD e cabe em "Sociedade e ética" e "Segurança". Hoje só há um campo.
- **Bloco** (Formação Geral ou específico) e **tipo** (objetiva ou discursiva) como filtros, além de **ano**, que já existe.
- **Revisão da classificação**, com quem classificou e quem conferiu, separada da revisão do conteúdo.
- **Cobertura visível ao professor:** quantas publicadas, aprovadas e bloqueadas por área e conteúdo.

**Montar lista de exercícios para a aula:**
1. O professor filtra por área, conteúdo e ano.
2. Marca as questões e ordena.
3. Dá nome à lista ("Aula 05/11 · Redes").
4. Vincula a lista à aula e à turma, define a abertura, o fechamento e quando o gabarito aparece (imediato ou após fechar).

Os alunos recebem um link ou QR, e o professor vê o resultado por item. Tecnicamente, isso deve reutilizar o modelo de tentativa do treino (ADR-007 já pede para não criar um segundo modelo), com uma lista em vez de seleção aleatória. Uma versão para impressão (PRT-1 do banco de ideias) ajuda a aula presencial.

### 6. Simulado completo aplicado à turma, com resultado consolidado?

Sim, é provavelmente a funcionalidade docente de maior valor depois da presença. Requisitos:
- **Aplicação agendada:** turma, data, sala ou laboratório, janela de abertura e fechamento, duração definida pelo servidor (o prazo no servidor já é princípio na ARCHITECTURE §4) e gabarito liberado para todos após o fechamento.
- **Formato da edição em dados**, com o rótulo "simulado autoral no formato ENADE <edição>", nunca "prova oficial" (regras já escritas no WORKBOARD).
- **Resultado consolidado:** participação, acerto por bloco, área e item, distratores e lista de quem não fez. O individual fica visível ao próprio aluno e ao professor da turma.
- **Sem nota prevista do ENADE** e sem ranking.
- **Alternativa realista para 2026:** o acervo não comporta um simulado completo (não há sequer 10 itens por área). Duas opções: um simulado parcial por blocos com o que estiver publicado, informando quantos itens faltam por bloco, ou uma prova em papel com folha de respostas digitada no sistema depois, para ter o consolidado.

### 7. O que falta para entregar à FSA como produto mantido por outras turmas

1. **Propriedade e licença:** escolher uma licença com a instituição, transferir o repositório para uma organização do IFSP/FSA, definir mantenedores e um docente responsável pelo produto (dono do backlog).
2. **Onboarding humano:**
   - `CONTRIBUTING.md` com setup em 10 minutos (os comandos já estão no README e funcionam);
   - mapa de pastas e módulos;
   - glossário (versão, procedência, ASSISTED, fila de importação, demonstrativa);
   - como pegar uma tarefa, abrir PR e rodar testes;
   - separar o protocolo Claude×Codex num anexo, para que o README principal sirva a qualquer pessoa.
3. **Papéis e administração:** tela de administração e trilha de auditoria (P1-3). O administrador não pode depender de quem tem shell no servidor.
4. **Virada de edição:** um runbook "nova edição do ENADE" que cubra data e formato da prova, taxonomia da nova portaria, importação de provas e gabaritos e arquivamento de turmas. Tudo em dados (P1-7).
5. **Deploy institucional:**
   - decidir com a TI do câmpus onde hospedar (D1 continua pendente) e se dados de alunos podem ficar em provedor externo;
   - backup cifrado com restauração ensaiada (DEPLOY §7);
   - papel de banco separado para migrations;
   - monitoramento mínimo.
6. **Testes isolados:** banco ou schema próprio para `npm test` e E2E. Na minha sessão, as fixtures apareceram para um usuário comum do banco de desenvolvimento.
7. **Código mais fácil de manter:**
   - quebrar `apps/web/src/main.ts` (1.583 linhas, roteamento manual) com Angular Router e componentes por tela;
   - `curation.component.ts` tem 1.179 linhas;
   - gerar ou manter uma especificação OpenAPI a partir dos controllers;
   - organizar `tests/` por domínio.
8. **Política de atualização** de dependências (Angular 22, Nest 12 e Node 24 estão fixados; definir quem atualiza e quando) e checagem de CVEs, que já existe no CI com `npm audit`.
9. **Dados fictícios de demonstração** para as telas docentes (seed com turma, aulas e alunos sintéticos rotulados como tal).
10. **Transferência de conhecimento:** uma sessão gravada de arquitetura e uma lista de "primeiras issues" para a turma que chega.

---

## Proposta de modelo de dados mínimo (aulas, presença e papéis)

Nomes indicativos; seguir o padrão do repositório (UUID, `created_at`, constraints no banco, revisão monotônica onde houver edição concorrente).

**Edição e taxonomia**
- `exam_edition`: id, ano, data_prova, formato (blocos: FG objetivas/discursivas, específico objetivas/discursivas), referência da portaria, status (preparação, encerrada).
- `knowledge_area`: id, edition_id, nome, ordem. Substitui a lista fixa e o `CHECK` da 012.
- `knowledge_content`: id, area_id, nome, referência na portaria (artigo/inciso/alínea), ativo.
- `question_classification`: question_id, content_id, principal (bool), classificado_por, revisado_por, revisado_em.

**Pessoas e papéis**
- `participant` (roster; existe sem conta): id, nome, prontuário (único por câmpus), email_institucional, identity_id (nulo até vincular a uma `account`), criado_por, criado_em, anonimizado_em.
- `role_assignment`: id, identity_id, papel (ADMIN, COORDENACAO, PROFESSOR, CURADORIA), escopo_turma_id (nulo = global), concedido_por, concedido_em, motivo, expira_em, revogado_por, revogado_em. O `curator_role` atual pode migrar para cá.
- `invitation`: id, email, papel ou turma, token_hash, expira_em, criado_por, aceito_por_identity, aceito_em.
- `privacy_notice_ack`: identity_id ou participant_id, versão do aviso, ciente_em.

**Turmas, aulas e presença**
- `study_group` (turma): id, edition_id, nome, curso, semestre/período, câmpus, ativa.
- `group_member`: group_id, participant_id, entrou_em, saiu_em.
- `room` (opcional; pode começar como texto na aula): id, nome, bloco, capacidade, laboratório (bool).
- `lesson` (aula): id, group_id, início, fim, room_id ou sala_texto, area_id, content_id (opcional), tema, status (AGENDADA, REALIZADA, CANCELADA), chamada_fechada_em, chamada_fechada_por, observação. Restrição: fim > início.
- `lesson_teacher`: lesson_id, identity_id (vários professores por aula).
- `attendance`: lesson_id, participant_id, status (PRESENTE, AUSENTE, ATRASO, JUSTIFICADA), justificativa_categoria, justificativa_texto (curto, sem anexos de saúde), registrado_por, registrado_em, revision. Chave (lesson_id, participant_id). O participante precisa ser membro da turma da aula.
- `absence_request` (opcional na 1ª fatia): id, lesson_id, participant_id, categoria, texto, status (PENDENTE, ACEITA, RECUSADA), decidido_por, decidido_em.

**Atividades e respostas** (reutilizando o modelo de tentativa do treino)
- `assignment` (lista ou simulado): id, group_id, lesson_id (opcional), tipo (LISTA, SIMULADO), título, abre_em, fecha_em, duração_min (simulado), gabarito (IMEDIATO, APOS_FECHAR), criado_por.
- `assignment_item`: assignment_id, posição, question_id, version_id (versão fixa).
- `practice_attempt` recebe um `assignment_id` opcional: tentativas de lista ou simulado usam a mesma integridade do ADR-007.
- `answer_event` (somente inserção): owner_id, question_id, version_id, option_id, contexto (ESTUDO, CADERNO, TREINO, LISTA, SIMULADO), attempt_id (opcional), número da tentativa nessa questão, motivo do erro (opcional), justificativa curta (opcional), created_at. A tabela `answer` atual continua como "resposta vigente".
- `review_schedule` (caderno espaçado): owner_id, question_id, caixa (1–4), próxima_em, último_resultado.

**Auditoria**
- `access_log`: actor_id, ação (VER_INDIVIDUAL, EXPORTAR), alvo (participant_id ou group_id), recurso, em. Sem copiar os dados exportados.

Primeira fatia sugerida, sem dados de estudo: `exam_edition`, `role_assignment`, `invitation`, `participant`, `study_group`, `group_member`, `lesson`, `lesson_teacher`, `attendance`, `access_log` e a exportação CSV.

---

## O que está bom e deve ser mantido

- **Procedência sempre visível:** "Oficial · Inep · 2021 · Bacharelado · Q28", página, link da prova e do gabarito, recorte original e o rótulo "transcrição automatizada… vale a imagem" (`shots/21-questao-oficial.png`). Como professor, isso me dá confiança para usar o material.
- **Métricas honestas:** o caderno mostra "0 de 4" com denominador, separa as demonstrativas e diz que "não estima sua nota no ENADE". O treino diz "faltam 12" em vez de completar com repetidas. Esse é o tom certo para um painel docente.
- **Sem ranking, streak e gamificação** por princípio (MASTER-SPEC §6). Manter, pela pedagogia e pela LGPD.
- **Curadoria com revisão por outra pessoa e versões imutáveis.** Encaixa bem numa equipe de professores revisando as questões uns dos outros. A tentativa fixa a versão, e uma correção de gabarito não reescreve o passado.
- **Autorização no servidor:** 403 em `curation/*` para conta comum; o menu escondido não substitui a checagem; papel nunca vem do e-mail. Sessões com hash, cookie HttpOnly, SameSite e CSP estrita (DEPLOY §3).
- **Integridade no banco:** triggers e constraints protegem versões publicadas e tentativas finalizadas, e há testes com PostgreSQL real e concorrência.
- **Link de seleção filtrada** (`/questoes?area=Redes&year=2021`), que já serve para mandar "estudem Redes de 2021" à turma.
- **Responsivo:** sem rolagem horizontal a 390 px (`scrollWidth = 390`) e navegação de estudo no topo no celular (`shots/50-home-390.png`, `shots/51-caderno-390.png`).
- **Setup e CI documentados:** `npm ci`, `db:up`, `db:migrate`, `db:seed`, `dev:api` e `dev:web` funcionam como descrito (`/api/health` → ok). O CI roda audit, build, testes com Postgres, E2E e imagem Docker.
- **ADRs curtos registrando cada decisão** e um README que declara limites ("não inclui…", "não certifica…"). É um bom hábito para passar às próximas turmas, desde que acompanhado de um guia de entrada mais simples.

---

Fonte consultada sobre a portaria (apenas metadados; o texto não pôde ser lido nesta sessão): [Portaria Inep nº 157, de 14/04/2026 (ABMES)](https://abmes.org.br/legislacoes/detalhe/5486/portaria-inep-n-157).
