# Plano da reta final (07/11 a 29/11/2026)

Combinado com Gabriel em 07/11. **Foco:** questões novas no padrão do ENADE e uma Biblioteca com material denso e completo. Este documento substitui a lista "Próxima sessão" do HANDOFF. Os detalhes de cada etapa ficam nos documentos citados.

## 0. Pronto em 07/11

- **Ilustrações:** as 41 de Gabriel (17 capas, 15 metáforas, 9 cenas de questões) estão em `apps/web/public/illustrations/`.
  - Formato: WebP com 1200 px de largura nas paisagens e 800 px nas quadradas, cerca de 2 MB no total.
  - Ficha de cada uma em `data/illustrations/catalog.json`: texto alternativo, vínculo e SHA-256 do PNG original.
  - Os PNGs originais (cerca de 70 MB) ficam fora do Git.
- **Dudu:** três poses novas, já recortadas, em `apps/web/public/mascot/`: `novidade.webp`, `plano.webp` e `forca.webp`.
- **Menu da conta:** o contorno de foco não aparece mais ao abrir pelo toque (commit `f39dcf1`).
- **Análises que orientam o trabalho:**
  - [ENADE-EVOLUTION.md](ENADE-EVOLUTION.md): tamanho e áreas de 2005 a 2021;
  - [ENADE-ITEM-FORMATS.md](ENADE-ITEM-FORMATS.md): formatos, moldes e estímulos;
  - [GENERATED-QUALITY-AUDIT.md](GENERATED-QUALITY-AUDIT.md): pistas da resposta no lote 1.

## 1. Ordem de trabalho

Cada etapa sai num PR próprio, com testes, revisão e conferência no celular antes de pedir o merge.

| PR | Etapa | Por que nesta ordem | Meta |
| --- | --- | --- | --- |
| A | Ajustes rápidos de experiência | Pequenos, independentes e visíveis para a turma já | 08/11 |
| B | Base das questões (formatos, moldes, travas) | Tudo o que vem depois depende dela | 09/11 |
| C | Revisão do lote 1 (120 questões) | Tira as pistas da resposta das questões já publicadas | 11/11 |
| D | Biblioteca: piloto em 2 áreas | Gabriel aprova o formato antes de escrever as 163 lições | 12/11 |
| E | Lote 2 de questões (formatos novos) | Variedade no padrão da prova | 16/11 |
| F | Biblioteca: as outras 15 áreas | O maior volume; segue o modelo aprovado | 21/11 |
| G | Novidades, continuar de onde parou, modo escuro, conquistas novas (G2) | Acabamento, depois do conteúdo | 23/11 |
| H | Plano até a prova | Usa o núcleo, a Biblioteca e a confiança prontos | 25/11 |
| | Congelamento, só correções | Estabilidade na semana da prova | 26/11 em diante |

As datas são metas. Se o conteúdo atrasar, G e H encolhem; as questões e a Biblioteca não.

## 2. As etapas

### PR A. Ajustes rápidos de experiência

**Estado em 07/11:** feito, exceto o peso e o aceno do Dudu, que entraram com a versão 2. Correção do plano: o "logo duas vezes" era o rodapé do site com a página rolada até o fim, não um problema do menu.

**Topo e conta:**
- **Botão "Conta" no celular:** só o círculo com as iniciais, com 44 px de toque.
- **Topo sem login no celular:** só "Entrar"; "Criar conta" fica na tela de entrada e no início.
- **Menu e conta:** abrir um fecha o outro, e o logo deixa de aparecer duas vezes.
- **Discursivas:** a situação aparece como selo discreto ("Não começada").

**Senha:**
- **Mínimo de 8 caracteres:** recusa as 10 mil senhas mais comuns e senhas que contêm o nome, o e-mail, o prontuário, "enade" ou "cadernocc".
- **Medidor:** barra de 4 partes e uma lista com quadradinhos que ficam verdes.
- **Texto:** sai a frase "Uma frase fácil de lembrar funciona bem".

**Dudu ([MASCOT.md](MASCOT.md), análise de 07/11):**
- **Peso:** camadas de 656 kB para cerca de 38 kB.
- **Aceno:** asa acima da cabeça, com duas oscilações.
- **Pulo:** proporcional ao tamanho, e não em pixels fixos.
- **Poses novas:**
  - `forca` no resultado baixo de prova e treino, no lugar de "ouvindo";
  - `plano` reservado para o PR H;
  - `novidade` reservado para o PR G.

**Textos (COPY-1, primeira passada):**
- tela de entrada e cadastro;
- rodapé, que hoje diz "conferidos por outro agente", o que não vale para as geradas;
- avisos longos que repetem o que a tela já mostra.

**Pronto quando:**
- os E2E de conta, perfil e admin passam;
- conferido a 320, 390 e 1440 px.

### PR B. Base das questões (GEN-3 e GEN-4)

**Estado (07/11):** feito, junto com o PR C. Migration 032, moldes, figura e `npm run audit:generated` entregues.

**Modelo ([ENADE-ITEM-FORMATS.md](ENADE-ITEM-FORMATS.md)):**
- **Forma de responder (`format`):** `SIMPLES`, `ITENS3`, `ITENS4`, `ASSERCAO`, `ORDEM`, `CALCULO`, `CODIGO_OPCOES` e `ASSOCIACAO`.
- **Estímulo (`stimulus`):** `TEXTO_BASE`, `CENARIO`, `CODIGO`, `TABELA`, `FIGURA`, `GRAFICO`, `DOIS_TEXTOS` e `CHARGE`.
- **Banco:** migration 032.

**Moldes oficiais:**
- **Itens e asserção:** o arquivo diz só quais afirmações são verdadeiras, e na asserção se a II justifica a I. O validador monta as alternativas no molde do ENADE e **calcula a letra**.
- **Figura:** campo `figure`, com um SVG do agente ou uma ilustração do catálogo, e texto alternativo obrigatório.

**Travas no `npm test` ([GENERATED-QUALITY-AUDIT.md](GENERATED-QUALITY-AUDIT.md)):**
- a certa no máximo 15% maior que a maior errada;
- o "chutador esperto" acerta no máximo 25% em cada formato;
- limites para o item I verdadeiro, para a resposta A na asserção e para cada letra do gabarito.

**Medição:** o script de pistas vira `npm run audit:generated`, com o relatório antes e depois.

**Pronto quando:**
- o lote 1 ainda passa pelo validador antigo;
- o novo validador recusa os exemplos ruins dos testes.

### PR C. Revisão do lote 1

**Estado (07/11):** feito em parte, junto com o PR B. Pistas abaixo das travas (certa única mais longa 6%, chutador 23%) e 21 figuras ligadas (12 SVGs e 9 cenas). O aumento de tamanho ficou na Formação Geral e em cerca de 8 específicas; o resto passa para o PR E. Três SVGs da lista (subconjuntos, transformações e localidade) não foram feitos, porque o texto e o código já bastam nessas questões. Resultado em [GENERATED-QUALITY-AUDIT.md](GENERATED-QUALITY-AUDIT.md#5-resultado-da-revisão-07112026).

**Alternativas:**
- **Simples (80):** reescrever no mesmo molde (mesmo tamanho, mesmo nível de detalhe, ressalvas nos dois lados), sem mudar o conceito cobrado.
- **Itens e asserção (40):** migrar para o molde oficial e redistribuir quais afirmações são verdadeiras. A letra muda e cada uma gera versão nova; as respostas antigas ficam ligadas pelo `id`.

**Tamanho:** aumentar cerca de 45 questões para 180 a 300 palavras, com texto-base e referência, código, tabela ou cenário. A lista está na auditoria (seção 4.3). Isso inclui as 10 de Formação Geral, metade delas com dois textos.

**Imagens nas questões:**
- os 15 SVGs exatos (grafo de Dijkstra, heap, multiplexador, pipeline, autômatos, gráficos de FG…);
- as 9 cenas do catálogo (charges de FG, certificado, injeção de prompt, Pix).

**Conferência de cada questão mudada:**
- nova resolução sem o gabarito;
- execução da conta ou do código;
- tentativa de acertar só pelas alternativas, registrada no `check`.

**Pronto quando:**
- o relatório de pistas fica perto das oficiais: certa única mais longa até 20% (hoje 58% nas simples) e "chutador" até 25% (hoje 66%);
- os E2E das geradas passam.

### PR D. Biblioteca: piloto (Algoritmos e Sistemas operacionais)

**Estado (07/11):** feito; aguarda a leitura de Gabriel. 23 lições, capas e cinco figuras, em [LIBRARY-LESSONS.md](LIBRARY-LESSONS.md). Os flashcards de cada lição ficaram como perguntas para fixar dentro da própria lição; o baralho da área continua no botão da página.

**Uma lição por conceito do núcleo** (23 conceitos nas duas áreas). Cada lição tem:
1. **Explicação aprofundada:** de 4 a 8 parágrafos curtos, com definição, como funciona, por que importa e limites.
2. **Exemplo resolvido passo a passo:** com código ou conta executados de verdade.
3. **Erro comum:** o que confunde, ligado aos padrões de pegadinha do núcleo.
4. **Como cai no ENADE:** as questões oficiais que já cobraram o conceito, com edição e formato, e as geradas para treinar.
5. **Figura:** metáfora do catálogo (MET-01 condição de corrida, MET-02 deadlock, MET-05 hash, MET-06 heap…) ou SVG do agente.
6. **Para fixar:** 2 ou 3 flashcards e a referência da bibliografia.

**Página da área:**
- a capa (CAPA-ALG, CAPA-SO) no topo;
- índice dos conceitos com a confiança de cada um;
- leitura contínua ou por conceito.

**Na tela:**
- selo "Gerado por IA, sem revisão humana" no texto e "Ilustração gerada por IA" na imagem;
- figuras carregadas sob demanda;
- 320 px sem rolagem lateral.

**Pronto quando:** Gabriel lê as duas áreas e aprova ou pede ajustes no formato. **Só depois começa o PR F.**

### PR E. Lote 2 de questões

**Estado (07/11):** três partes feitas, com 43 questões nas formas que faltavam (cálculo, código nas alternativas, ordem, associação, itens com 1 e 3 verdadeiras, asserção B, D e E). O banco tem 163 questões, todas dentro das travas. Falta o restante, cerca de 37, e o alongamento dos enunciados antigos (mediana de 83 palavras).

- **Quantidade:** cerca de 80 questões, na mistura alvo de 2017 e 2021:
  - itens: 40%;
  - simples: 25%;
  - asserção: 15%, com B e E aparecendo;
  - ordem: 7%;
  - cálculo: 7%;
  - código nas alternativas: 4%;
  - associação: 2%.
- **Estímulos:** pelo menos 35% com cenário e 20% com código de linhas numeradas.
- **Prioridade:** o que voltou a cair (grafos, árvores, recursão, Scrum, SQL com nulos, lógica, escalonamento, aprendizado de máquina) e as áreas que entraram na prova depois de 2014 (Segurança, IHC, nuvem).
- **Pronto quando:** as mesmas travas e conferências do PR C passam.

### PR F. Biblioteca: as outras 15 áreas

- **Ordem, por peso histórico:**
  1. Arquitetura;
  2. Matemática (lógica primeiro);
  3. Engenharia de software;
  4. Teoria;
  5. Redes;
  6. IA;
  7. Banco de dados;
  8. Programação;
  9. Compiladores;
  10. Computação gráfica;
  11. Segurança;
  12. IHC;
  13. Distribuídos;
  14. Sociedade e ética;
  15. Formação Geral.
- **Volume:** 140 lições.
- **Imagens:** as capas e as metáforas restantes entram aqui.
- **Prazo:** se apertar, cada área sai com as lições dos conceitos que mais caíram, e o resto como "fundamento" mais curto, sinalizado.

### PR G. Novidades, continuar de onde parou, modo escuro

- **Novidades:** cartão no início, marca "Novo" no topo e aviso uma vez por novidade com a pose `novidade`. O que cada conta já viu fica no servidor (migration 033).
  - Primeiras entradas: Biblioteca completa, questões novas, núcleo e confiança.
- **Continuar de onde parou:** a última questão, prova ou lição aberta, no início.
- **Modo escuro:** com os tokens que já existem. Conferir o contraste das ilustrações sobre o papel escuro; se ficarem claras demais, vão numa moldura creme.

### PR G2. Conquistas que acompanham o estudo

**Hoje:** são 14 conquistas, quase todas de volume e constância (questões respondidas, dias seguidos, provas). A expansão premia o que mais ajuda na prova e leva às funções novas. Não há ranking de nota, só de constância, como hoje.

| Conquista | Regra | Nível | Dado que já existe |
| --- | --- | --- | --- |
| **Mapa traçado** | Avaliar todos os conceitos de uma área no núcleo | Bronze | `core_concept_rating` |
| **Bússola** | Avaliar conceitos nas 16 áreas e na Formação Geral | Prata | `core_concept_rating` |
| **Área firme** | Confiança de 70 ou mais numa área | Prata | Confiança do núcleo |
| **Cinco áreas firmes** | Confiança de 70 ou mais em 5 áreas | Ouro | Confiança do núcleo |
| **Domínio** | 80% de acerto na primeira resposta, com pelo menos 10 questões oficiais de uma área. Medalha mostra a área. | Prata | "Meu desempenho" |
| **Explique para o pato** | Escrever 10 autoexplicações depois de errar | Bronze | Reflexões (migration 028) |
| **Erro corrigido** | Acertar de novo 10 questões que estavam no caderno de erros | Prata | Caderno de erros |
| **Formatos do ENADE** | Acertar uma questão de cada forma: itens, asserção, ordem, cálculo, código nas alternativas | Prata | `generated_question.format` (PR B) |
| **Nem toda verdade explica** | Acertar 5 asserções-razão com resposta B (duas verdades sem relação de causa) | Ouro | Formato e gabarito |
| **Treino extra** | Responder 30 questões geradas | Bronze | Origem `AI_GENERATED` |
| **Três edições** | Finalizar provas completas de 3 edições diferentes | Ouro | Tentativas de prova |
| **Formato 2026** | Finalizar o simulado no formato de 2026 | Prata | SIM26 (migration 029) |
| **Padrão comparado** | Autoavaliar 5 discursivas com o padrão do Inep | Prata | Discursivas |
| **Memória firme** | 20 flashcards com estabilidade de 21 dias ou mais | Prata | `flashcard_review` |
| **Leitor da Biblioteca** | Ler as lições de uma área inteira | Bronze | **Novo:** registrar lição lida (migration nova, depois do PR D) |

**Tela:**
- conquistas agrupadas por tema (constância, núcleo, questões, provas, memória), com barra de progresso nas bloqueadas, como já existe em `progressOf`;
- medalhas por área com o nome da área;
- ícones novos em SVG próprio (mapa, balão de fala, laço de correção, livro);
- aviso com o Dudu `medalha`, como hoje.

**Fica de fora:**
- conquistas por velocidade;
- conquistas por número de horas;
- qualquer coisa que incentive chutar ou responder sem ler.

**Pronto quando:**
- as regras novas têm teste de unidade com dados de exemplo;
- as conquistas já cumpridas antes do deploy são concedidas na primeira carga (cálculo retroativo, como o atual);
- conferido a 320 px.

### PR H. Plano até a prova

- **Roteiro de cada dia até 29/11**, montado pelo mapa de confiança (peso da área × falta de confiança):
  - lições da Biblioteca;
  - questões oficiais e geradas;
  - flashcards;
  - um simulado por semana.
- Usa a pose `plano` do Dudu.

## 3. Regras que valem para tudo

- **Separação:** conteúdo gerado sempre sinalizado e fora das estatísticas oficiais.
- **Ids:** nunca mudar o `id` de uma questão publicada.
- **Conferência:** toda conta ou código citado é executado antes de publicar, e o `check` diz o que foi executado.
- **Projeto:**
  - CSS por componente;
  - `@defer` nas telas novas;
  - nada de `role="status"` fixo;
  - movimento curto e respeitando `prefers-reduced-motion`;
  - alvos de toque de 44 px.
- **Ao fechar cada PR:** entrada no diário do WORKBOARD.
- **Merge:** Gabriel faz o merge de cada PR.

## 4. Pendências do lado de Gabriel

- ~~Dudu refeito em alta~~: recebido e integrado em 07/11 (commits `9646068` e `d69b58b`).
- **Revisão de professor** do núcleo, das lições e das questões geradas, quando possível (recomendado, não bloqueia).
- **Nome da marca:** manter "Preparação ENADE" ou trocar para "Caderno CC", de acordo com o domínio.

## 5. Observações sobre as imagens recebidas

- **Conferência:** os 41 arquivos conferem com o SHA-256 do pacote e não têm texto legível nem marcas.
- **Capas:** formam uma série coerente.
- **Possível nova geração (não bloqueia):**
  - **Q-SD-01:** as duas "moedas" parecem argolas, e a ideia de pagamento em dobro fica fraca;
  - **Q-FG-04:** o azul é bem mais pesado que no resto da série.
