# Organização do código e próximas entregas

Referência: 30/10/2026. Base executável examinada: main `d162334`. Entrega do Claude examinada separadamente: `09a40f70e88c9b22a1268c25e59e7930c18f7212`, ainda fora da main nesta consulta. Esta revisão distingue código, registros dos agentes e publicação em cada ambiente.

## O que foi feito nesta passagem

CQ-1 separa os nove templates Angular em `.html`, mantendo `templateUrl` no TypeScript. Os estilos já estavam em `styles.css`; os cálculos da escala das imagens e dos atrasos de apresentação passam ao CSS, recebendo somente dimensões/índices dinâmicos pelo template. Contratos, navegação, textos e regras de estudo são preservados. A convenção agora está em AGENTS, ENGINEERING-AND-DELIVERY §1.1 e COLLABORATION, incluindo orientação ao Claude para atualizar a branch sem restaurar templates inline.

Não é necessário conferir manualmente de novo todas as questões dos mesmos lotes e hashes. A conferência independente existente continua como evidência; a revisão desta passagem examina integridade automaticamente e o código de maior risco. Se uma amostra ou alteração indicar erro sistemático, ampliar a revisão do grupo afetado. Não aprovar itens pendentes por amostragem.

## Conteúdo na branch do Claude

| Edição / conjunto | Questões com recortes | Novas aprovações registradas | Sem conferência registrada neste conjunto |
| --- | ---: | ---: | ---: |
| 2005 comum | 35 | 0 | 35 |
| 2008 comum | 35 | 16 | 19 |
| 2011 comum | 34 | 0 | 34 |
| 2014 Bacharelado | 35 | 35 | 0 |
| 2014 Licenciatura, exclusivas | 17 | 0 | 17 |
| 2017 Bacharelado | 35 | 35 | 0 |
| 2017 Licenciatura, exclusivas | 14 | 0 | 14 |
| 2021 Bacharelado | 33 | 33 | 0 |
| 2021 Licenciatura, exclusivas | 9 | 0 | 9 |
| **Total** | **247** | **119** | **128** |

Os 247 itens estão em 255 WebP. Nos sete novos arquivos de revisão, uma checagem independente via objetos Git confirmou os hashes dos manifestos/provas, bytes/SHA dos 124 fragmentos, ordem e letras registradas, sem divergências. Há três identificadores de agentes distintos em cada lote. Isso verifica os registros e os vínculos; não comprova visualmente a execução dos agentes. Não foi repetida a conferência editorial das 119 questões.

Das 119 aprovações, **116 explicações têm OK e três REJECTED** (2008 Q28; 2017 Q9/Q18). A aprovação da questão permite publicá-la sem explicação; não autoriza publicar uma explicação recusada. Há 25 notas ao estudante. O diário do Claude relata 35 questões de 2014 publicadas no banco local dele; este ambiente continua com três demos públicas e 605 ocorrências privadas. Não há evidência de publicação em produção.

## Correção necessária antes de integrar PUB-A2

**P1 confirmado por revisão estática:** na branch Claude, [assisted-publication.ts:135](https://github.com/bielrodrigues2406/enade-cs-platform/blob/09a40f70e88c9b22a1268c25e59e7930c18f7212/apps/api/src/assisted-publication.ts#L135) converte a explicação REJECTED em nulo, mas a [seleção em :407](https://github.com/bielrodrigues2406/enade-cs-platform/blob/09a40f70e88c9b22a1268c25e59e7930c18f7212/apps/api/src/assisted-publication.ts#L407) faz fallback para a análise histórica. Com recusa explícita e análise antiga presente, o publicador pode inserir texto que a nova conferência não aprovou. Os arquivos de 2008 Q28 e 2017 Q9 atendem essa condição. O teste novo cobre recusa sem análise histórica, deixando esse caminho descoberto.

Correção mínima para Claude: preservar o resultado da conferência e impedir o fallback após REJECTED; cobrir esse caso com análise histórica disponível. As explicações recusadas podem voltar para outra rodada sem bloquear a questão fiel. A mudança está fora da main e não é incorporada por CQ-1.

PUB-A2 também precisa atualizar API/ADR para `subject`, `reviewNote`, filtro por assunto específico, ordenação e política D15 registrada na branch; testar catálogo com assunto preenchido e notas apenas após resposta/finalização, executar build/API/E2E e abrir PR com revisão antes de integrar. A migration 013 pertence a essa entrega; 014 é a próxima livre.

## Ordem mínima das pendências

1. **Acervo utilizável:** concluir PUB-A2 com a correção acima, validar e publicar os lotes aprovados pelo procedimento administrativo. Continuar as 128 conferências restantes por agentes distintos. As 247 são o conjunto histórico desta branch, não todos os anos: o inventário da main ainda registra 33 PDFs individuais ausentes.
2. **Simulado completo:** treino parcial de 10/20/30 já existe, sem tempo; faltam formato por edição, blocos FG/específico, prazo controlado no servidor e tratamento de discursiva. Só habilitar formatos com conteúdo publicado suficiente por bloco. Não duplicar o modelo de tentativa.
3. **Desempenho útil:** consolidar estudo/treino por assunto com amostra explícita e distinguir primeira resposta de repetição; não criar novos painéis antes do contrato do histórico.
4. **Conta e operação:** troca/recuperação de senha, decisão do provedor de e-mail, privacidade/retenção, fontes e ativos persistentes em produção, backups/restauração e deploy. A branch Claude registra Render em D16; isso não é uma implantação realizada.
5. **Importação futura:** prova + gabarito pela interface, progresso/retomada e ajuste de recortes continuam pendentes. Hoje existe o procedimento administrativo por CLI.

Turmas, chamada, permissões docentes, nova página pública e demais propostas das personas estão no planejamento da outra trilha; não foram implementadas nesta passagem. Não acrescentar todas de uma vez. Separar templates também não conclui a futura divisão de responsabilidades do shell: não houve troca de roteamento ou refatoração ampla das regras.

## Validação de CQ-1

[PR #23](https://github.com/bielrodrigues2406/enade-cs-platform/pull/23): build passou; `npm test` passou 139/139; `CI=true npm run test:e2e -- --timeout=60000` passou 48/48 (4,3 min), com banco local de desenvolvimento. As suítes não compartilharam o banco simultaneamente. Os fluxos existentes cobrem os componentes extraídos, teclado e larguras 320/390/768/1440; capturas de conta, catálogo e treino foram inspecionadas. A comparação AST conferiu os nove templates e o TypeScript fora da metadata, com as quatro mudanças de bindings previstas e regras equivalentes no CSS. Revisão independente sem bloqueadores para CQ-1; a avaliação de PUB-A2 é separada e conserva o P1 acima. Consulta final READ ONLY confirmou 605 ocorrências privadas, três demos públicas e zero tentativas/fixtures próprias restantes. Sem publicação de conteúdo nesta passagem.
