# Alternativas históricas · validação de 28/10/2026

Entrega CNT-I2, PR [#15](https://github.com/bielrodrigues2406/enade-cs-platform/pull/15). A extração nativa de 2005/2008/2011 passou a confrontar fontes e posições dos marcadores com o XML do próprio PDF. Letras comuns na prosa não bastam; grades só são separadas quando há letras e coordenadas explícitas, sem inferir escolhas pelo gabarito.

| Caderno | Itens preservados | Objetivas com alternativas antes | Depois |
| --- | ---: | ---: | ---: |
| 2005 compartilhado | 85 | 35/77 | 77/77 |
| 2008 compartilhado | 80 | 0/71 | 70/71 |
| 2011 compartilhado | 55 | 47/50 | 50/50 |

São 115 grupos recuperados. Nenhum grupo anteriormente estruturado foi perdido. Nenhuma chave, tipo, numeração, página, resposta, bloco ou identificação de curso mudou. Os marcadores das fontes selecionadas foram todos associados às posições da camada textual, sem ocorrências XML não correspondidas. A estrutura das alternativas não certifica sua fidelidade: quatro itens desses cadernos ainda têm texto de alternativa vazio; Q8 de 2008 depende de obras visuais e permanece sem grupo textual.

Na comparação de controle, as extrações nativas de 2021 Bacharelado/Licenciatura, PND 2025 tipo 4 e o derivado auxiliar de 2024 preservaram exatamente chaves, tipos, números, páginas, alternativas, enunciados, respostas, blocos e escopos. Os arquivos foram conferidos contra os hashes catalogados. O ensaio auxiliar redirecionou somente importação do helper e pasta de saída para uma cópia local, evitando alterar o catálogo rastreado. OCR não recebeu a nova anotação de fontes; não foi reexecutado neste incremento.

## Banco e conteúdo

A importação administrativa atualizou os mesmos 220 itens antigos. A segunda execução retornou **220 inalterados**, zero inseridos, atualizados ou protegidos. A comparação dos snapshots confirmou os mesmos 605 IDs e evidências originais; os registros das demais edições permaneceram iguais. Não havia edição humana ou rascunho nesses itens. Os testes existentes verificam a proteção desses estados em reimportações.

O total permanece em 605 ocorrências privadas, sendo 551 objetivas e 54 discursivas; 582 HOLD e 23 PENDING. Há 547 objetivas com grupos de alternativas, incluindo cinco com algum texto vazio: 2005 Q26/Q59, 2008 Q38/Q55 e 2014 Bacharelado Q27. Os respectivos alertas permanecem. Nenhuma fonte recebeu aprovação automática e nenhuma questão oficial foi publicada.

A [revisão assistida de 2008](2008-question-review.md) tem 80 entradas: 13 sem nova pendência específica e 67 com revisão manual necessária. A análise conceitual cobre o percurso de CC, sem aprovar os outros blocos. Foram mantidas ressalvas sobre símbolos, figuras, cabeçalhos intrusos e divergências do próprio PDF. O gabarito antigo continua sem comprovação de caráter definitivo.

Outra busca pelo gabarito PND 2025 tipo 4 não encontrou PDF válido: o endereço oficial retornou HTTP 503; as buscas em cópias públicas não localizaram o arquivo correspondente. A cobertura documental segue em 28 PDFs individuais obtidos e 33 pendentes, além dos derivados auxiliares separados.

## Verificações executadas

```sh
npm run extract:questions -- --id enade-2005-comum-exam,enade-2008-comum-exam,enade-2011-comum-exam --directory .local/import-review/bundle --output .local/import-review/legacy-options
node --import tsx --test tests/question-extraction*.test.ts
npm run build
npm test
npm run test:e2e -- --timeout=60000
```

Passaram os 30 testes focados do extrator, o build, os 94 testes API/PostgreSQL/utilitários e os 22 fluxos Chromium. As suítes completas foram executadas em sequência, com banco local real. A revisão cruzada de outro agente Codex examinou código, testes, limites e revisão de conteúdo, sem bloqueadores; confirmou visualmente as páginas PDF 8, 15 e 17 de 2008. Essa revisão de agente não é aprovação editorial humana.

Relatórios, snapshots, recibos e logs ficam em `.local/import-review/legacy-options/`, ignorados pelo Git. O pacote privado `.local/exports/revisao-importacao-questoes.zip` foi atualizado com o conteúdo atual, as três análises assistidas e os recibos. Imagens e fórmulas ainda exigem preparação e conferência; nenhuma edição está integralmente pronta para publicação.
