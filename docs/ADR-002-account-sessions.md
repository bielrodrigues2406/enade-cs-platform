# ADR 002 — Contas e sessões de navegador

Data: 22/10/2026. Estado: adotada para a base de desenvolvimento.

## Problema e comportamento

O histórico estava preso a um cookie anônimo. Agora o estudante pode criar uma conta com e-mail/senha, sair e entrar em outro navegador para retomar suas respostas. A prática sem conta continua disponível.

Criar uma conta associa a identidade anônima atual à nova conta e preserva suas respostas. Entrar em uma conta existente abre somente o histórico dessa conta: respostas anônimas da sessão anterior não são mescladas. Essa distinção aparece no formulário. Trocar de conta exige sair primeiro. A ausência de confirmação de e-mail impede tratar esse endereço como identidade verificada; não há envio de mensagens ou recuperação de senha nesta entrega.

## Persistência e concorrência

A migration 002 renomeia `visitor` para `study_identity` e `answer.visitor_id` para `owner_id`. Os tokens existentes e seus prazos são copiados para `browser_session` antes de remover as colunas antigas. A tabela `account` associa uma identidade durável a um e-mail normalizado e hash de senha, com constraints de unicidade.

Tokens aleatórios de 256 bits são guardados somente como SHA-256 no banco. Sessões têm prazo fixo de 30 dias; cookies HttpOnly, SameSite Strict, caminho `/api`, e Secure em `NODE_ENV=production`. Cadastro e login revogam o token utilizado e emitem um novo. Cadastro revoga todos os tokens anônimos da identidade promovida, para que um token anônimo antigo não adquira acesso à conta. Logout revoga a sessão corrente e emite uma sessão anônima vazia; outras sessões de dispositivos da conta permanecem válidas.

Transações e locks de sessão serializam cadastro/login/logout com gravações. A escrita de resposta revalida e trava a sessão dentro da transação antes de travar o dono do histórico. Uma gravação que vencer a corrida com logout conclui antes da revogação; uma gravação que perder encontra a credencial revogada e retorna 401. Revisões continuam protegendo contra escrita antiga. Nunca derivar a autorização de IDs enviados no corpo.

## Senhas e limites

A implementação usa `crypto.scrypt` assíncrono do Node 24, salt aleatório de 16 bytes, saída de 32 bytes e parâmetros N=131072/r=8/p=1. O parâmetro `maxmem` permite 160 MiB por operação e no máximo duas derivações rodam simultaneamente por processo, limitando os conjuntos de trabalho a aproximadamente 256 MiB. A comparação usa `timingSafeEqual`. Login de conta desconhecida executa a mesma derivação e retorna a mesma mensagem de senha incorreta. Senhas aceitam 12 a 128 caracteres Unicode, sem trim ou normalização silenciosa.

Um limitador em memória por instância admite 10 tentativas por e-mail normalizado e 50 por endereço remoto em 15 minutos, com no máximo 10.000 chaves. Limite atingido retorna 429 e Retry-After; saturação de trabalho retorna 503. Não confiamos em X-Forwarded-For. Isso protege a base de desenvolvimento de um único processo; uma implantação com proxy/réplicas exige configurar explicitamente identificação de cliente e limite compartilhado. Restart reinicia os contadores.

Escritas exigem JSON e rejeitam Origin divergente de APP_ORIGIN. O parser limita o corpo a 16 KiB. A aplicação não habilita CORS. Nenhuma senha, hash ou token é incluído no DTO público ou nos logs intencionais. E-mail é dado pessoal: a API o retorna apenas à própria sessão autenticada.

## Limites de produto e operação

Não há confirmação de e-mail, recuperação/troca de senha, MFA, exclusão de conta, gestão de outras sessões ou política automatizada de retenção. Contas reais em produção dependem desses requisitos e de HTTPS, operação, política de privacidade e decisões de retenção. Não há deploy de produção nesta entrega. Não atribuir função editorial a uma conta com base no seu e-mail não verificado.

O modelo editorial, as fontes oficiais e os simulados continuam pendentes. Contas não alteram a classificação autoral demonstrativa dos três itens existentes.

## Interface e evidência

A interface invalida dados e requisições pendentes nas transições de identidade e oculta as ações de estudo até confirmar a sessão. `BroadcastChannel` avisa outras abas da mesma origem sem transmitir e-mail, senha ou token; a aba que recebe o aviso confirma a sessão no servidor antes de carregar o histórico. Senhas não são persistidas no navegador.

Além da validação manual da migration com sessão/resposta pré-existente, foram executados 15 testes de API/PostgreSQL e 9 testes Chromium. Entre eles: cadastro preservando histórico; rotação/revogação e login em outro contexto; contas isoladas; duplicata concorrente; expiração; limite de tentativas; e um teste com locks observáveis que faz logout vencer uma gravação já pendente. No navegador, saída entre abas descarta uma resposta atrasada, e uma saída com requisição atrasada bloqueia reabertura do histórico anterior. Falhas de senha, retorno ao estudo e falha de saída permitem recuperação. Reflow em 320/390/768/1440 e capturas desktop/mobile foram verificados. Não houve teste em Firefox/WebKit nem certificação de acessibilidade.

## Referência técnica

[Node 24 — crypto.scrypt e crypto.timingSafeEqual](https://nodejs.org/docs/latest-v24.x/api/crypto.html). API/documentação da versão 24 consultada durante a implementação.
