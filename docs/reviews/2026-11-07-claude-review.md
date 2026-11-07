# Revisão do avanço do Claude e padrão editorial do experimental

Data: 07/11/2026. Pedido de Gabriel: avaliar rigorosamente o progresso e preparar a parte experimental para ser o centro da preparação, com explicações corretas e fontes reconhecidas. Revisão congelada na main **e3538df**, comparada a **cb21ec9** (PR #50). São os PRs #51–#59. O PR #60 foi lido separadamente no HEAD **165d2fb**, ainda aberto durante a revisão; seu modo escuro não está incluído nos testes abaixo.

## Conclusão

O avanço é substancial e oferece uma base pedagógica utilizável: conceitos, explicações, exemplos resolvidos, recuperação ativa e ligação com exercícios. Os módulos são próprios, HTML/CSS/TS continuam separados, as questões geradas são identificadas e ficam fora das provas e do desempenho oficial. O crescimento não trouxe dependência de um modelo executado a cada acesso.

**Ainda não considero o conjunto pronto para ser a principal referência de preparação.** Há uma falha reproduzida no contrato da imagem Docker, erros conceituais pontuais, ligações históricas automáticas que erram e indicadores com nomes que exageram o que medem. As referências bibliográficas são pertinentes, mas não rastreiam cada explicação até uma seção consultada. Eu corrigiria esses pontos e estabilizaria dois ou três modelos editoriais antes de ampliar o material em volume.

Esta entrega é uma revisão, não uma correção dos arquivos do Claude. Nenhuma questão, versão publicada, conta de produção ou configuração da AWS foi alterada.

## 1. O que foi efetivamente entregue

| Entrega na main revisada | Conferência |
| --- | --- |
| Núcleo | 17 áreas, sendo 16 específicas e Formação Geral; 163 conceitos |
| Questões geradas | 163 itens: 111 ESPELHO, 22 LACUNA, 30 QUENTE |
| Lições | 23: 13 de Algoritmos e 10 de SO; 23 exemplos e 46 perguntas de recuperação |
| Figuras/ilustrações | 12 SVGs no banco gerado; catálogo de 41 ilustrações, com parte ligada às telas |
| Dudu | Ativos v2, camadas menores, pés/olhos separados e ajustes de primeira carga |
| Uso diário | Novidades sem abertura automática de modal e retomada da última questão/lição |
| Senha | Política de criação/troca e medidor; mínimo de oito é decisão de produto registrada, não achado desta revisão |
| Modo escuro | PR #60 separado, não integrado ao HEAD auditado |

Os números são dos arquivos e do ambiente local de revisão. Não comprovam que a AWS recebeu todos esses itens. A publicação das 163 geradas funcionou no checkout de desenvolvimento; isso não elimina o problema de layout do contêiner descrito em R1.

## 2. Achados com evidência e prioridade

### R1 — P1: caminho de figuras incompatível com o Docker final

Locais: `apps/api/src/generated-publication.ts:99`, `apps/api/src/core-lessons.ts:12`, `apps/api/src/core-lessons.ts:40`, `Dockerfile:23`, `apps/api/src/core-progress.ts:116`.

Os validadores procuram figuras em `apps/web/public`. O estágio final do Docker copia `dist`, `data`, migrations e scripts; não copia essa árvore de fontes. Os ativos existem em `WEB_DIST`, mas os validadores ignoram esse caminho.

Reprodução independente, sem consulta ao banco: iniciar os módulos compilados fora do checkout, com `STUDY_CONTENT_DIR` e `WEB_DIST` absolutos. Mesmo confirmando a presença dos ativos em `dist/web/browser`, o carregamento de lições falha em `/illustrations/MET-05.webp` e o parse das geradas de Algoritmos falha em `/figures/gen-alg-abb-degenerada.svg`.

Impacto: a abertura de **qualquer área** chama o carregamento de todas as lições e pode retornar 500. O bootstrap das geradas pode parar antes de publicar o primeiro arquivo. O Docker tolera falha de bootstrap e sobe a API; `/health` pode ficar saudável mesmo com essas funções quebradas.

Correção recomendada: resolver ativos no diretório efetivamente servido (`WEB_DIST` em produção e fonte em desenvolvimento), com um helper pequeno compartilhado. Regressão deve executar com o layout do runtime, sem `apps/web/public`; `NODE_ENV=production` com checkout completo não reproduz esse contrato.

### R2 — P1 de conteúdo: regra de LEFT JOIN incorreta como fato para memorizar

Local: `data/core-concepts/banco-de-dados.json:77`.

O texto afirma que uma condição na tabela da direita em `WHERE` transforma o LEFT JOIN em INNER JOIN. Isso depende da condição rejeitar os NULL produzidos pela junção. `WHERE direita.id IS NULL` é um contraexemplo direto, usado para encontrar linhas sem correspondência.

Reprodução em PostgreSQL 17, sem tabelas persistidas:

```sql
WITH a(id) AS (VALUES (1),(2)), b(id) AS (VALUES (1))
SELECT a.id FROM a LEFT JOIN b ON a.id=b.id WHERE b.id IS NULL;
-- retorna 2; a mesma consulta com INNER JOIN não retorna linhas
```

Também corrigir BCNF em `banco-de-dados.json:40`: o determinante de dependência não trivial deve ser **superchave**, não necessariamente uma chave candidata mínima. Explicitar o papel de todas as chaves candidatas na 2FN, evitando induzir que só a chave primária escolhida importa.

### R3 — P2: três explicações de questões geradas precisam de precisão

| Item | Evidência | Correção |
| --- | --- | --- |
| `gen-ia-ganho-informacao` (`inteligencia-artificial.json:169`) | Introdução atribui a ID3 e C4.5 a escolha pelo maior ganho de informação | Restringir ao ID3 ou distinguir o gain ratio/critério de seleção do C4.5. O cálculo e a alternativa B conferem |
| `gen-seg-assinatura-sigilo` (`seguranca.json:157`, `:160`) | Generaliza assinatura como cifrar com a chave privada e a propriedade de uma chave desfazer a outra | Explicar assinar/verificar como primitivas próprias; distinguir criptografia de sigilo e algoritmo/esquema. ECDSA/EdDSA não têm essa descrição de decifração |
| `gen-tc-regex-cep` (`teoria-computacao.json:131`, `:135`) | Exige rejeitar todo texto adicional, mas a conferência declarada usa Python `re.search` com `$` | Fixar engine/flags e correspondência estrita; incluir quebras finais e caracteres fora do domínio nos casos de borda |

Contraexemplo reexecutado: `re.search(r"^\d{5}-?\d{3}$", "12345-678\n")` aceita os primeiros nove de dez caracteres. JavaScript sem flag multiline recusou a mesma entrada. A engine faz parte do problema, não pode ficar implícita nesse exercício.

Não foi encontrada letra errada nos 13 cálculos reexecutados. Isso não certifica os demais itens nem torna corretas as introduções dos casos acima.

### R4 — P2: correspondência por palavra não comprova cobrança de conceito

Locais: `apps/api/src/core-concepts.ts:48`, `:142`; `apps/web/src/core-area.component.html:114`; `core-lesson.component.html:68`.

O teste de cobertura 206/206 comprova que toda questão do recorte encontrou uma palavra-chave, não que a ligação conceitual é correta. Reproduções com `loadCore()`:

- `alg-ordenacao` liga a rotação de AVL de 2017 Q9 pela palavra “inserção”. Ela não é uma questão de algoritmo de ordenação.
- O conceito de BFS/DFS liga Dijkstra de 2021 pela palavra “dígrafo”. O texto do conceito não cobre automaticamente caminhos mínimos ponderados.
- `et-impactos` fica sem ligações e a tela afirma que não caiu em 2005–2021; o próprio acervo tem 2005 Q2, “Inclusão digital e exclusão social”, em Formação Geral. O filtro por área e a ausência de discursivas/pendências limitam a busca.

Correção: manter palavras-chave como sugestão e conferir vínculos explícitos por item/conceito. Enquanto não houver comprovação, usar “sem questão ligada neste recorte do acervo”. A correção do PR #56 para falta de publicação é útil, mas não resolve esse problema de inferência.

### R5 — P2: “acerto nas questões” mostra um sinal ponderado, não a taxa observada

Locais: `apps/api/src/core-progress.ts:30`, `apps/web/src/core-area.component.html:34`.

Uma primeira resposta correta é atenuada para 20% e exibida como “Acerto nas questões”. A taxa observada é 100% em uma resposta; a atenuação pode continuar no índice de confiança, mas deve ser mostrada separadamente. Manter amostra explícita e evitar interpretar uma única resposta como domínio da matéria.

### R6 — P2: “memória nos flashcards” não considera o tempo sem revisar

Locais: `apps/api/src/core-progress.ts:46–53`, `apps/web/src/core-area.component.html:35`.

O cálculo usa apenas `stability/21`, limitado a 1. Não lê `last_review`; portanto, estabilidade ≥21 continua valendo 100% mesmo após um ano sem revisão. É um índice de estabilidade acumulada, não memória atual. Rotular com precisão ou usar a recuperabilidade estimada já disponível em `fsrs.ts`, levando o tempo em conta e sem prometer domínio certificado.

### R7 — P2: resposta atrasada de Novidades pode sobrescrever a sessão nova

Local: `apps/web/src/news.service.ts:51`.

`refresh()` guarda geração, mas `close()` não. Reprodução em memória pela revisão independente: POST de fechamento da identidade A pendente → refresh da identidade B concluído → resposta antiga de A sobrescreve o estado de B e zera suas novidades não vistas. Não foi identificado vazamento de credenciais; é uma inconsistência de isolamento do estado visual.

Correção: invalidar leituras/escritas pendentes ao trocar identidade e aplicar respostas somente na geração que as iniciou, como já faz o serviço de engajamento.

### R8 — P2: validação de senha usa dados pessoais incompletos na troca/reset

Locais: `apps/api/src/account-profile.ts:100`, `apps/api/src/admin-accounts.ts:270`.

O perfil passa apenas e-mail à política; o reset administrativo não passa os dados do alvo. A mesma política recusa `Gabriel2026!` ou um prontuário quando recebe nome/prontuário completos, mas esses contextos podem aceitá-los. O medidor do perfil conhece mais dados que a validação do servidor.

Correção: usar os dados persistidos da conta cuja senha está sendo alterada, preservando autenticação do administrador e regras de sessão existentes. Não alterar o mínimo de oito sem nova decisão de produto.

### R9 — P2 de uso: recarga/URL não preserva a lição aberta

Locais: `apps/web/src/library.component.ts`, `core-area.component.ts`, `resume.service.ts`.

Reprodução no navegador: abrir SO → Deadlock; URL permanece `/biblioteca`; recarregar e aguardar o mapa carregar; Deadlock deixa de estar aberto. A retomada pelo início funciona nos testes, mas não oferece link específico nem restauração direta por URL/Voltar/Avançar. **Não houve perda da autoavaliação persistida:** o achado é de contexto de navegação, não de respostas apagadas.

### R10 — P2 de acessibilidade: controles com papel radio não oferecem as setas esperadas

Local: `apps/web/src/core-area.component.html:82–85`.

Os níveis são botões com `role="radio"`, dentro de `radiogroup`, mas sem interação por setas/roving tabindex. Na reprodução, ArrowRight manteve o foco no primeiro botão. Implementar o padrão de radiogroup ou usar botões alternáveis com semântica apropriada. Tab/Enter acessíveis não bastam para declarar implementado o padrão de rádio.

## 3. Fontes: o que existe e o que falta

Conferência estrutural integral dos metadados, sem presumir consulta dos livros:

| Metadado | Resultado |
| --- | ---: |
| Entradas bibliográficas distintas no núcleo | 51 |
| URLs em `references` | 0 |
| Edições de livros identificadas | 0 |
| Capítulos/seções em `references` | 0 |
| Lições com referências próprias estruturadas | 0/23 |
| Questões com catálogo estruturado de fontes/versões | 0/163 |

Há autores e títulos adequados e algumas normas identificadas, como WCAG 2.2, NIST SP800-145, leis e Portaria154/2026. Alguns `check` citam artigo legal ou critério normativo em texto livre. **Não concluo que as referências ou as execuções foram inventadas.** A lacuna é a falta de rastreabilidade e de evidência recuperável por afirmação/questão. Um `check` textual não comprova sozinho execução ou leitura.

A lição herda a bibliografia inteira da área. Para o padrão solicitado por Gabriel, cada explicação deve ligar as fontes que realmente a sustentam, com edição/versão e seção consultadas. Páginas só entram se foram verificadas; não preencher de memória.

Referências candidatas para essa curadoria, sem afirmar que foram consultadas integralmente nesta auditoria:

- **SO:** Tanenbaum/Bos; Silberschatz/Galvin/Gagne.
- **Algoritmos:** Cormen/Leiserson/Rivest/Stein; Ziviani; Sedgewick/Wayne quando pertinente.
- **Redes:** Kurose/Ross; Tanenbaum e colaboradores; RFC da tecnologia e versão em questão.
- **BD:** Elmasri/Navathe; Silberschatz/Korth/Sudarshan; documentação do SGBD usado nos exemplos.
- **Teoria/compiladores:** Sipser; Hopcroft/Motwani/Ullman; Aho/Lam/Sethi/Ullman.
- **Engenharia de software:** Sommerville e bibliografia pertinente ao método, com versão quando houver norma/framework.
- **IA e segurança:** Russell/Norvig para fundamentos; literatura/documentação técnica identificada para tópicos recentes; NIST/IETF e especificação do algoritmo para criptografia.

Fontes públicas efetivamente consultadas nesta revisão:

- [PostgreSQL17 — Table Expressions, seções 7.2.1/7.2.2](https://www.postgresql.org/docs/17/queries-table-expressions.html): junções e filtros; corroborado por execução do contraexemplo SQL.
- [Python — `re`, âncoras e `fullmatch`](https://docs.python.org/3/library/re.html): documenta `$` antes da quebra final. O comportamento foi reexecutado em Python.
- [RFC8032 — EdDSA](https://www.rfc-editor.org/rfc/rfc8032.txt): distingue geração/verificação de assinatura; referência para revisar a generalização sobre cifração.

Um catálogo pequeno de referências compartilhadas, com identificadores ligados às lições/questões, basta. Não é necessário criar outro sistema de biblioteca. Sem acesso a uma obra, registrar a limitação e conferir uma fonte adequada acessível; nunca transformar bibliografia recomendada em consulta fictícia.

## 4. Padrão didático para virar o centro da preparação

As lições atuais são boas como guias essenciais: 177–301 palavras de corpo, um exemplo, um erro comum e duas perguntas cada. O tamanho não certifica profundidade. As estruturas não registram objetivos, pré-requisitos ou exercício de transferência.

Padrão proposto por conceito:

1. **Objetivo verificável:** o que o aluno deve explicar, calcular, comparar ou justificar.
2. **Pré-requisitos:** conceitos necessários e ligação à revisão correspondente.
3. **Explicação:** mecanismo e raciocínio, com condições de aplicação e limites.
4. **Exemplo resolvido:** entradas, passos, justificativas e resultado; código/conta com artefato executável quando ajudar.
5. **Contraexemplo ou contraste:** mostrar quando a regra deixa de valer, especialmente nas afirmações gerais.
6. **Memória:** resumo curto e recuperação ativa do essencial.
7. **Transferência:** uma situação nova exige aplicar e justificar, com solução comentada; pode caber no formato de perguntas já existente.
8. **Ligação ao ENADE:** questão vinculada por conteúdo conferido, com recorte histórico e origem explícitos.
9. **Fonte e revisão:** referência realmente usada, localizador, versão e data; autoria/IA e tipo efetivo de conferência.

Exemplo de melhoria sem novo módulo: em paginação, além de repetir os números da sequência de Belady já resolvida, pedir que a pessoa analise outra sequência e explique a propriedade de pilha de LRU. Em SQL, além de decorar as junções, contrastar filtro em ON, predicado que rejeita NULL e anti-join com IS NULL.

Correção, fonte e unicidade de solução são critérios obrigatórios: uma explicação bonita ou extensa não compensa um erro técnico. Usar estados independentes, como “conferência formal”, “execução reproduzida”, “revisão conceitual” e “revisão humana”, somente quando cada uma ocorreu. A autorização que dispensou segundo agente na autoria não obriga revisão humana agora, nem permite simular essa revisão.

Os padrões de distratores são úteis para ensinar a conferir condições. A auditoria de tamanho/letras deve permanecer um controle de quem escreve: o aluno precisa justificar por que uma opção vale ou falha, em vez de decorar que “sempre/nunca” determina o gabarito.

## 5. Temas atuais e incidência

Os 30 itens QUENTE incluem temas pertinentes, como RAG, injeção de prompt, MFA e reidentificação, e fundamentos em contexto atual, como regex, event loop e JIT. O rótulo não comprova recência ou chance de cobrança.

Separar: fundamento curricular; evidência histórica no recorte; contexto atual; fonte técnica/normativa e data de consulta. Leis devem distinguir texto vigente, regulamentação, orientação e proposta ainda em discussão. Não adicionar porcentagens de “chance de cair” a partir dessa classificação.

O peso histórico do mapa é descritivo e o índice de confiança é uma heurística. Não foi demonstrada calibração para prever desempenho ou aprovação. Essa parte pode orientar estudo com os rótulos corretos e amostras explícitas, sem um modelo de ML novo.

## 6. Testes, evidências e limites

- Build da main auditada passou: inicial **451,79kB**; nenhum aumento de orçamento nessa diferença.
- **231 testes API/utilitários passaram**, em banco novo `enade_claude_test`, com migrations030–033 aplicadas.
- Publicação local das **163 geradas** e auditoria automática executadas. Esta carga ocorreu no checkout completo, não em Docker.
- **20 Chromium selecionados passaram**: núcleo, lições, geradas, novidades, retomada, contas e movimento do Dudu.
- Capturas de mapa e lição em1440/768/390; sem overflow nas telas medidas. Visual mantém a identidade do caderno e não adiciona grupo ao menu.
- Reprodução adicional de navegação/teclado confirma R9/R10. A recarga foi aguardada até o mapa estar novamente pronto.
- Layout de runtime sem árvore de fontes reproduziu R1; nenhum contêiner ou servidor de produção foi alterado.
- **13 cálculos reexecutados independentemente coincidem com os gabaritos.** [Script](2026-11-07-claude/recompute.py) e [saída com IDs e hashes](2026-11-07-claude/results.json). A revisão principal reexecutou o script. Entradas foram transcritas dos enunciados daquele HEAD; não é experimento cego nem validador de futuras edições do banco. Após mudança nos enunciados, conferir novamente as entradas e hashes.
- Reexecuções dirigidas de exemplos das lições, por revisão independente, concordaram com Fibonacci, inserção, TLB, substituição de páginas, banqueiro e Round Robin.
- Auditoria de pistas: 83 simples, certa única mais longa em6%, heurística do chutador22%, I verdadeiro63%, letras A30/B32/C37/D32/E32, mediana83palavras. Essas travas formais não detectam R2/R3.

Não houve revisão semântica integral das163 questões, das163 definições ou das23lições; não certifico todo o conteúdo. Não houve auditoria com leitor de tela nem teste no servidor AWS. O PR60 recebeu somente leitura estática: tokens/seletor separados, mas contraste real de todas as superfícies e primeira pintura ainda precisam de verificação em sua própria revisão.

## 7. Ordem recomendada

1. **Correção curta de produção e fatos:** R1, R2, os três itens de R3; manter IDs e versões/tentativas anteriores.
2. **Precisão do núcleo:** vínculos conferidos e ausência histórica honesta; separar taxa de acerto, amostra e sinal usado no índice; corrigir o significado da memória.
3. **Consistência de uso:** geração de Novidades, dados da política de senha, URLs das lições e interação de autoavaliação.
4. **Padrão editorial:** aprimorar duas ou três lições piloto com fontes rastreáveis, condições e transferência; avaliar esse formato antes das outras15áreas.
5. **Revisão integral por lotes de10–15:** primeiro segurança/criptografia, legislação, IA e dependências de engine/versão; depois cálculos, diagramas e condições; registrar passou/corrigir/fonte pendente e a versão efetivamente revisada.

O objetivo é consolidar o que já foi construído e aumentar a confiança no material. Não é necessário ampliar gamificação ou número de telas para cumprir essa etapa.
