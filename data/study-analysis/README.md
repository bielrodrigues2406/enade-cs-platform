# Inventário do Guia ENADE experimental

Primeiro incremento executável de [ENADE-STUDY-LAB](../../docs/ENADE-STUDY-LAB.md). Não usa banco, rede, contas ou dados de estudantes. Não altera fontes nem publica questões. Não é inventário da AWS.

Na raiz do repositório, com Node 24:

```sh
node scripts/study-inventory.mjs
node scripts/study-inventory.mjs --check
node --import tsx --test tests/study-inventory.test.ts
```

`inventory.json` registra entradas e SHA-256 para reprodução. `--check` falha se o artefato não corresponder aos arquivos atuais; esse caso é coberto também por `npm test`. Só são lidos os JSONs do nível principal de cada pasta: conferências superseded, explicações e pending não representam revisão ativa. A geração não precisa de `npm install`; os testes usam o tsx já fixado pelo projeto.

## Resultado inicial

- 30 documentos EXAM catalogados, incluindo famílias/variantes recentes; não são 30 edições comparáveis.
- Nove relatórios históricos, seis anos: 2005, 2008, 2011, 2014, 2017 e 2021.
- 460 ocorrências extraídas; incluem outros cursos, repetições e anuladas.
- 246 aprovações objetivas e 39 aprovações discursivas nos arquivos ativos; não comprova publicação no servidor.
- 30 vínculos `duplicateOf` documentados na análise de 2021, preservados sem declarar deduplicação integral.
- 71 grupos de textos/alternativas idênticos candidatos a conferência. São pistas, sem comparação visual/gabarito; não são 71 duplicatas aprovadas.

Cada ocorrência preserva documento, chave original, tipo, bloco, páginas, escopo, estado bruto de extração e conferência ativa. Discursivas antigas são cruzadas por número/tipo: a extração Q55 não é renomeada silenciosamente para D55. `catalogArea`/`catalogSubject` são rótulos legados, não a taxonomia nova. `analysis` permanece PENDING, com tema/habilidade/identidade canônica nulos. `topicIncidence: null` impede tratar pendência como zero cobrança.

`components` separa tipo/bloco e conta apenas o escopo de CC não anulado como `eligibleExtracted`. Esse campo é cobertura **da extração**, não certificado do universo oficial integral. `extractionCompleteness` conserva a avaliação do extrator e não substitui conferência do PDF. As modalidades não são somadas numa curva única. Sem relatório, `components` é nulo.

Anulações/escopo prevalecem sobre uma aprovação. `annotations.json` registra a anulação de 2005 Q70 já documentada no projeto mas ausente do status bruto; inclui hash e evidência existente. Não é nova revisão do PDF.

As matrizes oficiais específicas ainda estão NOT_ACQUIRED. Em 06/11, a entrada genérica de legislação do Inep respondeu 200 e redirecionou para `https://www.gov.br/inep/pt-br/centrais-de-conteudo/legislacao/enade`, que carrega os anos por páginas próprias, incluindo `/2026`. Acesso a esse índice não comprova aquisição da matriz de Ciência da Computação.

## Próximo incremento

Estabilizar taxonomia numa amostra conferida por dois agentes e classificar os itens por tema/habilidade. Resolver vínculos de identidade restantes, obter a norma pertinente e só então gerar incidência revisada e panorama na Biblioteca. Os guias, dossiês de atualidades e exercícios autorais continuam na sequência; este artefato não os anuncia como disponíveis.
