# Testar o experimental no computador

Base conferida: PRs #60–#64, main `e2a048f` (07/11/2026). O ajuste de navegação desta entrega impede que uma resposta atrasada substitua a lição atual. O roteiro usa o banco local existente; não apaga volumes ou progresso.

## Atualizar

Feche os processos antigos de API e web. Na raiz do repositório, com Node 24.19 e Docker Desktop ligado:

```sh
git status --short
git switch main
git pull --ff-only
npm ci
npm run db:up
npm run db:migrate
npm run db:seed
npm run publish:generated
```

Se houver mudanças locais, guarde-as antes de trocar de branch. Preserve o `.env` existente. `db:seed` mantém as demonstrações; `publish:generated` publica/atualiza as 163 autorais sem baixar PDFs e preserva as versões anteriores usadas por tentativas.

Se esta for a primeira carga das questões oficiais, instale Poppler (`pdfinfo`) e execute também `npm run bootstrap:content`. Esse comando baixa fontes conferidas e publica o acervo; falha de download precisa ser resolvida antes de considerar a carga completa. Atualizar o Git sozinho não atualiza o banco.

Em dois terminais separados, ambos na raiz:

```sh
npm run dev:api
```

```sh
npm run dev:web
```

Abra http://localhost:4200. A saúde da API está em http://localhost:3000/api/health. As lições e conceitos vêm dos arquivos, sem comando próprio de importação.

## Percurso de aceitação

1. Biblioteca → Sistemas operacionais → Deadlock. Conferir objetivo, pré-requisitos, explicação, exemplo, Armadilhas, questões vinculadas, Para fixar, Agora sozinho e fonte no rodapé.
2. Ler os outros pilotos: `/biblioteca/sistemas-operacionais/so-memoria-virtual` e `/biblioteca/algoritmos/alg-ordenacao`. Conferir clareza das explicações e resolver a transferência antes de abrir a solução.
3. Recarregar cada endereço; usar anterior/próxima e Voltar/Avançar do navegador. Título, conteúdo e endereço devem corresponder. Testar também com rede lenta nas ferramentas do navegador.
4. Na área, usar Tab e setas na autoavaliação e recarregar para conferir persistência. O acerto observado mostra a amostra; o índice de confiança é uma heurística.
5. Abrir uma questão oficial e uma gerada da lição. Conferir origem, imagem e retorno. As autorais continuam separadas das provas oficiais.
6. Abrir a ficha Grafos e treinar: a seleção deve manter Algoritmos. Flashcards da área devem abrir o baralho correspondente.
7. Alternar Claro/Escuro/Sistema no rodapé, recarregar e conferir campos, exemplos, diálogos e imagens. Repetir a 390 px e no desktop.

## Limites para publicar como experimental

Há 23 lições em duas áreas, mas apenas três estão no modelo aprofundado novo. As outras 20 e as outras 15 áreas são trabalho posterior; não apresentar a Biblioteca como curso completo. Os vínculos explícitos substituem palavras-chave, mas sua cobertura não equivale a uma revisão semântica independente de todas as questões. Fontes consultadas e bibliografia recomendada são distintas na tela. O histórico não estima probabilidade de cobrança.

Depois da aceitação local, faça backup no servidor antes da atualização. A implantação existente usa `deploy/campus/atualizar.sh`, que reconstrói a partir do checkout e executa o bootstrap. Confira os logs da carga: saúde HTTP isolada não comprova publicação. Não executar `down -v` ou apagar volumes para atualizar.
