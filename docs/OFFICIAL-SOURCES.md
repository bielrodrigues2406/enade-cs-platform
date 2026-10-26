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

Por padrão tenta os **61 documentos** de todas as edições/famílias catalogadas. Organiza `enade-pdfs/<ano>` e grava `download-report.json`. Não apaga nem substitui arquivos existentes. Reexecutar retoma os downloads usando os hashes conhecidos ou o recibo anterior. Falhas são registradas e o processo retorna código 1, sem anunciar conclusão integral.

```sh
node scripts/download-sources.mjs --source mirror --years 2005,2008,2011,2014,2017,2021 --output enade-pdfs
```

Esse segundo comando usa somente as 27 cópias históricas catalogadas. Não existe cópia individual alternativa confirmada para os 34 documentos recentes. Divergência do hash esperado vai para `quarantine`, sem substituir a versão catalogada nem ajustar seu checksum. Arquivos sem hash anterior recebem hash calculado e continuam não revisados. O downloader confere assinatura/tamanho; `pdfinfo` é exigido posteriormente na importação.

Para transportar: compacte as pastas por ano junto ao recibo. Divida arquivos maiores que 32 MiB em pacotes menores. Após receber e extrair com conferência dos caminhos, um administrador pode importar os arquivos locais:

```sh
npm run import:sources -- --directory enade-pdfs
```

O comando usa os metadados do catálogo, revalida PDF/páginas/hash e importa como LOCAL. Caminhos que escapam da pasta, inclusive por symlink, são rejeitados. Arquivos ausentes ou divergentes são reportados; o processo não marca a fila como completa. `--years` permite selecionar edições explicitamente; a omissão inclui todas. Importações idênticas preservam o registro e sua forma de obtenção original.

## Revisão editorial ainda necessária

Os cadernos antigos são compartilhados: em 2005/2008 incluem blocos de Ciência da Computação, Engenharia e Sistemas de Informação; 2011 também inclui Licenciatura. O rótulo COMUM preserva esse fato. Não transcrever automaticamente todos os blocos como questões de Ciência da Computação.

Nos documentos recentes, conferir tipo de caderno, mapa de prova e gabarito correspondente. Mapa de prova não é gabarito. Variantes e sua deduplicação ainda exigem conferência editorial; o fluxo não resolve essa equivalência automaticamente. Imagens, anulações e discursivas continuam fora da publicação implementada. A meta de 20 questões oficiais revisadas permanece pendente; os três itens do seed continuam autorais demonstrativos.
