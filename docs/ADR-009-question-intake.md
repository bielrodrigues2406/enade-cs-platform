# ADR 009 — Fila privada de importação de questões

Status: aceita para CNT-I1. Data: 26/10/2026.

## Contexto

A extração offline produz texto, alternativas e alertas, mas ainda não criava registros consultáveis na curadoria. Fontes históricas estão em IMPORTED; o contrato oficial exige prova e gabarito definitivo VERIFIED mesmo para criar uma versão editorial DRAFT. Importar todas as questões e analisar seu conteúdo não autoriza atribuir uma conferência humana inexistente.

## Decisão

Guardar a extração em `question_intake`, separada de `question_version`. A identidade é o par prova/SHA cadastrado e identificador da extração (`Q1`, `D1` etc.). Na PND, a discursiva sem número recebe `D1` técnico com alerta, sem afirmar que esse número está impresso. O snapshot inicial permanece imutável. Uma reextração fica no histórico e só atualiza o texto de itens que ninguém editou ou encaminhou. Importações idênticas são idempotentes; um documento é importado em transação única.

O comando administrativo importa relatórios limitados a 8 MiB, valida o catálogo, os metadados do registro e a integridade dos PDFs arquivados. Sem ator, registra uma operação administrativa; não cria conta, papel, conferência ou publicação. Não há endpoint de upload/importação acessível ao navegador.

Uma análise assistida é identificada por autor, hash da prova e número original. Guarda explicação, notas e problemas encontrados, sempre com `origin=ASSISTED` e `humanReviewed=false`. A resposta oficial permanece identificável na extração original. Divergências técnicas são pendências, sem substituir o gabarito oficial nem anular uma questão por decisão automática.

O curador pode corrigir o texto e justificar a resolução de alertas. As alterações usam revisão otimista e evento com nota. OCR, figuras, resposta ausente, discursivas, anuladas e blocos de outros cursos permanecem identificados. Cadernos compartilhados preservam o escopo por bloco; não se apresentam questões exclusivas de outros cursos como Ciência da Computação.

Criar um rascunho editorial exige confirmar fidelidade aos PDFs, resolver as pendências aplicáveis e cumprir a mesma validação de procedência e conteúdo usada pela criação manual. Fontes VERIFIED, gabarito definitivo, páginas e autoria/revisão independentes continuam obrigatórios. A promoção é transacional e não publica o item. As rotas de estudo continuam lendo somente versões publicadas.

## Consequências

- A fila passa a mostrar progresso real da importação sem confundir extração, análise assistida e aprovação editorial.
- Itens incompletos podem ser conferidos sem preencher lacunas com texto inventado.
- Fontes indisponíveis continuam sendo uma pendência explícita; uma compilação auxiliar não conta como vários PDFs originais recuperados.
- Discursivas, imagens na resolução e publicação de anuladas continuam dependendo de seus próprios contratos de produto. A fila conserva esses itens como evidência.
- A importação ocorre no ambiente administrativo, com o mesmo acesso ao banco e ao arquivo de fontes já exigido pela importação de PDFs. Não é executada automaticamente no deploy.
