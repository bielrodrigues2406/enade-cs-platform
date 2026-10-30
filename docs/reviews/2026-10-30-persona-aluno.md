# Avaliação como aluna: Larissa, concluinte de CC do IFSP Presidente Epitácio

Avaliação simulada por agente em 30/10/2026. Não é entrevista com estudante real. Todas as capturas citadas estão em `/tmp/claude-0/personas/aluno/shots/` e os scripts Playwright em `/tmp/claude-0/personas/aluno/`.

## Resumo em 5 linhas

1. A base é séria e confiável: a origem de cada questão aparece, há link para a prova e o gabarito no site do Inep, a explicação de IA vem rotulada e as questões em texto são ótimas de resolver no celular.
2. Para o meu uso real (no celular, à noite) as questões oficiais em imagem são quase ilegíveis a 390 px: o texto do recorte fica com uns 6–7 px. O botão "Ampliar" obriga a rolar para o lado a cada linha, e a transcrição fica escondida e sai embaralhada nas figuras.
3. O sistema não mostra com honestidade onde estou fraca. O placar e o caderno usam só a última resposta, e "Alterar resposta" e "Tentar novamente" funcionam logo depois de ver o gabarito. Bastou clicar na letra certa para sair de 1/6 para 3/6, e duas áreas viraram "Sem erros". Os erros do treino não vão para lugar nenhum.
4. No celular a navegação falha: o botão Voltar do navegador sai do site, recarregar a página perde a questão aberta, e o caderno de erros e a conta não têm endereço próprio.
5. Faltam três coisas que eu procuraria até 29/11: um simulado no formato da prova (com tempo, Formação Geral e componente específico), desempenho por área e conteúdo oficial suficiente, principalmente de Formação Geral. Hoje o treino parcial nem inicia, porque só há 8 questões publicadas.

## Como testei

- Usei Chromium via Playwright a 390 px (DPR 2, toque) e a 1440 px, em `http://localhost:4200`. Fiz a jornada completa: primeira visita, cadastro, Q28 (questão em imagem, com "Ampliar" e transcrição), Q2, Q9 e Q35, além de demos. Errei de propósito a Q28, a Q2, a Q35 e duas demos, depois passei pelo caderno de erros e refiz a Q28. Também testei "Alterar resposta", busca, filtros, saída da conta, senha errada, novo login, recarregamento e o botão Voltar.
- **Treino:** com 8 questões publicadas, nenhum tamanho (10/20/30) fica disponível (`10-treino-390.png`). Para exercitar o fluxo:
  - clonei o banco local para um banco isolado (`enade_persona_aluno`);
  - acrescentei 24 questões sintéticas rotuladas TEST ONLY;
  - subi uma API separada em `:3100` servindo o `dist/web` atual.

  Fiz um treino de 10 até o resultado e a revisão, recarreguei no meio e deixei um treino de 20 em andamento. Depois disso parei a API, apaguei o banco isolado e removi do banco compartilhado a conta de teste da Larissa.
- **Ruído do ambiente:** durante a sessão, outro agente inseriu e removeu fixtures "TEST ONLY catalog" no banco compartilhado. O banco chegou a mostrar "70 questões" e "Questão 5 de 70". Desconsiderei isso como achado.
- **Repositório:** não alterei nenhum arquivo. O `git status` passou a mostrar mudanças em `apps/api/src/assisted-publication.ts` e `data/question-crop-manifests/`, feitas entre 17:16 e 17:20 por outro agente que trabalha em paralelo.
- **O que não testei:** celular real, WebKit/Safari, leitor de tela, rede lenta e 320 px.

## Achados priorizados

Critério: **P0** impede um dos meus objetivos centrais até a prova (saber o que cai, treinar com questões reais, simular, ver onde estou fraca); **P1** é importante; **P2** é melhoria. Assumo produção com cerca de 300 questões oficiais.

### P0

**P0-1. Questão oficial em imagem não é legível no celular.**
- **Evidência:**
  - A Q28 tem recorte de 1443 px exibido em 332 px CSS (escala de cerca de 0,23). O corpo do texto fica com uns 6–7 px CSS (`05-q28-390-fold.png`).
  - "Ampliar" abre o recorte a cerca de 685 px de largura numa tela de 390 px, e cada linha é cortada à direita (`06-q28-ampliar-390.png`).
  - A transcrição vem recolhida em "Transcrição automática do enunciado". As figuras saem como texto solto ("S1 S2 S3 S4 S5 Unidade de Unidade de…", "S1 : 1 2 3 4 5 6 7 8 9 S2 : …").
  - Em produção, quase todo o acervo oficial terá esse formato.
- **Sugestão:**
  - No celular, oferecer um modo de leitura com o texto transcrito como principal, cada figura e tabela recortada separadamente no meio do texto, e "Ver página original" como conferência.
  - No "Ampliar", abrir ajustado à largura com pinça/zoom e rolagem vertical, ou dividir o recorte em faixas de parágrafo.
  - Lembrar a preferência entre imagem e texto.
  - Medir a legibilidade a 390 px como critério de aceitação de CT-1b.

**P0-2. "Onde estou fraca" fica enganoso: os erros somem do registro.**
- **Evidência:**
  - Errei a Q28 (marquei A, o certo é B), vi o gabarito e, um minuto depois, usei "Tentar novamente" pelo caderno e marquei B de memória. O caderno caiu de 5 para 4 questões a retomar, os acertos subiram de 1/6 para 2/6, e Arquitetura de computadores passou a "Sem erros" (`09-review-after-redo-390.png`).
  - Na Q35 usei "Alterar resposta" na própria tela de feedback, com o gabarito à vista. Os acertos foram a 3/6 e Sistemas distribuídos virou "Sem erros" (`19-caderno-1440.png`).
  - O próprio início sugere "Tentar novamente" logo após o erro (`08-home-after-answers-390.png`).
  - O erro original não fica registrado em lugar visível.
- **Sugestão:**
  - Guardar o histórico de tentativas e medir desempenho pelo acerto na primeira tentativa.
  - A questão só sai do caderno depois de acertos em dias diferentes, ou com uma confirmação do tipo "acertei porque entendi".
  - "Alterar resposta" depois do gabarito não deve contar como acerto.
  - Detalhes na resposta à pergunta 1.

**P0-3. Não existe forma de simular a prova.**
- **Evidência:**
  - O treino parcial não tem cronômetro: "Sem cronômetro… não reproduz uma prova oficial" (`11-treino-config-390.png`).
  - Não há blocos de Formação Geral e componente específico, nem a discursiva.
  - O "Simulado no formato da prova" aparece como "planejado" no início (`02-home-390-scroll-2.png`).
  - Faltam 30 dias, e simular a prova é um dos motivos de eu abrir a plataforma.
- **Sugestão:** ver a resposta à pergunta 5. O mínimo útil é um simulado autoral no formato de 2026, com prazo no servidor e resultado por bloco. Antes dele, já ajudaria um treino cronometrado opcional.

**Pré-condição, não é bug de interface:** hoje há 5 oficiais e 3 demos publicadas, nenhuma área tem 10 questões e o treino não inicia (`10-treino-390.png`). Formação Geral tem 1 questão publicada, mas responde por 15 das 45 objetivas da prova.

### P1

**P1-1. Botão Voltar e recarregamento perdem o lugar no celular.**
- **Evidência:**
  - Ir de Início para Banco não cria entrada no histórico, e abrir uma questão também não.
  - Voltar, a partir de uma questão aberta depois de filtrar, leva a `/questoes` sem o filtro. O segundo Voltar sai do site (`about:blank` no teste).
  - Recarregar com a Q9 aberta volta para a lista do banco.
  - O caderno de erros e a tela de conta continuam com o endereço `/questoes` ou `/`, e recarregar abre outra tela.
  - Isso acontece no Android sempre que troco de app e o navegador recarrega a aba.
- **Sugestão:**
  - Uma URL por tela: `/questoes/<id>`, `/caderno`, `/conta`.
  - Usar `pushState` ao abrir uma questão e ao trocar de tela.
  - Voltar deve retornar à lista com o mesmo filtro e a mesma rolagem.
  - Um link de questão também permite ao professor do câmpus mandar "façam a Q28 de 2021" no grupo.

**P1-2. O treino fica isolado de todo o resto.**
- **Evidência:**
  - O resultado diz "As respostas ficam separadas do estudo livre".
  - Depois de um treino com 4 erradas e 2 em branco, o caderno continuou com as mesmas 4 questões a retomar e o início continuou com "Respondidas 6 de 32" (`13-treino-landing-after-390.png`).
  - Um treino em andamento só aparece em `/treino`, nunca no início.
- **Sugestão:**
  - Levar os erros e as questões em branco do treino ao caderno, com a origem "treino de 30/10".
  - Mostrar "Continue seu treino (0 de 20)" no início.
  - Somar o treino ao desempenho por área.

**P1-3. A revisão do treino mostra ✓ em questões erradas.**
- **Evidência:** depois de finalizar, a folha de respostas da revisão marca a questão 2 com ✓ "respondida", mas a resposta estava errada e a tela mostra "Resposta incorreta" (`14-rever-q2-1440.png`). O ✓ lê-se como "certa".
- **Sugestão:** na revisão, usar ✓ para certa, ✗ para errada e "—" para em branco, com legenda própria e um filtro "só as que errei".

**P1-4. O treino não serve para a minha área fraca nem para questões novas.**
- **Evidência:**
  - Teoria da computação com 6 questões: todos os tamanhos ficam desabilitados e aparece "Para 20 questões, faltam 14" (`11-treino-teoria-390.png`).
  - O treino sorteou a Q28, que eu tinha visto 5 minutos antes. Acertei porque lembrava a letra, e o resultado registrou Arquitetura de computadores "1 de 1".
  - Não há filtro de "não respondidas por mim" nem de "só as que errei".
- **Sugestão:**
  - Permitir "todas as N disponíveis" quando N for menor que 10, ou um tamanho de 5.
  - Oferecer as opções "priorizar inéditas para mim", "só as que errei" e "várias áreas" (por exemplo, Teoria da computação e Matemática juntas).

**P1-5. As explicações não ensinam o raciocínio das questões de afirmativas e vazam notas internas.**
- **Evidência:**
  - As explicações são um parágrafo único que começa com "O gabarito B seleciona I e IV…" (`06-q28-feedback-390-bottom.png`).
  - Nas questões do tipo "É correto apenas o que se afirma em", eu precisava saber se cada afirmativa (I a IV) é verdadeira ou falsa, e por quê.
  - A explicação da Q2 diz: "A validade de I depende também da imagem do texto I, que ainda precisa ser incorporada e conferida." É uma nota editorial exibida para a aluna.
- **Sugestão:**
  - Estruturar a explicação com "afirmativa I: V, porque…", o conceito-chave e o erro comum de quem marcou a alternativa que eu marquei.
  - Bloquear a publicação de explicações que contenham pendências editoriais.
  - Botão "reportar problema na explicação".

**P1-6. As listas não ajudam a escolher nem a lembrar.**
- **Evidência:**
  - O título das oficiais é só "ENADE 2021 · Questão 28", sem tema.
  - Certas e erradas aparecem com o mesmo status, "Resposta salva · você pode revisar" (`17-bank-logged-390.png`).
  - A ordem do banco é demos e depois Q12, Q28, Q2, Q35, Q9 (`03-catalog-1440.png`).
  - O caderno também não mostra o que eu marquei nem o tema.
- **Sugestão:**
  - Subtítulo com o tema (por exemplo, "Pipeline de 5 estágios", "LGPD").
  - Status ✓ ou ✗ e data na lista.
  - Ordenar por ano e número por padrão.
  - Filtros por status pessoal: não respondidas, errei, acertei, marcadas.

**P1-7. Os filtros "Área" e "Assunto" repetem os mesmos rótulos, e a classificação precisa ser confiável.**
- **Evidência:**
  - "Assunto" lista exatamente os nomes das áreas: Algoritmos, Banco de dados, Redes… (`03-catalog-390.png`).
  - Na prévia local, a Q12 (sobre LGPD) aparece como "Redes", e a Q9 (escalonamento de processos) como "Algoritmos", embora o parecer de conferência diga Sistemas operacionais.
  - É dado de prévia, mas mostra o risco: se a área estiver errada, meu "desempenho por área" fica errado.
- **Sugestão:** ver a resposta à pergunta 4: um nível de área canônica, um tema específico, classificação revisada e um botão "classificação errada?".

**P1-8. A conta tem armadilhas que podem me fazer perder 30 dias de histórico.**
- **Evidência:**
  - Não há recuperação de senha ("Nesta versão… não há recuperação de senha", `04-signup-390-full.png`).
  - No login: "As respostas da sessão sem conta não são transferidas ao entrar" (`15-login-1440.png`). Se eu resolver dez questões no celular antes de entrar na minha conta, elas ficam perdidas na sessão anônima.
  - Não há aviso de privacidade (LGL-1) nem botão para mostrar a senha.
- **Sugestão:**
  - Recuperação por e-mail (D2) ou, no mínimo, um código de recuperação exibido no cadastro.
  - Ao entrar, oferecer "juntar as N respostas desta sessão à sua conta".
  - Link para o aviso de privacidade no cadastro.
  - Alternância "mostrar senha".

### P2

- **Início com promessas que não se cumprem:**
  - Os blocos "2 a 8 nov… 23 a 29 nov" estão vazios e parecem um plano que não existe (`01-home-390-fold.png`).
  - O mapa da prova afirma "Em azul, o que o caderno já treina", com as 30 objetivas de Computação azuis e a Formação Geral vazia. O texto está fixo no código (`home.component.ts:278`), embora exista uma questão de Formação Geral e só 7 de Computação.
  - "Em construção" mostra "Questões oficiais com a imagem da prova: em andamento", mas elas já estão disponíveis, e o treino parcial não é citado.
  - **Sugestão:** gerar esses blocos a partir dos dados ou removê-los. Usar as semanas para algo real, por exemplo "nesta semana: 2 treinos de Teoria da computação".
- **Feedback abaixo da dobra no celular:** depois de "Confirmar resposta" a página não rola, e o rótulo "Resposta incorreta" fica a cerca de 806–810 px numa tela de 844 px. As letras coloridas aparecem, mas a explicação não. **Sugestão:** rolar suavemente até o feedback ou mostrar um resumo fixo com "Ver explicação".
- **Metadados antes do enunciado:** no celular há cerca de 600 px CSS de navegação, trilha, "Voltar", "Versão 1", "Fonte: Inep", edição, página e link antes do recorte (`09-redo-q28-390-top.png`). "Versão 1" não significa nada para mim. **Sugestão:** uma linha "ENADE 2021 · Q28 · Arquitetura" e o resto num "Detalhes".
- **Depois de refazer pelo caderno não há próximo passo:** só aparece "Alterar resposta" (`09-redo-q28-after-390-bottom.png`). **Sugestão:** "Próximo erro (3 restantes)".
- **Treino no celular:**
  - A folha de respostas e o botão "Revisar e finalizar" aparecem acima do enunciado já na questão 1 (`11-treino-q1-390-fold.png`).
  - Uma questão marcada para revisar e respondida mostra só "*", sem ✓ (`12-treino-folha-390.png`).
  - No resultado, o cabeçalho "Acerto/s" quebra no meio da palavra a 390 px (`12-treino-resultado-390-full.png`).
  - O título "Treino parcial" recebe foco programático com contorno laranja visível para quem usa toque (`11-treino-teoria-390.png`).
- **Botões manuais de atualizar:** "Atualizar caderno" e "Atualizar disponibilidade" parecem sinal de que a tela não está atualizada.
- **"Começar a resolver":**
  - O nome acessível é "Começar por: Entrega confiável de um fluxo", diferente do texto visível (WCAG 2.5.3, rótulo no nome).
  - O botão leva a uma questão demonstrativa, e o exemplo animado da página também é inventado. Uma oficial real convenceria mais.
- **Textos genéricos ou técnicos:**
  - "Vamos entender este conceito.", "Escolha um assunto. Entenda o raciocínio. Continue a construir sua base."
  - "Editar uma resposta ou resolver outra versão não aumenta a contagem" usa jargão.
  - A dica "Use de 12 a 128 caracteres" não precisa aparecer no login.
- **Filtros no celular:** ocupam a primeira tela inteira do banco antes da lista (`03-catalog-390.png`). **Sugestão:** recolher os filtros num botão "Filtros (2)" e manter a busca visível.

## Respostas às perguntas do dono do produto

### 1. Faz sentido "refazer uma questão que errei"?

Faz, mas do jeito atual atrapalha mais do que ajuda.

**Quando ajuda:**
- Quando passou tempo suficiente para eu não lembrar a letra (dias, não minutos).
- Quando errei por leitura ou distração.
- Quando o refazer me obriga a reconstruir o raciocínio. Acontece muito no ENADE: questões de "I, II, III, IV" e de asserção e razão, em que posso acertar cada afirmativa.

**Quando atrapalha:**
- Hoje posso refazer segundos depois de ver "Alternativa correta: B". As alternativas ficam na mesma ordem, e eu acerto lembrando "era a B".
- O sistema conta isso como acerto e apaga o erro do placar e do caderno (P0-2).
- "Alterar resposta" é ainda pior: é clicar na letra que está escrita na tela.
- No treino, a Q28 reapareceu e eu acertei pelo mesmo motivo.
- Resultado: o caderno esvazia e eu ganho uma falsa sensação de segurança justamente nas áreas em que estou insegura.

**O que eu gostaria, no lugar ou além disso:**
1. **Registrar o erro de forma permanente.** Mostrar "errou em 30/10; acertou na revisão em 02/11", com o desempenho medido pela primeira tentativa. O refazer vira "recuperação" e não apaga a evidência.
2. **Intervalo antes de refazer.** Depois de ver o gabarito, o botão vira "Revisar em 2 dias", que sobe para 7 dias se eu acertar. Isso combina com a ideia de revisão de véspera (REV-2). Se eu quiser refazer na hora, que seja permitido, mas marcado como "revisão imediata" e sem contar no desempenho.
3. **Refazer o raciocínio, não a letra.** Nas questões de afirmativas, pedir V ou F para cada afirmativa antes das letras, ou embaralhar a ordem de apresentação. Antes de mostrar as alternativas, perguntar "qual conceito você acha que errou?".
4. **Motivo do erro, com um toque:** não sabia o conceito, li errado, chutei ou faltou tempo. Isso alimenta o filtro do caderno, e "chutei e acertei" também entra no caderno (já foi sugerido como hipótese no relatório de 28/10).
5. **"Questão parecida".** Em vez de refazer a mesma questão, oferecer outra do mesmo tema que eu ainda não vi. Com 300 questões isso é viável, e é o que mostra se aprendi ou decorei.
6. **Uma anotação minha no erro,** por exemplo "confundi S1 com S3", para reler na véspera.
7. **Tirar "Alterar resposta" da tela de feedback,** ou fazer com que a alteração não conte como acerto.

### 2. O que falta para eu usar de verdade até a prova, por prioridade

1. **Questões oficiais publicadas, inclusive Formação Geral.** É uma pré-condição: sem acervo, nada do resto funciona. São 15 das 45 objetivas.
2. **Ler uma questão em imagem no celular sem sofrimento (P0-1).**
3. **Desempenho por área honesto,** medido pela primeira tentativa, incluindo treino e simulado, com o tamanho da amostra (P0-2 e pergunta 4).
4. **Simulado no formato de 2026,** ou ao menos um treino com tempo opcional (P0-3 e pergunta 5).
5. **Caderno de erros integrado,** com erros de treino e simulado, motivo do erro e revisão espaçada até 29/11.
6. **Navegação robusta no celular,** com URL, Voltar e recarregamento (P1-1).
7. **Treino da área fraca com o que existir,** priorizando questões inéditas para mim (P1-4).
8. **Recuperação de conta e junção da sessão anônima (P1-8),** para não perder o histórico de um mês.
9. **Explicação por afirmativa e "estudar este tema":** um link para um resumo curto do conceito, porque às vezes não sei nem o que é BTB.
10. **Plano curto até a prova:** quantas noites tenho e quais áreas atacar em cada semana, usando os blocos de semanas que hoje estão vazios.

### 3. O que não faz sentido, confunde ou irrita

- Clicar em Voltar no Android e sair do site, ou trocar de app, voltar e perder a questão que estava lendo.
- "Sem erros" em áreas em que errei há cinco minutos.
- Um ✓ na folha de revisão para uma questão que errei.
- Um treino que não conta para nada: não vai ao caderno nem ao início.
- O filtro "Área" e o filtro "Assunto" com as mesmas palavras.
- "ENADE 2021 · Questão 12" na lista sem dizer do que trata.
- "Resposta salva · você pode revisar" sem dizer se acertei.
- O início prometendo coisas que a página não cumpre: semanas vazias, mapa "em azul, o que o caderno já treina" errado, oficiais "em andamento" já disponíveis.
- Uma nota editorial interna aparecendo na explicação da Q2.
- "Versão 1" e "Fonte: Inep" repetidos em toda questão; "Atualizar caderno" e "Atualizar disponibilidade" como botões.
- O começo do produto ser uma questão "Autoral demonstrativa" sobre TCP, enquanto já existem oficiais.
- Saber que não há recuperação de senha.
- "Treino parcial" como nome: para mim é só "Treino" ou "Lista de questões".

### 4. Classificação por área: como eu quero filtrar e ver meu desempenho

**Filtrar:**
- Um nível de **área** fixa (as 18 canônicas), com contagem honesta, por exemplo "Teoria da computação (14 · 9 não respondidas por você)".
- Abaixo dela, um nível opcional de **tema** específico: Autômatos e linguagens formais, Computabilidade, Complexidade/NP, Grafos, Lógica, Combinatória, Pipeline, Normalização… Hoje "Assunto" é só uma cópia da área.
- **Seleção múltipla** (Teoria da computação + Matemática), porque estudo as duas juntas.
- **Componente:** Formação Geral ou Específico.
- **Ano:** já existe.
- **Meu status:** não respondidas, errei, acertei, marquei dúvida.
- Se possível, o **formato da questão:** afirmativas I–IV, asserção e razão, cálculo, código.
- O filtro escolhido deve valer também para o treino, para eu montar "20 de Teoria da computação + Matemática que eu nunca vi".

**Desempenho por área:** uma tabela simples, sem gráfico enfeitado, com estas colunas:

| Área | Feitas | Acerto na 1ª tentativa | Erros pendentes | Última prática | Disponíveis no banco |
| --- | --- | --- | --- | --- | --- |

- Aviso de amostra pequena, por exemplo "3 questões: pouco para concluir", em vez de porcentagem solta.
- Separar Formação Geral e Específico, e incluir estudo livre, treino e simulado.
- Em cada linha: "Treinar esta área" e "Rever erros desta área".
- Opcional, desde que rotulado como descritivo: "quantas questões desta área apareceram nas provas de 2014–2021", para eu priorizar sem achar que é previsão do que cairá em 2026.
- **Confiança:** a área precisa estar correta, porque o meu diagnóstico depende disso. A classificação deve ser revisada, aparecer de forma visível na questão e ter um botão "classificação errada?".

### 5. Simulado completo no formato da prova: o essencial

1. **Formato declarado e rotulado como simulado autoral no formato ENADE 2026:** 15 objetivas de Formação Geral, 30 objetivas e 1 discursiva do componente específico, em 4 horas. Se faltarem itens em algum bloco, dizer quantos faltam em vez de montar um simulado incompleto sem avisar (a regra já existe no WORKBOARD).
2. **Tempo controlado pelo servidor,** que não reinicia ao recarregar. O tempo restante fica visível mas discreto, com avisos aos 30 e aos 10 minutos.
   - Como trabalho de dia, preciso de um modo "em dois blocos" (Formação Geral e Específico em noites diferentes), declarado como tal, além do modo completo sem pausa.
   - Também um simulado curto por área, de 30 a 45 minutos, para os dias de semana.
3. **Folha de respostas por número,** com "marcar para revisar" e revisão antes de finalizar. O treino já tem isso e funciona bem (`12-treino-revisar-390.png`).
4. **Nada de gabarito antes de finalizar.** O resultado sai por bloco (Formação Geral e Específico) e por área, com questões em branco, tempo por bloco e, se possível, tempo por questão. Mostrar "desempenho no simulado", nunca "sua nota no ENADE".
5. **Priorizar questões que eu ainda não vi,** sem repetir as do treino, e avisar quando o acervo não permitir.
6. **Discursiva** com espaço para escrever (ou rascunho), padrão de resposta oficial depois e autoavaliação por critérios.
7. **Erros e questões em branco do simulado vão para o caderno.**
8. **Funcionar bem no celular e no computador,** retomar se cair a conexão e, como a prova é em papel, permitir imprimir o caderno com a folha de respostas (ideia PRT-1).

### 6. Página inicial pública e login/cadastro: o que me faria usar e confiar

**O que já passa confiança:**
- "Projeto independente, sem vínculo com o Inep ou o MEC".
- Origem visível em cada questão.
- Links diretos para a prova e o gabarito no `download.inep.gov.br`.
- Rótulo honesto de IA "sem revisão humana".
- Contagem regressiva com o formato de 2026 citando o Inep.

**O que falta na página pública:** hoje o visitante cai direto no painel de estudo, com demos e semanas vazias. Eu procuraria:
1. **Uma frase concreta de valor com números reais,** por exemplo "Questões oficiais do ENADE de Ciência da Computação 2005–2021, com a página original da prova e o gabarito do Inep", com a contagem por ano e área gerada pelos dados.
2. **Experimentar sem cadastro uma questão oficial real.** O exemplo animado e o "Começar a resolver" usam demos inventadas.
3. **Quem faz, contato e custo:** "gratuito, sem anúncios". Uma relação com as aulas de preparação do IFSP PEP só se for verdadeira.
4. **Privacidade:** quais dados são guardados (só e-mail e respostas), por quanto tempo e como apagar a conta.
5. **O que existe e o que vem depois, sempre correto,** porque um "em andamento" errado faz desconfiar do resto.

**Login e cadastro:**
- O formulário é claro, com erros associados aos campos e mensagem genérica para senha errada.
- Ao criar a conta, minhas respostas anônimas são mantidas ("Conta criada. Suas respostas confirmadas foram mantidas.").
- O que me faria confiar:
  - recuperação de senha (ou código de recuperação);
  - junção da sessão anônima também no login;
  - link para o aviso de privacidade;
  - mostrar e ocultar senha;
  - uma tela de conta com endereço próprio (hoje continua em `/`);
  - explicar por que a senha tem no mínimo 12 caracteres ("use uma frase, por exemplo…").

## O que está bom e deve ser mantido

- **Procedência:** cada questão mostra a origem ("Oficial · Inep 2021 Q28", "Autoral demonstrativa"). A explicação vem com autoria ("gerada por IA (Codex), sem revisão humana"), e há links para a prova e o gabarito oficiais. Não mexer nisso.
- **Questões em texto no celular:** leitura confortável, alternativas grandes e marcação de "Sua resposta" e "Alternativa correta" com cor, ícone e texto (`07-demo-redes-feedback-390-fold.png`).
- **Imagem no desktop:** legível a 1440 px. "Ampliar" fecha com Esc e devolve o foco ao botão.
- **Nenhum gabarito antes de confirmar,** e "Resposta salva" só aparece depois da confirmação.
- **Tela de refazer pelo caderno:** esconde a resposta anterior e avisa "A resposta anterior só será substituída após confirmar". A ideia é boa; falta o que está em P0-2.
- **Treino:**
  - salvamento automático com "Alterações salvas.";
  - recarregar retoma o mesmo item pela URL (`?attempt=…&item=5`);
  - "Marcar para revisar";
  - confirmação antes de finalizar, com a contagem de respostas, brancos e marcadas;
  - resultado por assunto com as questões em branco e "sem previsão de nota ENADE";
  - lista de treinos concluídos;
  - "Continue seu treino".
- **Busca pela transcrição:** "pipeline" encontra a Q28 e "LGPD" encontra a Q12.
- **Caderno de erros:** ordem das mais antigas para as mais novas, tabela por assunto e frase honesta "não estima sua nota no ENADE".
- **Sem overflow horizontal** em nenhuma tela testada a 390 e 1440 px. Sem streak, ranking ou gamificação.
- **Identidade visual de "caderno":** sóbria, com boa tipografia e contraste. Não precisa de redesenho; precisa de conteúdo e dos fluxos acima.
