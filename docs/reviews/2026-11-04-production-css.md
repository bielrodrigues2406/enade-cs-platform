# CSS e carregamento em produção

Revisão independente de 04/11/2026 sobre a base `ab749ae`, com leitura de código e GETs públicos de `https://cadernocc.com.br`. Sem acesso SSH à AWS, escrita de respostas, criação de contas ou testes de carga. Não foram executadas suítes nem servidores por este revisor.

## Causa do CSS quebrado

O HTML publicado entrega CSS global externo, mas seu cabeçalho contém `style-src 'self'`. Angular 22 insere os estilos dos componentes em elementos `style` durante a execução, inclusive após carregar componentes sob demanda. A política original recusa esses elementos. Isso explica estilos globais presentes junto de menu, cartões de provas e partes do Dudu sem posicionamento.

A implementação Angular instalada lê `CSP_NONCE` de `document.body.querySelector('[ngCspNonce]').getAttribute('ngCspNonce')`. A correção em revisão usa esse mecanismo nativo, com marcador no arquivo HTML, nonce aleatório de 128 bits por resposta e o mesmo valor no `style-src`.

O diff revisado mantém `script-src 'self'`, a política restrita da API e o bloqueio de `unsafe-inline`/`unsafe-eval`. A rota `/index.html` recebe o mesmo tratamento antes dos arquivos estáticos; não pode entregar o marcador literal. O HTML recebe `Cache-Control: no-store` para evitar reutilização por cache compartilhado. Os estilos legítimos ganham nonce; um estilo arbitrário sem ele continua bloqueado.

É necessário validar no navegador o build compilado servido pela API com a política real. Os testes anteriores com `ng serve` não exercitam essa combinação, embora o arquivo de hosting já verificasse o cabeçalho isoladamente.

## Evidências de carregamento

| Recurso público observado | Resultado antes da correção |
| --- | --- |
| `/` | HTTP 200, HTML de 840 bytes, sem `ngCspNonce`, `style-src 'self'` |
| `/main-HMD5W74N.js` | HTTP 200, 193.347 bytes; cache `public, max-age=31536000, immutable` |
| `/chunk-Dtcii2KJ.js` | HTTP 200, 149.928 bytes; cache `no-cache` |

O código original reconhece hashes apenas por `[A-Z0-9]{8}`. Os chunks reais do Angular também contêm minúsculas, `_` e `-`; por isso deixam de receber cache imutável. Reconhecer esses caracteres nos nomes com hash evita revalidações desnecessárias, preservando HTML dinâmico e arquivos sem hash fora desse cache.

As duas respostas JS observadas, solicitadas com `Accept-Encoding: gzip, br, zstd`, não trouxeram `Content-Encoding`. Confirmar compressão no proxy efetivamente usado pela instalação. O exemplo Caddy já possui `encode zstd gzip`; este lote acrescenta gzip para CSS/JS/JSON ao exemplo Nginx do câmpus. A configuração real do servidor não foi lida nem alterada; antes de aplicar, conferir com `nginx -t`.

Gabriel forneceu depois o roteiro da instalação: checkout em `~/enade-cs-platform`, build local pelo Compose em `deploy/campus` e Caddy no host com `reverse_proxy 127.0.0.1:3000`. O Caddyfile fornecido não contém `encode`. `deploy/campus/Caddyfile.ec2.example` preserva domínio, redirecionamento e limite de corpo desse roteiro e acrescenta `encode zstd gzip`. Fazer cópia da configuração atual, validar com `caddy validate` e só então recarregar o serviço; não há motivo para reinstalar Docker/Caddy ou recriar senha/volumes.

As amostras tiveram TTFB próximo de um segundo, medidas pelo ambiente e proxy desta sessão. Elas não medem a experiência de um estudante no Brasil nem isolam rede, CPU, banco e proxy. Portanto, não demonstram que a região dos EUA seja a única causa do atraso.

## Prioridade e validação

1. Corrigir a política com nonce e testar login, menu, provas e camadas do Dudu com o build de produção.
2. Conferir nonce no HTML/cabeçalho e nos estilos carregados inicialmente e sob demanda; verificar que estilo sem nonce e script inline continuam bloqueados. Incluir `/index.html`, HEAD e HTML sem cache compartilhado.
3. Corrigir cache dos nomes com hash misto e verificar compressão na rota pública depois de publicar a versão.
4. Medir em um navegador no Brasil: carregamento inicial sem cache, retorno com cache e tempo de respostas API. Só então decidir se é necessário mudar região ou capacidade da instância.

Há uma sequência de rede adicional no boot: sessão, acesso/curadoria para contas (em paralelo entre si) e catálogo são aguardados antes de liberar a tela. Mesmo em páginas que não são o banco, o catálogo participa dessa espera. Separar essa leitura por rota pode reduzir uma ida à rede, mas exige revisão dos guards, URLs e respostas atrasadas; fica como melhoria posterior à correção de CSS, não alteração oportunista deste lote.

O servidor AWS real não foi reconfigurado nesta revisão. A aparência e o carregamento publicados precisam ser conferidos novamente após a implantação da correção.
