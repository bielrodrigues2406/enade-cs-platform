# ADR 016 — Simulado autoral no formato ENADE 2026

Status: implementação preparada, aguardando validação da integração, em `codex/feat-enade-2026`, por pedido direto de Gabriel em 02/11/2026. Complementa ADR-007/013/014 e MASTER-SPEC §5.

## Decisão

O modo é uma montagem autoral com questões históricas oficiais e revisadas: 15 objetivas de Formação Geral, 30 específicas e uma discursiva específica de Ciência da Computação, em quatro horas. Não é uma prova oficial de 2026, não prevê nota ENADE e não mistura Licenciatura/PND silenciosamente.

A tentativa existente recebe `kind: FORMAT` e `format_year: 2026` (migration 029). Objetivas conservam versões fixas, revisão otimista, pausa, prazo do servidor, conclusão idempotente e resultado por bloco. A disponibilidade mostra contagem e falta por bloco; não oferece uma montagem incompleta. A seleção usa somente fontes históricas verificadas de Bacharelado/Computação comum e cinco alternativas. Ao excluir Licenciatura também se evita duplicar a FG compartilhada entre os cadernos de um ano.

A discursiva fica em `practice_discursive`, exclusiva da tentativa. A resposta global de `discursive_response` não serve aqui: já poderia ter sido enviada, revelando o padrão antes do novo simulado. No início são copiados os metadados, critérios e referências dos recortes (`practice_discursive_image`); não se duplicam os bytes dos arquivos. O banco impede trocar a questão ou os recortes e impede editar o texto depois da conclusão. Uma restrição adiada exige exatamente uma discursiva e os dois tipos de recorte, além das 15/30 objetivas.

Rotas próprias leem e gravam o rascunho da tentativa, com a mesma semântica de revisão. O componente de discursivas é reutilizado com um contexto de tentativa, e só mostra padrão/autoavaliação após a conclusão. O servidor não fornece URL nem hashes do padrão antes disso; a rota de imagem confere proprietário e conclusão, independentemente de qualquer resposta antiga no estudo livre. A conclusão pode preservar uma discursiva em branco, sem criar uma resposta falsa.

## Limites

- Não há nota combinada nem correção automática da discursiva. A autoavaliação usa os critérios fixados e aparece separada dos acertos objetivos.
- O conjunto não é uma reprodução psicométrica da prova. As fontes originais de cada item continuam visíveis.
- As regras valem para esta configuração de Bacharelado; formatos futuros exigem decisão própria. As provas completas antigas permanecem em seu modo e ordem originais.
- Validação com banco e navegador será executada pela integração; esta branch não disputa o ambiente `enade_ci` com MAS-2.
