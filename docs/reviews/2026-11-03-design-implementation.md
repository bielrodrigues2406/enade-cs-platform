# Aplicação da auditoria de design

Gabriel autorizou os ajustes em 03/11 e escolheu **Questões** no lugar de Resolver. Os outros grupos são **Treinar, Revisar e Apoio**. Mantida a identidade de caderno e os recursos existentes.

- **DS-6, PR #39 integrado:** curadoria paginada, gabarito explícito, professor sugerido apenas para docência, validação por campo, tabelas contidas, abas por teclado e modais com foco/alvos corrigidos. CI: build, 183 API, 82 Chromium e imagem de produção.
- **DS-7:** menu lateral agrupado no computador e diálogo no celular/tablet estreito; conta/meta/saída reunidas; rotas próprias e histórico/reload das seções; filtros secundários recolhíveis com indicação de ativos. Curadoria carregada sob demanda para preservar o orçamento inicial. PR #40; integração condicionada ao CI final.
- **DS-8:** composição do Início novo, Biblioteca contínua e medalhas conquistadas + próximas duas, com expansão para todas. Build final de 434,70 kB e nove Chromium de Home/engajamento conferidos, além de revisão cruzada. PR #41; CI completo e integração após o PR #40.

A revisão de navegação inclui resposta de questão atrasada, callback antigo de transição após Voltar, rascunho/prova em curso e autenticação com corpo JSON interrompido após os cabeçalhos/cookie chegarem. Não altera o limite de autenticação: os testes aproveitam atores já criados para não ultrapassar a proteção compartilhada por IP.

HTML, CSS e TypeScript permanecem separados; estilos novos no componente e tokens existentes. Sem migration/dependência nova, publicação editorial, revisão humana simulada ou deploy.

Ainda exigem trabalho próprio: CQ-2 integral antes da fábrica, revisão humana dos materiais de IA, leitor de tela, privacidade institucional, fontes oficiais ausentes e implantação em VPS/domínio. Esta entrega não transforma ideias futuras de Plano/Materiais/PWA em requisitos de design.


Evidência visual: 128 capturas de 37 estados em 1440/768/390 px, com campos/modais críticos em 320 px, mais dobras e menu. Nenhum overflow horizontal medido nesse conjunto; Tab/Escape verificados nos diálogos amostrados. As capturas usam redução de movimento para estabilizar as imagens. Não houve teste com leitor de tela nem pesquisa com pessoas reais. ZIP/galeria ficam fora do bundle/Git.
