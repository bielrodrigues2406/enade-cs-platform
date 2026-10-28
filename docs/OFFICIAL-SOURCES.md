# Inventário de documentos de Computação

Consulta: 23/10/2026. O catálogo completo, com URLs oficiais, cópias, SHA-256, páginas e situação de cada arquivo está em [data/official-sources.json](../data/official-sources.json).

## Cobertura encontrada

| Edição | Escopo do documento | PDFs obtidos | Links ainda sem PDF |
| --- | --- | ---: | ---: |
| 2005 | Computação, caderno compartilhado entre bacharelados | 3 | 0 |
| 2008 | Computação, caderno compartilhado entre bacharelados | 3 | 0 |
| 2011 | Computação, com blocos comuns e específicos de cursos | 3 | 0 |
| 2014 | Ciência da Computação: Bacharelado e Licenciatura separados | 6 | 0 |
| 2017 | Ciência da Computação: Bacharelado e Licenciatura separados | 6 | 0 |
| 2021 | Ciência da Computação: Bacharelado e Licenciatura separados | 6 | 0 |
| 2024 | ENADE das Licenciaturas: cadernos 1–10, ledor, mapa e gabarito | 0 | 13 |
| 2025 | PND: Computação, cadernos e gabaritos tipos 1–5 | 1 | 9 |
| 2026 | PND: Computação, tipos 1–5 e gabarito NVDA listados no portal | 0 | 11 |
| **Total** | **Famílias e modalidades identificadas separadamente** | **28** | **33** |

Os 27 arquivos históricos incluem prova, gabarito e padrão de resposta. O 28º arquivo é o caderno PND 2025 tipo 4, localizado em cópia com nome incorreto; a identidade foi conferida pela capa e registrada no catálogo. Veja a [auditoria recente](reviews/recent-pdf-audit.md). Foram arquivados e registrados como **IMPORTED**, com revisão independente pendente. Nenhuma fonte foi marcada automaticamente como definitiva/conferida e nenhuma questão oficial foi publicada.

Foram consultadas todas as páginas anuais expostas no [índice tradicional do Inep](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade/provas-e-gabaritos), de 2004 a 2025. As seis edições históricas de Computação encontradas foram 2005, 2008, 2011, 2014, 2017 e 2021. Anos sem documento de Ciência da Computação listado não foram preenchidos com arquivos de Engenharia ou de outros cursos. As páginas e seus hashes também constam no catálogo.

A série recente usa outras páginas: [ENADE das Licenciaturas 2024](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade-das-licenciaturas/provas-e-gabaritos/2024), [PND 2025](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/prova-nacional-docente/provas-e-gabaritos/2025-1) e [PND 2026](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/prova-nacional-docente/provas-e-gabaritos/2026). A existência do link no portal não comprova disponibilidade do PDF; os 34 arquivos permanecem pendentes. PND/Licenciatura não são provas de Bacharelado de 2025/2026. O conteúdo de Bacharelado de 2026 não foi inventado nem antecipado.

## Como as cópias foram obtidas

Os PDFs históricos vieram do [acervo geacc/enade, fixado no commit a657632](https://github.com/geacc/enade/tree/a657632b72b97468c8a5eb3b433d1abb4a5511c5). Cada arquivo foi recebido por HTTPS com TLS verificado, comparado ao tamanho e blob Git desse commit, analisado com `pdfinfo` e identificado por SHA-256. Total: 39.570.434 bytes antes da compactação. Isso comprova integridade em relação à cópia catalogada, não equivalência byte a byte com o servidor do Inep, que não pôde ser consultado.

A referência oficial de cada PDF foi cruzada com a respectiva página do Inep. Endereços históricos publicados como HTTP foram preservados em `listedOfficialUrl`; o endereço usado para transporte/referência segura usa HTTPS no mesmo host/caminho. O registro guarda separadamente URL oficial e URL de obtenção da cópia. Essas informações e o arquivo não podem ser trocados após importar.

O acesso direto a `download.inep.gov.br` continuou retornando HTTP 503 com `CERTIFICATE_VERIFY_FAILED` no proxy, inclusive em uma tentativa de PDF da PND 2025. A validação TLS foi mantida. Nova tentativa em 26/10/2026 retornou HTTP 503 com falha de conexão remota, sem PDF válido. Também foram pesquisados outros repositórios, buscadores e uma captura específica no Wayback. Uma compilação de 185 páginas com material de 2024/2021/2017/2014 foi encontrada no repositório ClaraFontenele/ENADE; não foi usada como se fosse um PDF original individual nem incluída na contagem de PDFs individuais. Dois trechos dessa compilação são mantidos em catálogo auxiliar separado, com procedência e bloqueio editorial explícitos.

## Baixar todos os anos no PC

O download não depende de banco nem de `npm install`. Precisa de Node 24 e `curl` (incluído em Windows 10/11; disponível em macOS/Linux). Na raiz do projeto:

```sh
node scripts/download-sources.mjs
```

Por padrão tenta os **61 documentos** de todas as edições/famílias catalogadas. Organiza `enade-pdfs/<ano>` e grava `download-report.json`. Não apaga nem substitui arquivos existentes. Reexecutar retoma os downloads usando os hashes conhecidos ou o recibo anterior. Uma nova falha preserva o último recibo válido e fica registrada em `lastAttempt`; o processo retorna código 1, sem anunciar conclusão integral. Diretórios, PDFs e recibos definidos por symlink dentro da pasta de saída são rejeitados; o recibo é gravado com temporário exclusivo e substituição atômica.

```sh
node scripts/download-sources.mjs --source mirror --years 2005,2008,2011,2014,2017,2021 --output enade-pdfs
```

Esse segundo comando usa somente as 27 cópias históricas catalogadas. Para os recentes, há cópia individual confirmada do caderno PND 2025 tipo 4; os outros 33 documentos continuam pendentes. Divergência do hash esperado vai para `quarantine`, sem substituir a versão catalogada nem ajustar seu checksum. Arquivos sem hash anterior recebem hash calculado e continuam não revisados. O downloader confere assinatura/tamanho; `pdfinfo` é exigido posteriormente na importação.

Para transportar: compacte as pastas por ano junto ao recibo. Divida arquivos maiores que 32 MiB em pacotes menores. Após receber e extrair com conferência dos caminhos, um administrador pode importar os arquivos locais:

```sh
npm run import:sources -- --directory enade-pdfs
```

O comando usa os metadados do catálogo, revalida PDF/páginas/hash e importa como LOCAL. Caminhos que escapam da pasta, inclusive por symlink, são rejeitados. Arquivos ausentes ou divergentes são reportados; o processo não marca a fila como completa. `--years` permite selecionar edições explicitamente; a omissão inclui todas. Importações idênticas preservam o registro e sua forma de obtenção original.

## Análise do conteúdo obtido (26/10/2026)

Os 27 PDFs históricos foram baixados de novo com `download-sources.mjs --source mirror` e todos conferiram com o SHA-256 do catálogo. Análise automática com `pdftotext`/`pdfimages`; serve para planejar a transcrição, não substitui a conferência humana.

- **Todos os documentos têm camada de texto** (são PDFs digitais, não digitalizações), mas isso não garante texto utilizável: em 2014/2017 há mapeamentos de fonte incorretos que exigem OCR ou transcrição manual. A conferência deve usar a página renderizada.
- **Imagens em bitmap são poucas**: 3 a 6 por prova recente. Diagramas vetoriais podem existir e só aparecem na revisão.
- **Gabaritos**: 2014, 2017 e 2021 se declaram *definitivos*; 2005, 2008 e 2011 não trazem essa palavra e exigem confirmação antes de uso como gabarito definitivo.

| Edição | Gabarito | Objetivas no gabarito | Anuladas |
| --- | --- | ---: | --- |
| 2005 (comum) | sem "definitivo" | 77 itens de vários cursos | — |
| 2008 (comum) | sem "definitivo" | 71, com 9 discursivas na numeração | — |
| 2011 (comum) | sem "definitivo" | 50 | 13, 44 |
| 2014 Bacharelado | definitivo | 35 | nenhuma |
| 2017 Bacharelado | definitivo | 35 | nenhuma |
| 2021 Bacharelado | definitivo | 35 | 29, 33 |

Estrutura das provas recentes: 8 objetivas e 2 discursivas de Formação Geral, 27 objetivas e 3 discursivas do componente específico. Para Bacharelado, 2014, 2017 e 2021 somam **103 objetivas utilizáveis** (105 menos 2 anuladas) e 15 discursivas; os cadernos de 2005–2011 acrescentam os blocos de Computação após separar os de outros cursos.

### Bacharelado × Licenciatura

A Formação Geral é a mesma para todos os cursos da edição. No componente específico, a comparação de trechos de texto mostrou que boa parte das questões é idêntica: em 2021, as objetivas 9 a 26 e as discursivas 3 e 4 aparecem nas duas provas; só as objetivas 27 a 35 e a discursiva 5 são exclusivas do Bacharelado. As exclusivas da Licenciatura tratam de tecnologia na educação, EaD, AVA e objetos de aprendizagem. Em 2014 e 2017 a extração por colunas foi menos limpa, mas também mostrou itens comuns.

Consequências: as provas de Licenciatura não devem ser contadas integralmente como novas questões de Bacharelado. Os itens comuns podem servir como segunda procedência, sem duplicar a questão, e os exclusivos precisam de avaliação de pertinência. ENADE das Licenciaturas 2024 e PND 2025/2026 são provas docentes, identificadas separadamente. Dos 34 PDFs recentes, **33 continuam pendentes de aquisição**; o pedido de obter todos os anos permanece no escopo. Priorizar somente Bacharelado no conteúdo de R1 é a proposta D6 do quadro, ainda pendente de Gabriel.

## Extração assistida (CNT-0, etapa 1)

`npm run extract:questions -- --id enade-2021-bacharelado-exam --directory enade-pdfs` lê PDFs já baixados, confere o SHA-256 com o catálogo e grava em `.local/question-drafts/` um JSON e um relatório por prova. **Não grava no banco nem publica.** Cada questão recebe uma situação:

| Situação | Significado |
| --- | --- |
| `rascunho` | Objetiva com enunciado e cinco alternativas não vazios, A–E reconhecidas, gabarito definitivo, sem nenhum alerta. Ainda exige conferência com a página original |
| `revisao-manual` | Objetiva com algum alerta; transcrever a partir do PDF |
| `discursiva` | Fila própria; o sistema ainda não publica discursivas |
| `anulada` | Não vira questão de estudo |
| `sem-gabarito-definitivo` | Gabarito ausente ou não declarado definitivo |

Alertas e por que existem:

- `figura`: tinta fora das caixas de texto na página renderizada (desenhos vetoriais, tabelas com borda, imagens). Contar só imagens bitmap não basta: a maioria das figuras das provas é vetorial.
- `mencao-a-figura`: o texto cita figura, gráfico, tabela, diagrama, mapa, charge etc.
- `fonte-de-simbolos` e `caracteres-suspeitos`: símbolos lógicos e matemáticos saem trocados em silêncio (→ vira `®`, ∧ vira `Ù`, ¬ vira `Ø`).
- `texto-ilegivel`: o PDF entrega números de glifo no lugar de letras ("ĂƉĞŶĂƐ" = "apenas").
- `enunciado-ausente` e `alternativa-vazia`: marcadores A–E não bastam quando parte do texto não foi extraída.
- `codigo`, `tabela`, `alternativas`, `versalete`, `referencia-versalete`, `hifenizacao`, `numero-repetido`, `prova-incompleta`.
- `marcador-fonte-pdf`, `revisao-colunas-pdf` e `alternativas-reconstruidas-layout`: nas extrações nativas de 2005/2008/2011, os marcadores são confrontados com as fontes e coordenadas do XML do próprio PDF. Grades e alternativas horizontais exigem todas as letras explícitas e distribuição geométrica não ambígua; continuam sujeitas à conferência visual.

Respostas diferentes para o mesmo número no gabarito interrompem a extração desse documento, em vez de selecionar silenciosamente a primeira. A detecção de figuras é heurística; a ausência de alertas não representa aprovação editorial.

Ligaduras (fi, fl, ti) extraídas como palavras separadas ("afi rma") são juntadas e listadas em `ligatureJoins` para conferência. A extração termina no questionário de percepção e confere a numeração contra o gabarito: prova incompleta não gera rascunho.

Resultado em 26/10/2026:

| Prova | Itens | Rascunho | Revisão manual | Discursivas | Anuladas | Observação |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2021 Bacharelado | 40 | 13 | 20 | 5 | 2 | Texto limpo |
| 2021 Licenciatura | 40 | 18 | 17 | 5 | 0 | Itens comuns ao Bacharelado repetidos |
| 2017 Bacharelado/Licenciatura | 30 de 40 | 0 | 27 | 3 | 0 | Cabeçalhos de 8 questões e quase todo o texto ilegíveis |
| 2014 Bacharelado/Licenciatura | 40 | 0 | 35 | 5 | 0 | Texto ilegível |
| 2005–2011 | — | — | — | — | — | Cadernos de vários cursos: recusados, transcrição manual |

Para 2014 e 2017, o caminho seguinte é OCR da página renderizada, com revisão humana. Na revisão Codex de 26/10/2026, o ambiente tinha Tesseract 5.5.0 com `eng`/`osd`. Um ensaio da página 4 de 2014 Bacharelado, renderizada a 180 DPI, recuperou texto legível com o modelo português [`tesseract-ocr/tessdata_fast`, commit `87416418657359cb625c412a48b6e1d6d41c29bd`](https://github.com/tesseract-ocr/tessdata_fast/tree/87416418657359cb625c412a48b6e1d6d41c29bd), licença Apache-2.0; SHA-256 de `por.traineddata`: `c4932b937207a9514b7514d518b931a99938c02a28a5a5a553f8599ed58b7deb`. O ensaio ainda trocou marcadores romanos e espaçamento. O OCR agora está integrado como opção explícita (`--ocr --tessdata-dir PASTA`), com hash do modelo e versão registrados. Marcadores de alternativas só são recuperados da camada PDF quando suas coordenadas e letras estão disponíveis; não se inferem respostas pela posição. Todos os itens OCR conservam alertas e exigem confronto com o PDF.

## Texto de 2014 e 2017 recuperado pela fonte (28/10/2026)

Nessas provas a Calibri está embutida como fonte CID sem `/ToUnicode`, e a extração devolvia números de glifo ("ĂƉĞŶĂƐ" = "apenas"). Os PDFs de 2021 trazem a mesma Calibri com mapa correto e a mesma numeração de glifos (258 = "a", 393 = "p", sem conflito entre regular, negrito e itálico). `scripts/repair-calibri-text.py` monta o mapa (`data/calibri-cid-unicode.json`, 116 glifos, com os SHA-256 das quatro fontes de 2021) e grava uma **cópia derivada** de cada prova com o mapa nas fontes sem `/ToUnicode`, mais um recibo JSON. O original não é alterado; a cópia serve só para texto.

Resultado medido com o extrator da `main@3d215eb` sobre as cópias de Bacharelado:

| Prova | Antes | Depois |
| --- | --- | --- |
| 2014 | 44.909 caracteres ilegíveis; 0 rascunhos | 57 ilegíveis (quebras de página, código em fonte própria, símbolos); 40 itens, 11 rascunhos, 24 revisão, 5 discursivas |
| 2017 | 30 de 40 itens (cabeçalhos ilegíveis); 0 rascunhos | 40 de 40 itens, 9 rascunhos, 26 revisão, 5 discursivas |

Restam ilegíveis: comentários de código numa fonte com letras deslocadas ("HQTXDQWR" = "enquanto") e símbolos lógicos/de conjuntos (`ĺ` = →, `ŀ` = ∪). O extrator já manda essas questões para revisão; elas dependem da imagem da questão (ADR-010). O extrator ainda não aceita a cópia derivada diretamente: ver CNT-T1 no quadro.

## Revisão editorial ainda necessária

Os cadernos antigos são compartilhados: em 2005/2008 incluem blocos de Ciência da Computação, Engenharia e Sistemas de Informação; 2011 também inclui Licenciatura. O rótulo COMUM preserva esse fato. Não transcrever automaticamente todos os blocos como questões de Ciência da Computação.

Nos documentos recentes, conferir tipo de caderno, mapa de prova e gabarito correspondente. Mapa de prova não é gabarito. Variantes e sua deduplicação ainda exigem conferência editorial; o fluxo não resolve essa equivalência automaticamente. Imagens, anulações e discursivas continuam fora da publicação implementada. A meta de 20 questões oficiais revisadas permanece pendente; os três itens do seed continuam autorais demonstrativos.

## Entrada no banco e revisão assistida (28/10/2026)

Foram carregadas **605 ocorrências** em `question_intake` neste ambiente: 460 nos nove cadernos históricos, 81 na PND 2025 tipo 4 e 64 no caderno 0401 de 2024 derivado de compilação. Não são 605 questões únicas ou aprovadas. Todos os relatórios identificam a numeração esperada sem lacunas; isso não garante fidelidade integral do texto. A reextração de 2005/2008/2011 atualizou os mesmos 220 registros, recuperando 115 grupos de alternativas e preservando os IDs, a evidência original, as páginas, o escopo e os gabaritos. Repetir os três relatórios retornou 220 inalterados; veja a [validação histórica](reviews/legacy-options-validation.md).

| Edição | Ocorrências na fila | Limite principal |
| --- | ---: | --- |
| 2005 | 85 | Caderno compartilhado; 77 das 77 objetivas com alternativas estruturadas |
| 2008 | 80 | Caderno compartilhado; 70 das 71 objetivas estruturadas; Q8 tem alternativas visuais |
| 2011 | 55 | Caderno compartilhado; 50 das 50 objetivas com alternativas estruturadas |
| 2014 | 80 | OCR em ambos os cadernos; conferir texto e numerais romanos |
| 2017 | 80 | OCR em ambos os cadernos; conferir texto, código e figuras |
| 2021 | 80 | Análise assistida por item, incluindo 30 pares compartilhados |
| 2024 | 64 | Trechos auxiliares derivados; não substituem os originais |
| 2025 | 81 | Somente tipo 4, sem gabarito; discursiva sem número usa D1 técnico |

A fila contém 551 objetivas e 54 discursivas, incluindo anuladas e blocos de outros cursos. São 582 itens em HOLD e 23 para conferência. Nenhuma fonte foi automaticamente conferida, nenhuma revisão humana foi atribuída e nenhuma questão oficial foi publicada. O banco de produção não é preenchido automaticamente por esta entrega.

Agora 547 das 551 objetivas possuem grupos de alternativas. Essa contagem inclui cinco itens com algum texto de alternativa vazio: Q26/Q59 de 2005, Q38/Q55 de 2008 e Q27 de 2014 Bacharelado. Os alertas `alternativa-vazia` permanecem. Há ainda figuras, símbolos, código, cabeçalhos intrusos e gabaritos pendentes; nenhuma edição está integralmente pronta para publicação.

A [análise de 2008](reviews/2008-question-review.md) registra 80 entradas, com análise conceitual concentrada nas 40 pertinentes ao percurso de CC: 13 sem nova pendência e 27 com revisão manual necessária. Os outros 40 itens permanecem identificados como blocos de Engenharia/Sistemas de Informação, sem aprovação conceitual. A [análise de 2021](reviews/2021-question-review.md) registra os 80 itens, com 23 sem nova pendência conceitual e 57 exigindo revisão manual. Há também dois pareceres de 2014 em `data/question-reviews/2014-review.json`, ambos pendentes de fidelidade OCR. As respostas oficiais permanecem preservadas.

### Reproduzir a extração e a importação

Com os PDFs individuais organizados por ano/ID conforme o catálogo:

```sh
npm run extract:questions -- --id enade-2005-comum-exam,enade-2008-comum-exam,enade-2011-comum-exam,enade-2021-bacharelado-exam,enade-2021-licenciatura-exam --directory enade-pdfs --output .local/import-review/historical
npm run extract:questions -- --id enade-2014-bacharelado-exam,enade-2014-licenciatura-exam,enade-2017-bacharelado-exam,enade-2017-licenciatura-exam --directory enade-pdfs --output .local/import-review/historical --ocr --tessdata-dir CAMINHO_DOS_MODELOS
npm run extract:questions -- --id pnd-2025-computacao-pv-4 --directory enade-pdfs --output .local/import-review/recent
npm run import:questions -- --file .local/import-review/historical/enade-2008-comum-exam.questions.json --review data/question-reviews/2008-review.json
npm run import:questions -- --file .local/import-review/historical/enade-2021-bacharelado-exam.questions.json --review data/question-reviews/2021-review.json
```

O extrator usa Poppler (`pdftotext`, `pdftohtml`, `pdffonts`, `pdftoppm` e `pdfimages`, do pacote `poppler-utils`). Em 2005/2008/2011 sem OCR, a prova das letras exige fonte exclusiva A–E, ocorrências repetidas e correspondência de coordenadas; nomes de fontes e ordem das respostas não bastam. Ambiguidades conservam o texto bruto e os alertas. O OCR usa `por.traineddata` com hash e origem descritos acima; o modelo precisa existir localmente. Cada relatório é importado individualmente. Fontes precisam estar previamente cadastradas e íntegras. A ausência de gabarito, conteúdo ou imagem produz pendências; não é preenchida por suposição.

O script `node scripts/prepare-2024-auxiliary.mjs --file COMPILACAO.pdf --output .local/import-review/auxiliary` aceita somente a compilação identificada pelo SHA-256 fixado, prepara os trechos conhecidos e registra suas ferramentas e páginas em `data/auxiliary-sources.json`. A normalização do identificador do trailer permite repetir os bytes com as mesmas versões de Poppler registradas; não promete hashes idênticos entre versões diferentes. O original é somente lido. Os derivados são cadastrados como LOCAL, com títulos explícitos, e importados para HOLD; criação manual, promoção e publicação oficiais também rejeitam seus hashes enquanto forem fontes auxiliares.
