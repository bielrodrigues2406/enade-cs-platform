# Auditoria dos PDFs de 2024–2026

Consulta direta: 26/10/2026, 20:08 UTC. Busca em espelhos: 27/10/2026. Análise assistida por Codex; aprovação humana pendente.

## Resultado

Os 34 links oficiais foram consultados individualmente: todos retornaram HTTP 503 sem PDF válido. As três páginas do Inep retornaram HTTP 200 e continuam listando os mesmos arquivos. A resposta de alguns downloads registra falha de validação do certificado TLS na conexão do intermediário com a origem; outras respostas registram falha de conexão. Isso não demonstra que os documentos deixaram de existir.

| Edição | Links consultados | Cópia individual recuperada | Arquivos ainda pendentes |
| --- | ---: | ---: | ---: |
| ENADE Licenciaturas 2024 | 13 | 0 | 13 |
| PND 2025 | 10 | 1 | 9 |
| PND 2026 | 11 | 0 | 11 |
| Total | 34 | 1 | 33 |

O catálogo passa a conter 28 PDFs individuais recuperados e 33 links pendentes. A compilação auxiliar descrita abaixo permanece fora dessa contagem. Nenhuma recuperação implica publicação de questões ou aprovação editorial.

## PND 2025, tipo 4

Foi encontrada uma cópia individual no [espelho com commit fixado](https://github.com/guiyti/enade_ti/blob/61dfe08aa8a184ad5568dd92b9b147127aab98df/provas/2024_CCP.pdf). O nome `2024_CCP.pdf` está incorreto: a capa identifica **Computação, Licenciatura, outubro de 2025, tipo 04, caderno 0404**, com código `R04042025`.

A capa foi renderizada e conferida por análise assistida. O arquivo possui 40 páginas, 6.305.713 bytes, 80 questões objetivas e uma discursiva. A Formação Geral Docente contém as objetivas 1–30 e a discursiva; o Componente Específico contém as objetivas 31–80. As nove perguntas de percepção da prova não integram o banco de questões. Os cabeçalhos das 80 objetivas foram identificados sem lacunas antes desse questionário.

- SHA-256: `b9c3368a98500666baff9fb0c045f24bae83b0cac4237c58faf9e433f1c4223a`.
- Git blob conferido com o registro do espelho: `9c3fadcbf992e29cd4b1573dce7daec489cbd058`.
- Registro atualizado: `pnd-2025-computacao-pv-4`, com `reviewed: false`.

O gabarito definitivo desse tipo ainda não foi recuperado. Os metadados de terceiros não fornecem uma chave e seus campos de aprovação/confiança não foram importados. O ano deve vir da capa, nunca do nome incorreto do arquivo.

## Evidência auxiliar de 2024

A [compilação de ClaraFontenele/ENADE](https://github.com/ClaraFontenele/ENADE/blob/0776b146a714f2e9537bccb5a521dfc5d8c16a97/Enade_ProvasAntigas_24_21_17_14.pdf) possui 185 páginas e 14.637.580 bytes. O produtor `iLovePDF` identifica um arquivo modificado; ele não comprova os bytes dos PDFs originais do Inep.

- SHA-256: `5eb5a42a38c332b2a35c147cc9a3e17e1c940b465f217f135d84672ce8b0d4e8`.
- Git blob: `0e61fae7ca50a7f3fb65346737366a327c42677e`.
- Páginas 1–44: caderno ENADE 2024, Computação, Licenciatura, **0401**, código `R04012024`.
- Objetivas 1–27: Formação Geral Docente. Objetivas 28–63 e discursiva: Componente Específico.
- Discursiva na página 20; rascunho na 21; questionário de percepção na 43; contracapa na 44. Foram localizados os 63 cabeçalhos das questões objetivas sem lacunas antes do questionário.
- Páginas 45–54: gabaritos identificados visualmente como 0401–0410. Todas as tabelas possuem uma resposta por número de 1 a 63 e o título “Gabarito Definitivo”. As 630 posições foram extraídas para análise assistida.

| Caderno | Página na compilação | Item anulado (*) |
| --- | ---: | --- |
| 0401 | 45 | 15 |
| 0402 | 46 | 24 |
| 0403 | 47 | 6 |
| 0404 | 48 | 6 |
| 0405 | 49 | 24 |
| 0406 | 50 | Nenhum indicado |
| 0407 | 51 | Nenhum indicado |
| 0408 | 52 | Nenhum indicado |
| 0409 | 53 | Nenhum indicado |
| 0410 | 54 | 15 |

Essa evidência permite iniciar a conferência das questões de 2024 e de suas respostas com a origem auxiliar explícita. Ela **não** foi cadastrada como 11 PDFs originais nem substitui os arquivos catalogados de prova, mapa ou gabarito. A ausência do mapa de provas impede assumir que todos os cadernos contenham apenas permutações do mesmo conjunto de questões.

Os hashes, os resultados dos 34 downloads e as chaves auxiliares estão em [recent-pdf-evidence.json](recent-pdf-evidence.json). As chaves usam posições 1–63 e `*` para item anulado; não constituem aprovação humana.

## Pendências concretas

Em 2024, faltam os 11 cadernos individuais, o mapa e o PDF original com os dez gabaritos. Em 2025, faltam os tipos 1, 2, 3 e 5 e os cinco gabaritos. Em 2026, faltam os cinco cadernos e seis arquivos de gabarito, incluindo NVDA. Os links oficiais e o pacote de download local continuam sendo os caminhos para completar essas aquisições.
