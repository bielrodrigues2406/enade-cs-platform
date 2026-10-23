# ADR 003 — Curadoria autoral e versões publicadas

Data: 22/10/2026. Estado: adotada para a base de desenvolvimento.

## Resultado e limite de conteúdo

A curadoria permite criar uma questão autoral, salvar rascunho, enviar para revisão, devolver para correção, publicar e preparar nova versão. Esta decisão originalmente cobria apenas questões autorais. A [ADR 004](ADR-004-official-sources.md) amplia o fluxo para questões oficiais e substitui o bloqueio inicial da migration 001 por procedência obrigatória e conferência independente. Conteúdo gerado por IA continua fora deste fluxo.

A autoria editorial é um crédito público informado no conteúdo. Identidades que editaram/revisaram são registradas privadamente para autorização e auditoria; seus e-mails não aparecem no conteúdo público. As três demonstrações iniciais mantêm rótulo próprio, inclusive em versões clonadas. Novas questões autorais revisadas não são rotuladas automaticamente como demonstração.

## Modelo e invariantes

`editorial_question` identifica uma questão lógica e aponta para a versão publicada atual. `question_version` preserva IDs de versão usados nas respostas; agora possui sequência, revisão de edição, crédito, autoria, último editor e revisão. Migração 003 associa os registros existentes sem mudar os IDs de alternativa/resposta. Uma versão nova em rascunho ou revisão não muda o catálogo público. Ao publicar, versão e ponteiro mudam na mesma transação. A API pública ainda permite recuperar uma versão publicada anterior para revisar o resultado histórico.

Estados: DRAFT → IN_REVIEW → PUBLISHED ou REJECTED. Editar uma versão devolvida a leva a DRAFT e exige nova submissão. Editar conteúdo enviado ou publicado retorna conflito. Há no máximo uma versão aberta por questão. Criar nova versão exige informar o ponteiro publicado atual e clona conteúdo/alternativas sem alterar a versão anterior.

O servidor deriva o autor/editor/revisor da sessão. O criador e o último editor não podem revisar a própria versão. Publicar requer parecer e confirmação de conferência de enunciado/alternativas, gabarito/explicação e crédito. Rejeitar requer parecer. A confirmação registra uma revisão humana; não é verificação automatizada de correção pedagógica ou de direitos autorais.

Escritas travam sessão, papel, questão e versão, e comparam a revisão enviada com a vigente. A aprovação concorrente produz um evento e uma publicação; o perdedor recebe 409. Revogar papel ou sair da conta serializa com operações em curso. Eventos registram criação, edição, submissão, devolução, publicação e nova versão, sem copiar o enunciado ou dados pessoais desnecessários.

Triggers e constraints impedem modificar versões/alternativas publicadas e apontar o catálogo para um rascunho. A migration 004 faz a conferência das alternativas travar a versão: uma escrita SQL concorrente não pode observar revisão pendente e completar depois da publicação. A remoção administrativa de uma questão lógica inteira pode usar cascata, após tratar suas respostas; não existe endpoint de exclusão. Testes removem somente suas próprias questões por esse caminho, nunca desabilitam triggers.

## Permissões

`curator_role` concede acesso somente a contas existentes. Cadastro/login públicos não atribuem esse papel. A ferramenta local `npm run curator:role -- grant|revoke <identity-uuid>` exige acesso administrativo direto ao banco e não aceita e-mail como autoridade. Verificar a titularidade e a responsabilidade editorial fora desse comando é uma decisão do administrador; o e-mail da conta continua não verificado.

A navegação só aparece quando o servidor confirma a permissão. Esconder o botão não concede nem substitui autorização na API. Mudança de identidade invalida/desmonta a tela editorial; requisições antigas não podem reaparecer no estado de outra conta. Uma alteração local é mantida após falha/conflito e o usuário escolhe reabrir a versão para reconciliar.

## Escopo operacional

A fila lista as últimas versões de até 50 questões, sem paginação nesta base. Texto é renderizado por interpolação; HTML, Markdown e execução de código não foram introduzidos no renderer. Limites de campos e de corpo JSON (64 KiB na curadoria; 16 KiB nos demais endpoints) permitem conteúdo com acentos e impedem entradas sem limite. A ADR 004 acrescenta arquivos PDF e fontes oficiais. Imagens no enunciado, taxonomia editorial avançada, múltiplas referências, revogação de publicação, política de retenção e interface de administração de papéis continuam pendentes.

O seed usa transação e somente insere as três demonstrações ausentes. Não altera versões existentes nem o ponteiro de uma questão já publicada. Não há conta privilegiada ou senha padrão no seed. Migrations/seed foram exercitados também em schema temporário vazio, preservando o banco de desenvolvimento.
