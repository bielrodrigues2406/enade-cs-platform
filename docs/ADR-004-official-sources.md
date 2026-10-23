# ADR 004 — Fontes oficiais e procedência por versão

Data: 22/10/2026. Estado: adotada para a base de desenvolvimento.

## Resultado

O fluxo registra PDFs oficiais, permite conferência independente e vincula questões oficiais à prova e ao gabarito definitivo. A migration 005 substitui o bloqueio absoluto de publicação oficial da migration 001 por invariantes de procedência. Isso permite preparar um lote real; não certifica automaticamente correção pedagógica, transcrição ou direitos de material de terceiros.

`source_document` identifica o documento pelo SHA-256 dos bytes, com URL oficial, tipo, edição, área, modalidade, tamanho e total de páginas. `source_event` registra importação, edição e conferência. A fonte começa IMPORTED, pode ser devolvida REJECTED e editada para nova conferência; VERIFIED é imutável. Importador e último editor não podem conferir o próprio registro. Importações administrativas sem ator usam NULL no evento, sem fingir uma identidade humana.

## Importação e arquivo

A ferramenta local aceita somente HTTPS em `download.inep.gov.br/enade/` e `www.gov.br/inep/`, com caminho terminado em `.pdf`, sem porta, credenciais, query ou fragmento. Valida cada destino de até três redirecionamentos antes de acessá-lo. Mantém verificação TLS, limita download a 10 MiB e 30 segundos, e confere assinatura PDF e páginas via `pdfinfo` com limite de execução. Não há download arbitrário, upload ou concessão de papel via API.

O arquivo é armazenado como `<sha256>.pdf` em `.local/sources`, ou `SOURCE_ARCHIVE_DIR`. Importar novamente o mesmo arquivo/metadados é idempotente; bytes ausentes/corrompidos são restaurados por rename atômico. Arquivos válidos são preservados. O banco e o arquivo não compartilham uma transação: uma falha de banco pode deixar arquivo órfão; a limpeza administrativa deve conferir referências antes de removê-lo. Não há limpeza automática nem suporte a armazenamento de objetos nesta base.

Conferência e publicação revalidam assinatura, tamanho e hash do arquivo. Download arquivado exige curadoria e usa attachment com CSP restritiva. O serviço web não interpreta o conteúdo PDF. Metadados e conteúdo continuam não confiáveis; a conferência humana confirma origem, edição e integridade, e confirma expressamente que um gabarito é definitivo. O nome do arquivo sozinho não comprova isso.

## Questões e histórico

Questão oficial exige fontes VERIFIED dos tipos EXAM e ANSWER_KEY, com mesma edição/área/modalidade e gabarito definitivo. Cada versão registra página da prova, número original e página do gabarito. A identidade lógica é única por prova/número; origem e identidade oficial não mudam. Triggers e FKs protegem a ligação no banco. O crédito do item é Inep; o comentário editorial recebe crédito separado e não é apresentado como explicação oficial.

Publicação continua exigindo outra pessoa, diferente do criador e último editor da versão, e acrescenta confirmação da transcrição/procedência. A revisão de documentos e a revisão da questão são atos distintos. Uma correção do gabarito usa novo documento e nova versão editorial; não altera o feedback de respostas históricas. A conferência de fontes não lê automaticamente alternativas corretas, anulações, imagens ou conteúdo discursivo.

O estudante vê prova, hash, edição, página e número original. O gabarito e o comentário só aparecem no feedback depois da resposta confirmada. URLs oficiais são públicas e podem ser consultadas externamente. A API pública não oferece o arquivo arquivado nem dados privados dos curadores.

## Limites e evidência

Não há OCR, extração automática, imagens no enunciado, deduplicação entre diferentes cadernos, itens anulados/discursivos, paginação do registro ou revogação de publicação. Questões que dependem desses recursos aguardam outro incremento. Preservar banco e arquivos em armazenamento persistente, com backup/restauração ensaiados, é requisito antes de produção.

Testes usam documentos sintéticos explicitamente identificados, PostgreSQL real e Chromium. Exercitam revisão independente, CAS, imutabilidade SQL, ausência/corrupção de arquivo, recuperação por reimportação, procedência incompatível, segredo do gabarito antes de responder e histórico após novo gabarito. Esses fixtures não compõem um lote oficial. O [inventário](OFFICIAL-SOURCES.md) separa os documentos encontrados do conteúdo efetivamente conferido/publicado.
