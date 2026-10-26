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
| 2025 | PND: Computação, cadernos e gabaritos tipos 1–5 | 0 | 10 |
| 2026 | PND: Computação, tipos 1–5 e gabarito NVDA listados no portal | 0 | 11 |
| **Total** | **Famílias e modalidades identificadas separadamente** | **27** | **34** |

Os 27 arquivos incluem prova, gabarito e padrão de resposta. Foram arquivados e registrados como **IMPORTED**, com revisão independente pendente. Nenhuma fonte foi marcada automaticamente como definitiva/conferida e nenhuma questão oficial foi publicada.

Foram consultadas todas as páginas anuais expostas no [índice tradicional do Inep](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade/provas-e-gabaritos), de 2004 a 2025. As seis edições históricas de Computação encontradas foram 2005, 2008, 2011, 2014, 2017 e 2021. Anos sem documento de Ciência da Computação listado não foram preenchidos com arquivos de Engenharia ou de outros cursos. As páginas e seus hashes também constam no catálogo.

A série recente usa outras páginas: [ENADE das Licenciaturas 2024](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade-das-licenciaturas/provas-e-gabaritos/2024), [PND 2025](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/prova-nacional-docente/provas-e-gabaritos/2025-1) e [PND 2026](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/prova-nacional-docente/provas-e-gabaritos/2026). A existência do link no portal não comprova disponibilidade do PDF; os 34 arquivos permanecem pendentes. PND/Licenciatura não são provas de Bacharelado de 2025/2026. O conteúdo de Bacharelado de 2026 não foi inventado nem antecipado.

## Como as cópias foram obtidas

Os PDFs históricos vieram do [acervo geacc/enade, fixado no commit a657632](https://github.com/geacc/enade/tree/a657632b72b97468c8a5eb3b433d1abb4a5511c5). Cada arquivo foi recebido por HTTPS com TLS verificado, comparado ao tamanho e blob Git desse commit, analisado com `pdfinfo` e identificado por SHA-256. Total: 39.570.434 bytes antes da compactação. Isso comprova integridade em relação à cópia catalogada, não equivalência byte a byte com o servidor do Inep, que não pôde ser consultado.

A referência oficial de cada PDF foi cruzada com a respectiva página do Inep. Endereços históricos publicados como HTTP foram preservados em `listedOfficialUrl`; o endereço usado para transporte/referência segura usa HTTPS no mesmo host/caminho. O registro guarda separadamente URL oficial e URL de obtenção da cópia. Essas informações e o arquivo não podem ser trocados após importar.

O acesso direto a `download.inep.gov.br` continuou retornando HTTP 503 com `CERTIFICATE_VERIFY_FAILED` no proxy, inclusive em uma tentativa de PDF da PND 2025. A validação TLS foi mantida. Nova tentativa em 26/10/2026 retornou HTTP 503 com falha de conexão remota, sem PDF válido. Também foram pesquisados outros repositórios, buscadores e uma captura específica no Wayback. Uma compilação de 185 páginas com material de 2024/2021/2017/2014 foi encontrada no repositório ClaraFontenele/ENADE; não foi usada como se fosse um PDF original individual nem incluída na contagem de 27 documentos.

## Baixar todos os anos no PC

O download não depende de banco nem de `npm install`. Precisa de Node 24 e `curl` (incluído em Windows 10/11; disponível em macOS/Linux). Na raiz do projeto:

```sh
node scripts/download-sources.mjs
```

Por padrão tenta os **61 documentos** de todas as edições/famílias catalogadas. Organiza `enade-pdfs/<ano>` e grava `download-report.json`. Não apaga nem substitui arquivos existentes. Reexecutar retoma os downloads usando os hashes conhecidos ou o recibo anterior. Uma nova falha preserva o último recibo válido e fica registrada em `lastAttempt`; o processo retorna código 1, sem anunciar conclusão integral. Diretórios, PDFs e recibos definidos por symlink dentro da pasta de saída são rejeitados; o recibo é gravado com temporário exclusivo e substituição atômica.

```sh
node scripts/download-sources.mjs --source mirror --years 2005,2008,2011,2014,2017,2021 --output enade-pdfs
```

Esse segundo comando usa somente as 27 cópias históricas catalogadas. Não existe cópia individual alternativa confirmada para os 34 documentos recentes. Divergência do hash esperado vai para `quarantine`, sem substituir a versão catalogada nem ajustar seu checksum. Arquivos sem hash anterior recebem hash calculado e continuam não revisados. O downloader confere assinatura/tamanho; `pdfinfo` é exigido posteriormente na importação.

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
| 2005 (comum) | sem "definitivo" | 54 itens de vários cursos | — |
| 2008 (comum) | sem "definitivo" | discursivas misturadas na numeração | — |
| 2011 (comum) | sem "definitivo" | 50 | 13, 44 |
| 2014 Bacharelado | definitivo | 35 | nenhuma |
| 2017 Bacharelado | definitivo | 35 | nenhuma |
| 2021 Bacharelado | definitivo | 35 | 29, 33 |

Estrutura das provas recentes: 8 objetivas e 2 discursivas de Formação Geral, 27 objetivas e 3 discursivas do componente específico. Para Bacharelado, 2014, 2017 e 2021 somam **103 objetivas utilizáveis** (105 menos 2 anuladas) e 15 discursivas; os cadernos de 2005–2011 acrescentam os blocos de Computação após separar os de outros cursos.

### Bacharelado × Licenciatura

A Formação Geral é a mesma para todos os cursos da edição. No componente específico, a comparação de trechos de texto mostrou que boa parte das questões é idêntica: em 2021, as objetivas 9 a 26 e as discursivas 3 e 4 aparecem nas duas provas; só as objetivas 27 a 35 e a discursiva 5 são exclusivas do Bacharelado. As exclusivas da Licenciatura tratam de tecnologia na educação, EaD, AVA e objetos de aprendizagem. Em 2014 e 2017 a extração por colunas foi menos limpa, mas também mostrou itens comuns.

Consequências: as provas de Licenciatura não devem ser contadas integralmente como novas questões de Bacharelado. Os itens comuns podem servir como segunda procedência, sem duplicar a questão, e os exclusivos precisam de avaliação de pertinência. ENADE das Licenciaturas 2024 e PND 2025/2026 são provas docentes, identificadas separadamente. Seus **34 PDFs continuam pendentes de aquisição**; o pedido de obter todos os anos permanece no escopo. Priorizar somente Bacharelado no conteúdo de R1 é a proposta D6 do quadro, ainda pendente de Gabriel.

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

Para 2014 e 2017, o caminho seguinte é OCR da página renderizada, com revisão humana. Na revisão Codex de 26/10/2026, o ambiente tinha Tesseract 5.5.0 com `eng`/`osd`. Um ensaio da página 4 de 2014 Bacharelado, renderizada a 180 DPI, recuperou texto legível com o modelo português [`tesseract-ocr/tessdata_fast`, commit `87416418657359cb625c412a48b6e1d6d41c29bd`](https://github.com/tesseract-ocr/tessdata_fast/tree/87416418657359cb625c412a48b6e1d6d41c29bd), licença Apache-2.0; SHA-256 de `por.traineddata`: `c4932b937207a9514b7514d518b931a99938c02a28a5a5a553f8599ed58b7deb`. O ensaio ainda trocou marcadores romanos e espaçamento. OCR não foi integrado ao extrator e não gera automaticamente candidatos aprovados; cada item continua exigindo confronto com o PDF.

## Revisão editorial ainda necessária

Os cadernos antigos são compartilhados: em 2005/2008 incluem blocos de Ciência da Computação, Engenharia e Sistemas de Informação; 2011 também inclui Licenciatura. O rótulo COMUM preserva esse fato. Não transcrever automaticamente todos os blocos como questões de Ciência da Computação.

Nos documentos recentes, conferir tipo de caderno, mapa de prova e gabarito correspondente. Mapa de prova não é gabarito. Variantes e sua deduplicação ainda exigem conferência editorial; o fluxo não resolve essa equivalência automaticamente. Imagens, anulações e discursivas continuam fora da publicação implementada. A meta de 20 questões oficiais revisadas permanece pendente; os três itens do seed continuam autorais demonstrativos.
