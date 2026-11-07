# Discursivas, atualidades e visualizador de provas

Análise pedida por Gabriel em 07/11/2026. Base: discursivas conferidas em `data/discursive-reviews/`, formato 2026 registrado em [MASTER-SPEC.md](MASTER-SPEC.md) §2 e [ADR-016](ADR-016-enade-2026-format.md). Escrita por IA (Claude); nada aqui foi publicado para estudantes.

## 1. O que a prova de 2026 deve ter

A referência do Inep registrada no projeto (FAQ do Inep, consultada em 02/11/2026) indica, para bacharelados: **15 objetivas de Formação Geral, 30 objetivas específicas e uma discursiva do componente específico**, em quatro horas. Esta sessão não abre `gov.br`, então o dado não foi reconferido hoje; revalidar antes de anunciar ao estudante.

Consequência: as discursivas de Formação Geral de 2021 ("arte, cultura e censura", "cidades inteligentes") **não devem se repetir como redação em 2026**. Os temas sociais continuam importantes, mas nas 15 objetivas de Formação Geral, que são um quarto das objetivas. Respostas-modelo genéricas de redação de Formação Geral têm pouco retorno; preparar leitura de textos, gráficos e charges sobre temas atuais tem mais.

## 2. O que as discursivas específicas cobraram (bacharelado, 2005 a 2021)

| Edição | Discursivas específicas |
| --- | --- |
| 2005 | Localidade e hierarquia de memória cache |
| 2008 | Dispersão com encadeamento exterior; árvores sintáticas e ambiguidade; otimização de consultas e união em SQL |
| 2011 | Fibonacci iterativo e recursivo; árvore binária de pesquisa a partir de vetor; mapeamento de cache |
| 2014 | Backtracking (Sudoku); modelo entidade-relacionamento; divisão e conquista |
| 2017 | Lista encadeada impressa ao contrário; diagrama de classes UML; busca em profundidade |
| 2021 | Lógica proposicional; somador completo de 1 bit; heap binário e buildHeap |

De 16 discursivas específicas: **9 de algoritmos e estruturas de dados**, 3 de arquitetura (cache duas vezes, somador), 2 de banco de dados (SQL, ER), 1 de compiladores, 1 de engenharia de software (UML) e 1 de lógica. Os pedidos se repetem em poucos tipos:

1. **Escrever ou corrigir um algoritmo** (recursão, árvore, lista, heap, backtracking, busca em grafo), quase sempre com custo ou justificativa.
2. **Montar uma tabela-verdade e um circuito** (somador) ou simplificar expressão.
3. **Modelar** (ER, classes UML) a partir de um enunciado de negócio.
4. **Explicar um mecanismo com conta** (cache, hashing, otimização de consulta).

## 3. Como ajudar na discursiva

Em ordem de valor:

1. **Oficina de discursivas na Biblioteca**: uma página por tipo de pedido acima, com a estrutura de uma resposta completa, o que os padrões de resposta do Inep pontuaram, um exemplo resolvido e os erros que tiram ponto. Fonte: os padrões de resposta oficiais já importados (DISC-1). Não exige migration.
2. **Discursivas geradas por IA**, com padrão de resposta e critérios de autoavaliação, nos quatro tipos e sobretudo em algoritmos. Exige um modelo novo (hoje as discursivas são recortes das provas oficiais) e o mesmo rótulo "Gerada por IA".
3. **Ligar a discursiva à lição**: cada discursiva oficial ligada aos conceitos do núcleo, como já foi feito para as objetivas (R4), para a correção levar à lição.

## 4. "Em pauta": temas atuais para a Formação Geral

Seção da Biblioteca com poucos temas atuais (por exemplo: cidades inteligentes e mobilidade, inteligência artificial e trabalho, desinformação, proteção de dados, mudanças climáticas, saúde e desigualdade), cada um com:

- duas ou três fontes datadas e realmente lidas (Inep, IBGE, Agência Brasil, órgãos oficiais), nunca de memória;
- o vocabulário e os dados que costumam aparecer em gráficos e charges;
- a ligação com questões de Formação Geral que trataram do mesmo tema (o acervo já tem 47);
- uma questão objetiva gerada por IA no estilo da Formação Geral, marcada como tal.

Depende de liberar os sites das fontes no ambiente desta sessão; hoje só estão liberados livros e documentações técnicas. Uma pauta recente não prova cobrança; a tela deve dizer isso.

## 5. Visualizador de provas (dataset do Mendeley)

O dataset `w9hdbnrk85` traz os PDFs das provas (por exemplo, "Prova - 2021.pdf", CC BY 4.0), os mesmos cadernos que o Inep publica. A plataforma já tem as provas oficiais conferidas, as questões recortadas, as provas completas para resolver e o link para a página do caderno original. **Não vale fazer um visualizador de PDF**: duplicaria o que existe e traria arquivos grandes para o servidor. O que vale é garantir, em Provas completas e em cada questão, o link "abrir o caderno original do Inep" na página certa, e citar o dataset só se ele tiver algo que o Inep não tem (por exemplo, provas de outros cursos para o plano de expansão).
