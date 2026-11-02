# Propostas de discursivas — 02/11/2026

Estes arquivos são rascunhos para conferência independente. Não têm conferente nem decisão de aprovação; o bootstrap lê apenas JSON diretamente em `data/discursive-reviews/` e não publica esta subpasta. Extrator: `codex-content-author-2026-11-02`.

| Prova | Questão | Conteúdo | Itens impressos no enunciado |
| --- | --- | --- | --- |
| 2005 comum | 55 | Localidade e hierarquia de memória cache | a: 4; b: 6 |
| 2008 comum | 20 | Dispersão e encadeamento exterior | a: 4; b: 6 |
| 2008 comum | 39 | Árvore sintática e ambiguidade | a: 5; b: 5 |
| 2008 comum | 40 | Otimização de consulta SQL | a: 5; b: 5 |

Os PDFs da prova e do padrão de respostas foram lidos das cópias locais; seus SHA-256 foram confrontados com `data/official-sources.json`. Os originais não foram alterados. Os 14 WebP em `data/discursive-crops/` foram renderizados a 200 dpi sem perda e sem metadados. Cada JSON registra página física do PDF, caixa em pontos, dimensões, tamanho e SHA-256. Os fragmentos seguem a ordem de leitura; áreas de rascunho vazias foram omitidas quando separáveis do texto. Não houve transcrição nova do conteúdo oficial.

## Conferência necessária

1. Abrir cada fragmento e o PDF correspondente; confirmar número, integridade, ordem e correspondência entre enunciado e padrão. Em 2008 Q39, o enunciado tem dois fragmentos; em Q40, três. A resposta da Q40 começa na página 1 do padrão e continua nas páginas 2 e 3.
2. Conferir área, assunto e os valores contra o enunciado. As ressalvas em `reviewConcerns` não são critérios novos de correção.
3. Decidir sobre as notas propostas. Em 2005 Q55, o padrão detalha máximos a=2, b1=2 e b2=2, enquanto o enunciado imprime a=4 e b=6. A fonte não esclarece a conversão. Os critérios propostos usam os valores do enunciado, conforme ADR-013; a nota explicita a limitação da estimativa. Não recalcular pesos sem decisão editorial.
4. Em 2008 Q40, o diagrama original usa renda < 30000, mas a descrição, o SQL e o padrão usam renda > 30000. A solução oficial usa UNION; em SQL isso pode eliminar duplicatas de nome/endereço, cuja unicidade não foi informada. A proposta preserva os dois fatos.
5. Se aprovado por outro agente, gerar o arquivo canônico no diretório superior, registrando o conferente real e a data da conferência. Não tratar a geração destes recortes como aprovação.

## Fora deste lote

- **2005 Q70:** anulada explicitamente no padrão oficial. Não publicar.
- **2005 Q39/Q40/Q85 e 2008 Q59/Q60/Q79/Q80:** pertencem a outros componentes do caderno compartilhado; não incluir como específicas de Ciência da Computação.
- **Formação Geral 2005 Q8/Q9/Q10 e 2008 Q9/Q10:** o padrão catalogado de Computação não traz essas respostas. Continuam pendentes de uma fonte de padrão de resposta verificável. Não criar respostas ou critérios próprios.

Validação desta preparação: integridade dos SHA-256 das fontes e dos 14 recortes; dimensões e tamanhos; quatro conjuntos de itens totalizando 10 pontos; inspeção visual dos 14 recortes. Não foram executados banco, publicação, build ou testes de aplicação.
