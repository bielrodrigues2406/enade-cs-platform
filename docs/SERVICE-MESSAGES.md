# Erros e avisos de manutenção

ERR-UX1, 06/11/2026. A entrega preserva confirmação/reconciliação e não repete escritas automaticamente. O aviso programado é informativo: não pausa provas nem bloqueia respostas.

## Aplicação

`api-request.ts` preserva status, `Retry-After` e abortos; traduz falhas de rede/resposta inválida e mantém mensagens específicas de 4xx, incluindo conflito de revisão. Falhas 5xx usam mensagem segura de indisponibilidade. Apenas 503 com código `SERVICE_MAINTENANCE` é chamado de manutenção; sobrecarga 503 comum não comprova isso.

Resposta perdida durante escrita não comprova falha nem sucesso. A mensagem orienta manter a tela aberta e confirmar novamente. Treino conserva `saveUncertain`, seleção e reconciliação; rascunhos e guards existentes continuam válidos. Não prometer recuperação após fechar/recarregar sem confirmação do servidor.

Biblioteca repete a abertura da mesma ficha após erro. Flashcards e painel tratam falha de rede. Os helpers compartilhados mantêm payloads, cabeçalhos multipart e autorização.

## Aviso programado

`GET /api/service-status` é público, sem sessão/banco e com `no-store`. Retorna `{notice:null}` ou `{notice:{message,startsAt,endsAt}}`. No `.env` de `deploy/campus`, deixe os três campos vazios para desativar; para anunciar, preencha os três com a janela real. Exemplo, **substituindo as datas e a mensagem**:

```dotenv
SERVICE_NOTICE_MESSAGE="Atualização programada do CadernoCC."
SERVICE_NOTICE_START=2026-11-08T02:00:00-03:00
SERVICE_NOTICE_END=2026-11-08T02:30:00-03:00
```

Mensagem até 300 caracteres, texto simples; datas ISO com fuso e fim posterior ao início. Configuração parcial/inválida impede inicialização com diagnóstico. Aplicar ou retirar exige recriar o app, no diretório `deploy/campus`:

```sh
docker compose up -d --no-deps --force-recreate app
```

O aviso tem horário de Brasília, `aria-live="polite"`, sem modal/foco automático. Consulta a cada minuto enquanto visível e expira automaticamente. Falha nessa consulta não inventa manutenção. Para retirar antes do fim, esvazie os três campos e recrie o app. Outros modos de implantação precisam repassar as variáveis explicitamente; esta entrega conecta o Compose usado na EC2.

## Aplicação parada — Caddy na EC2

A página é servida pelo host. Instale os arquivos **antes** de acrescentar o import ao Caddyfile. Comandos para o operador no servidor, a partir da raiz do repositório atualizado; não foram executados na AWS pelos agentes:

```sh
sudo install -d -m 755 /srv/cadernocc-status
sudo install -m 644 deploy/status/unavailable.html deploy/status/unavailable.css /srv/cadernocc-status/
sudo install -m 644 deploy/campus/service-errors.caddy /etc/caddy/cadernocc-errors.caddy
```

Preserve os domínios e regras existentes. Acrescente fora dos blocos:

```caddyfile
import /etc/caddy/cadernocc-errors.caddy
```

Dentro do bloco `cadernocc.com.br`, acrescente:

```caddyfile
import cadernocc_service_errors /srv/cadernocc-status 60
```

Mantenha proxy/compressão e demais regras. [Exemplo completo](../deploy/campus/Caddyfile.ec2.example). Valide antes de recarregar:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Falha de conexão com upstream retorna HTML503 em navegações e JSON503 em `/api`/`/api/*`, com código `SERVICE_UNAVAILABLE`. CSS é separado e acessível com app parado; não há fonte/script remoto. `no-store` evita cache permanente; argumento `60` é intervalo sugerido para nova tentativa, **não previsão de retorno**. 4xx e respostas HTTP emitidas pelo app continuam repassados. Não é contorno para falha do próprio proxy, DNS ou certificado.

O exemplo Nginx não foi alterado; este fallback pronto atende a implantação atual com Caddy. Publicar a aplicação não instala esses arquivos automaticamente no host.

## Validação

Testes unitários cobrem rede, aborto, 5xx, HTML/JSON inválido, espera de429 e janela do aviso. Chromium cobre login, retry, banner e preservação de seleção/rascunho. Caddy2.10.2, distribuição conferida com SHA-512 oficial, foi validado localmente: upstream ausente retornou HTML503/APIJSON503, CSS200, no-store, CSP e Retry-After; upstream404 foi preservado. Nenhum servidor público foi desligado. Orientações de escrita e acessibilidade locais foram aplicadas, com HTML/CSS/TS separados e tokens existentes.
