# Inventário inicial de fontes oficiais

Consulta em 22/10/2026. Este inventário registra documentos localizados; não é um lote de questões revisadas.

A [página de provas e gabaritos ENADE 2021 do Inep](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade/provas-e-gabaritos/2021) foi acessada e continha os links abaixo, associados a Ciência da Computação — Bacharelado.

| Tipo proposto | Edição / área / modalidade | Documento indicado pela página |
| --- | --- | --- |
| EXAM | 2021 / Ciência da Computação / BACHARELADO | [Prova](https://download.inep.gov.br/enade/provas_e_gabaritos/2021_PV_bacharelado_ciencia_computacao.pdf) |
| ANSWER_KEY | 2021 / Ciência da Computação / BACHARELADO | [Gabarito](https://download.inep.gov.br/enade/provas_e_gabaritos/2021_GB_bacharelado_ciencia_computacao.pdf) |
| RESPONSE_STANDARD | 2021 / Ciência da Computação / BACHARELADO | [Padrão de resposta](https://download.inep.gov.br/enade/padrao_resposta/2021_bacharelado_ciencia_computacao.pdf) |

## Estado confirmado

- Página HTML acessada: 234903 bytes; SHA-256 `4418ee9f7a23b191cf97e4d4a6b6f1df1aa7cdc33bc4cb7dacc7bc3f8443594b`. Esse hash identifica a página consultada, não os PDFs.
- Os três GETs de PDF retornaram HTTP 503; o proxy Envoy informou falha de validação TLS do servidor de destino (`CERTIFICATE_VERIFY_FAIL`). O domínio já atravessava a allowlist nessa tentativa. A verificação TLS foi preservada.
- Nenhum PDF válido foi obtido; hash, tamanho e número de páginas dos PDFs permanecem desconhecidos. Nenhum registro real foi importado ou conferido e nenhuma questão oficial foi publicada.
- O caráter definitivo do gabarito não foi confirmado. O nome do arquivo e a presença na página não substituem a conferência do documento.

## Continuidade

Após restabelecer uma conexão TLS válida, executar o importador documentado no README para cada documento, conferir seu conteúdo e metadados com outra pessoa de curadoria e registrar parecer. Só então transcrever os itens compatíveis com o formato atual (objetivos, texto e alternativas, sem dependência de imagem ou anulação), associando página, número original e gabarito definitivo. A explicação deve ter autoria editorial identificada.

Os documentos sintéticos dos testes exercitam o fluxo, não representam provas oficiais e são removidos no teardown. Os três itens do seed continuam autorais demonstrativos. A meta do lote inicial de 20 itens permanece pendente; não há contagem fictícia de conteúdo entregue.
