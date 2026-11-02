# CNT-FINAL — preparação para conferência independente

Base: `e1356b3`. Autoria e extração desta rodada: `codex-content-author-2026-11-02`. Este registro descreve propostas; não aprova conteúdo e não representa revisão humana. Não foram alterados lotes ativos nem executadas publicação, banco ou testes de aplicação.

## Preparado

- **19 explicações**, em `data/agent-reviews/explanations/*completion-2026-11-02.explain.json` (`3b488ba`): 2005 Q69; 2008 Q28; 2011 Q18; 2017 Bacharelado Q9/Q18; 2017 Licenciatura Q22–Q35. Os textos usam a imagem e o gabarito catalogados, com hashes e referência ao lote anterior. Comprimento de 132 a 189 palavras, até três parágrafos. Manifestos, ordem dos fragmentos e SHA-256 dos recortes conferidos. O conferente deve examinar as propostas, sem reescrevê-las em seu próprio nome.
- **Quatro discursivas**, em `data/discursive-reviews/pending/` (`a87090b`): 2005 Q55 e 2008 Q20/Q39/Q40. Os 14 WebP, com 1.079.926 bytes no total, estão em `data/discursive-crops/`; os metadados registram caixas, páginas físicas e integridade. Os PDFs originais coincidem com o catálogo e foram preservados. [Roteiro e ressalvas](../../data/discursive-reviews/pending/README.md).

No estado ativo desta base há **246 objetivas aprovadas**, sem chaves repetidas entre os lotes: 227 têm `explanationCheck: OK`, cinco têm explicação recusada e 14 ainda não têm explicação conferida. As 19 propostas correspondem exatamente a essas cinco mais 14. As 35 discursivas anteriores permanecem ativas; as quatro novas não entram nessa contagem antes da conferência/publicação.

## Ressalvas para o conferente

- **2011 Q18:** o gabarito B pressupõe execução nativa e compatibilidade binária. A afirmativa IV, tomada literalmente, pode ser verdadeira quando uma máquina de 64 bits compila um executável de 32 bits. A proposta preserva essa limitação em `keyConcern` e propõe nota ao estudante. Não apresentar a largura dos registradores da máquina de compilação como condição suficiente da arquitetura do executável.
- **2005 Q55 discursiva:** os pesos do enunciado são a=4/b=6. O padrão detalha máximos a=2/b1=2/b2=2 e não esclarece sua conversão. Mantidos os pesos impressos, conforme ADR-013, com ressalva explícita; nenhum critério novo foi inventado.
- **2008 Q40 discursiva:** o sinal de renda no diagrama diverge do SQL, e UNION pode eliminar duplicatas de nome/endereço. Ambas as limitações estão descritas no rascunho.
- **2005 Q70 discursiva:** anulada na fonte; não publicar. Ainda faltam padrões verificáveis para Formação Geral 2005 Q8/Q9/Q10 e 2008 Q9/Q10. As outras discursivas do caderno compartilhado pertencem a outros componentes de curso.

## Substituição dos lotes sem perder autoria

O publicador (`apps/api/src/assisted-publication.ts`) compara o digest desejado apenas à versão corrente. Se dois lotes ativos contiverem a mesma questão com explicações diferentes, o primeiro poderá repor o texto antigo e o segundo criar outra versão com o novo em cada bootstrap. A ordem dos arquivos não resolve a criação reiterada de versões. Essa conclusão vem da leitura do código; não foi executado experimento no banco.

Após a conferência independente, manter uma única entrada ativa por `(document, key)`. A proposta é arquivar a íntegra de cada lote original em `data/agent-reviews/superseded/` e retirar do lote ativo apenas os itens substituídos. Os itens restantes mantêm exatamente os operadores e as decisões históricos. Novos lotes registram o extrator original real, o explicador desta rodada e o conferente que efetivamente a examinou. Não atribuir a conferência nova a todo o lote antigo.

| Lote ativo original | Itens a substituir | Itens que permanecem |
| --- | --- | --- |
| `enade-2005-comum-exam-q53-q69.json` | Q69 | 15 |
| `enade-2008-comum-exam-q23-q38.json` | Q28 | 15 |
| `enade-2011-comum-exam-q1-q20.json` | Q18 | 18 |
| `enade-2017-bacharelado-exam-q1-q18.json` | Q9/Q18 | 16 |
| `enade-2017-licenciatura-exam-q22-q35.json` | Q22–Q35 | 0: arquivar o arquivo inteiro |

A cópia em `superseded/` precisa ser byte a byte igual ao arquivo anterior à separação. Não reescrever o arquivo arquivado para mudar autoria, datas, notas ou decisões. O bootstrap lê JSON apenas no nível superior de `data/agent-reviews/`; `explanations/` e `superseded/` ficam de fora. O mesmo vale para `data/discursive-reviews/pending/`.

Na integração, verificar unicidade das chaves aprovadas ativas e repetir o bootstrap em ambiente de validação controlado: a segunda execução deve manter conteúdo, versões e contagens. Essa validação depende de banco e fica com quem integra. Não há autorização de aprovação registrada por esta preparação.

## Conferência independente — Codex raiz, 02/11/2026

Conferente real: `codex-root-review-2026-11-02`, distinto do autor
`codex-content-author-2026-11-02` e dos extratores anteriores. Foram abertos os 19 recortes
objetivos, suas alternativas e os 14 fragmentos discursivos. O raciocínio das explicações
foi confrontado com as questões e os gabaritos já catalogados. Manifestos e recortes foram
conferidos por SHA-256; as quatro fontes PDF locais coincidem com os hashes catalogados.

Aprovadas as 19 explicações, com nota explícita sobre a interpretação do gabarito em
2011 Q18. Nenhuma explicação afirma que largura de registrador da máquina de compilação
fixa necessariamente a arquitetura do binário. Aprovadas as quatro discursivas, preservando
as ressalvas de pontuação de 2005 Q55 e do diagrama/UNION de 2008 Q40. Os valores de
autoavaliação são os impressos no enunciado, sem critérios adicionais atribuídos ao Inep.

Os cinco lotes originais foram copiados byte a byte para `superseded/`; apenas as entradas
substituídas saíram dos lotes ativos. Os novos lotes mantêm autoria real e conferente desta
rodada. A unicidade foi verificada: 246 objetivas aprovadas e 246 explicações OK, mais 39
discursivas aprovadas. Propostas em subdiretórios continuam como registro da preparação.

Ainda pendem publicação em banco isolado e repetição idempotente do bootstrap. Isso não
representa deploy nem publicação em ambiente de produção. 2005 Q60 continua bloqueada
pela imagem ilegível; 2005 Q70 discursiva permanece anulada. As cinco de Formação Geral
sem padrão e os PDFs recentes continuam fora do acervo aprovado.
