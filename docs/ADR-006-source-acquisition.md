# ADR 006 — Cópias, importação local e cadernos compartilhados

Data: 23/10/2026. Estado: adotada para a base de desenvolvimento.

O catálogo de documentos passa a cobrir todas as edições de Computação localizadas no portal, com famílias/modalidades explícitas. A obtenção do arquivo e sua referência oficial são registradas separadamente. Isso permite usar cópias públicas e arquivos enviados localmente durante a indisponibilidade TLS do servidor do Inep.

A migration 006 acrescenta `acquisition_method` (DIRECT/MIRROR/LOCAL) e `retrieval_url`. Registros anteriores continuam DIRECT. MIRROR exige URL HTTPS de `raw.githubusercontent.com` fixada em SHA completo de commit, sem credenciais, porta, query ou fragmento. DIRECT e LOCAL não inventam uma URL de obtenção. A ferramenta local verifica cada destino de redirecionamento; não desabilita TLS. Hash, referência, forma de obtenção e URL da cópia são imutáveis, inclusive antes da conferência. Reimportar bytes idênticos preserva a procedência original.

LOCAL significa que o servidor recebeu um arquivo do sistema local. A referência oficial ou um recibo fornecido junto não comprova um download direto desse endereço. A inspeção da cópia, fidelidade do conteúdo e caráter definitivo do gabarito continuam sendo atos humanos separados da importação. Não criar contas ou registrar aprovação em nome de pessoas para preencher essa etapa.

COMUM identifica documentos que contêm blocos de cursos/modalidades diferentes. Substitui o rótulo incorreto de Bacharelado para o documento inteiro nos cadernos compartilhados de 2005, 2008 e 2011. EXAM_MAP identifica mapas de prova e não é aceito como prova ou gabarito na procedência de uma questão. A apresentação de estudo usa “Edição” e o título da fonte para não tratar PND como Bacharelado ENADE.

O catálogo versionado guarda referências oficiais, snapshots das páginas, cópias fixadas, checksums e pendências por documento. Não contém PDFs binários nem marca revisão automática. O downloader para PC funciona sem banco, mantém recibos para retomada, preserva arquivos existentes e separa divergências em quarentena. Hashes das cópias não são assinaturas do Inep. Arquivos novos sem referência anterior permanecem não revisados mesmo quando o download termina.

A importação em lote aceita uma pasta já extraída e um catálogo conhecido. Não descompacta ZIPs. Valida IDs e caminhos reais para impedir leitura fora da pasta por symlink/traversal; cada arquivo passa pelo importador individual, com limites de 10 MiB, assinatura PDF, páginas via `pdfinfo` e hash esperado quando conhecido. Falhas/ausências não são tratadas como sucesso integral.

Os arquivos e recibos locais precisam de persistência/backup junto ao banco, como definido na ADR 004. Não são parte do seed e não há download de 61 documentos no setup obrigatório. Depois de restaurar uma máquina, conferir a presença de arquivos/registros; o catálogo e as ferramentas permitem reproduzir a aquisição conhecida. A conferência humana e as pendências mais recentes permanecem explícitas no inventário.

Limites: não há publicação automática, garantia de equivalência entre variantes de caderno, deduplicação entre provas compartilhadas, novas mídias no enunciado, discursivas ou revogação editorial. Ter o PDF não significa que uma questão já foi transcrita e revisada.
