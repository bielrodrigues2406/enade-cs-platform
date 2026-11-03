# Segurança de privilégios e manutenção de contas

Revisão de 03/11/2026, sobre `codex/fix-security-and-motion`, base `4996fef`. Não foi acessado o servidor IFSP PEP: firewall, SSH, proxy, credenciais e backups da instalação real não foram inspecionados. Esta revisão não certifica ausência de outras vulnerabilidades. Após a análise estática, foram executados os quatro contratos de `tests/exam-import.test.ts` com PostgreSQL local isolado: **4/4 passaram**, incluindo as regressões do guard de upload. `bash -n deploy/vps/backup-postgres.sh` e `git diff --check` passaram. Nenhum backup/restore real nem E2E foi executado por este revisor.

## Resultado da revisão

O comando `admin:role` é uma ferramenta do servidor, sem rota HTTP que o execute. Ele exige acesso ao ambiente/banco. A API serve arquivos estáticos de `dist/web/browser`, não os scripts de `dist/admin` (`main.ts`, configuração de `webRoot` e `useStaticAssets`). Conhecer o comando ou chamar uma URL com seu nome não concede o papel.

**Encontrado e corrigido neste lote:** antes da alteração, `ADMIN_EMAILS` concedia o primeiro papel ADMIN no cadastro público ou no startup. Como o sistema não confirma o e-mail, alguém podia cadastrar esse endereço primeiro e obter administração. O diff remove as chamadas de `auth.ts` e `serve.ts`, as funções de bootstrap de `roles.ts` e a configuração/instruções de deploy. O primeiro administrador passa exclusivamente pelo CLI após criar a conta. A variável antiga passa a ser ignorada pelo código; a mudança não revoga administradores já existentes.

Se uma instalação anterior utilizou esse bootstrap, o operador deve conferir os administradores existentes e o histórico de concessões antes de liberar acesso público. Remover a variável não desfaz uma concessão anterior.

## Barreiras verificadas no código

| Caminho | Comportamento observado |
| --- | --- |
| Conta comum tentando dar papel a si mesma | `requireRole(req, 'ADMIN')` consulta o papel no banco em `admin/roles`, `admin/roles/revoke` e `admin/accounts`; não depende de esconder botões. |
| Cadastro contendo `role`, `roles` ou `isAdmin` | O cadastro público grava os campos de conta explicitamente e não concede esses valores. O novo teste em `roles.test.ts` cobre esses atributos e a antiga variável. |
| Convite pendente reivindicado por cadastro | `applyInvitations` marca a reivindicação, sem conceder o papel; exige confirmação administrativa posterior. Nome e prontuário continuam sendo dados declarados pela pessoa, não prova de titularidade. |
| Alterar senha ou perfil de outra pessoa por ID no corpo | `/api/me/profile` e `/api/me/password` usam o dono da sessão. Trocar e-mail ou senha exige a senha atual. Não há endpoint de edição administrativa de outra conta. |
| Requisição enviada de outro site | Escritas rejeitam `Origin` diferente; JSON é exigido salvo upload de importação. Cookie usa HttpOnly/SameSite Strict e Secure em produção. Isto depende de HTTPS e configuração correta na implantação. |
| Roubo/fixação de sessão anônima no cadastro | Cadastro rotaciona a credencial de visitante. Tokens de sessão são aleatórios e o banco guarda hash. Senhas usam scrypt com salt, não texto recuperável. |
| Uso de importação como execução de comando | Rotas de importação exigem ADMIN. Chamadas observadas usam `execFile`/`spawn` com argumentos separados, sem shell fornecido pelo usuário. Encontrado consumo de upload antes de autorizar: corrigido com guard antes do interceptor multipart. Não foi feito pentest dos parsers de PDF; eles continuam exigindo atualização e isolamento. |
| Publicação de banco/controle do Docker | O Compose de produção não publica porta do PostgreSQL nem monta o socket Docker. O contêiner roda como usuário `node`. SSH, acesso ao daemon Docker e credencial do banco continuam sendo acessos privilegiados fora da aplicação. |

Não identifiquei outro caminho direto de elevação de conta comum para ADMIN nos trechos revisados. Isso não inclui uma avaliação completa de todas as rotas nem da infraestrutura institucional.

## O que o administrador consegue fazer hoje

| Caso de manutenção | Estado atual | Encaminhamento |
| --- | --- | --- |
| Buscar pessoa por nome, e-mail ou prontuário | Lista paginada com os papéis e quantidade de respostas | Manter. |
| Cadastrar pessoa sem conta | Botão Cadastrar conta, senha inicial e papel opcional | Funciona; troca obrigatória da senha inicial ainda não existe. |
| Conceder/remover professor ou administrador | Botões e endpoints existentes, com trilha de auditoria; não permite remover o próprio ADMIN pela interface | Manter confirmação explícita e conferir titularidade antes de autorizar. |
| Conferir acesso suspeito e mudanças de conta/papéis | Aba de atividades com filtros e paginação | Manter; não registrar senhas ou tokens nos eventos. |
| Corrigir nome/prontuário de outra pessoa | **Não existe botão nem endpoint** | P1: edição administrativa limitada desses campos, com motivo, confirmação e auditoria. Preservar unicidade do prontuário. |
| Ajudar quem perdeu a senha | **Não existe recuperação nem redefinição administrativa** | P1: fluxo de redefinição seguro, descrito abaixo. Editar o perfil não resolve perda de senha. |
| Corrigir e-mail incorreto de uma pessoa | Apenas a própria pessoa consegue mudar, com senha atual | P1: procedimento administrativo separado com confirmação da identidade e auditoria. Mudar e-mail altera o identificador de entrada; não tratar como simples correção de nome. |
| Encerrar sessões de uma conta comprometida | Só a própria pessoa, ao trocar a senha, encerra as outras sessões | P1: ação administrativa de encerrar sessões, com confirmação e motivo. |
| Bloquear conta abusiva temporariamente | Remover papéis tira privilégios, mas não impede login como estudante | P1/P2: suspensão reversível e auditada; avaliar necessidade operacional antes de criar novos estados. |
| Apagar conta a pedido do titular | Não há botão/endpoints administrativos de exclusão | P2: definir retenção/anonimização institucional antes de implementar. Não apagar vínculos e histórico editorial por um DELETE genérico. |
| Fazer backup/restaurar falha de banco | Script e procedimento de operação; sem botão no site. Neste lote, o backup passa a incluir `/data`, além do SQL | Manter fora do painel, com acesso de operador. Ensaiar restauração e guardar cópia externa. |
| Importar prova e consultar/revisar lotes | Aba de importações existente | Manter separação de conta e curadoria; não acrescentar manutenção genérica de tabelas. |

P1 indica lacuna relevante para atendimento real a estudantes; P2 depende de definição operacional. Esta matriz é análise, não declaração de implementação dessas ações.

## Redefinição de senha: mínimo recomendado

1. Localizar a conta existente, conferir a identidade por canal institucional e selecionar **Redefinir acesso**. Preservar respostas e histórico; não criar conta substituta.
2. Exigir nova confirmação da senha do administrador para esta ação sensível e registrar ator, destinatário e motivo. Não mostrar a senha atual: o sistema não deve conseguir recuperá-la.
3. Gerar autorização aleatória, de uso único e com validade limitada, guardar apenas seu hash e entregar por canal seguro. Não colocar segredo em log de atividade ou tabela de contas.
4. O titular define sua própria senha; a autorização é consumida atomicamente e as sessões anteriores são encerradas. Limitar tentativas e permitir revogar autorização pendente.
5. Distinguir o tratamento de contas administrativas e de estudante; uma recuperação de admin exige verificação de titularidade compatível com seu poder. O CLI permanece o recurso do operador para recuperar a administração quando nenhum admin consegue entrar.

Não é necessário construir MFA, SSO, editor de banco ou login como outra pessoa para resolver esse atendimento inicial. MFA/SSO institucional podem ser avaliados à parte.

## Prontidão para publicar hoje/amanhã

Prioridades avaliadas pelo impacto em pessoas estudando e na recuperação da instalação, sem exigir todos os recursos desejáveis para o primeiro piloto.

| Prioridade | Evidência e decisão | Critério verificável antes de anunciar |
| --- | --- | --- |
| P0 — código | Bootstrap `ADMIN_EMAILS` permitia apropriação do primeiro admin por cadastro de e-mail não verificado | Publicar o commit com a remoção e criar/conferir o admin pelo CLI. A concessão antiga não é desfeita automaticamente. |
| P0 — código | `FileFieldsInterceptor` bufferizava até três PDFs de 10 MB antes de `requireRole` em `POST /api/imports` | Guard ADMIN antes de processar multipart, mantida validação na ação. Regressão deve comprovar rejeição de usuário sem privilégio antes de erro de parsing/tamanho; ADMIN mantém o fluxo original. Não é execução de comando, mas exposição a consumo de memória por upload público. |
| P0 — operação | `Dockerfile` interrompe startup se migration falhar; scripts/migrate.mjs usa transação, checksum e advisory lock. `atualizar.sh` baixa imagem publicada após CI, mas `.env.example` usa `latest` | Fixar a tag curta do commit revisado no deploy e guardar a anterior para rollback; conferir log de migrations e saúde. Não aplicar migrations manualmente editadas. A publicação no GHCR deve ter terminado antes do pull da versão escolhida. |
| P0 — operação | PostgreSQL tem volume próprio; PDFs/recortes ficam no volume `/data`, gravável pelo uid 1000. Backup anterior copiava **só o banco** | Script deste lote cria conjunto SQL + `/data` + hashes, publicando-o apenas ao concluir os dois. Executar backup na instalação, conferir hashes, copiar para fora e ensaiar restauração em projeto separado. Sintaxe `bash -n` conferida nesta revisão; nenhum backup/restore real foi executado. |
| P0 — operação | API exige origem HTTPS em produção e cookies Secure; Compose de referência não publica banco/API, Caddy faz proxy. IFSP real não foi acessado | Conferir DNS, certificado, origem exata, proxy real, `TRUST_PROXY` e portas externas; só proxy deve expor HTTPS. Não afirmar que firewall/SSH/privacidade de rede já estão validados pelo repositório. |
| P0 — conteúdo mínimo | Entrypoint deixa API subir se bootstrap falhar; `/api/health` só faz `SELECT 1`. `alreadyImported` pula fonte existente no banco sem verificar se seus bytes ainda estão no disco | Health verde não basta: conferir carga esperada de 246 objetivas/39 discursivas, abrir uma imagem e uma discursiva e retomar uma tentativa após reiniciar. Restaurar banco sem `/data` não garante reconstrução automática dos ativos. Se só o banco subiu e o catálogo está vazio, não anunciar a plataforma pronta. |
| P1 — suporte | Sem redefinição administrativa de senha/perfil, encerramento de sessões ou bloqueio de conta | Definir um operador e procedimento de atendimento para o piloto; implementar recuperação e correção de dados antes de ampliar o uso. Ausência desses botões é lacuna operacional, não prova de que um usuário comum consiga alterá-los. |
| P1 — capacidade | Scrypt limita duas derivações simultâneas; login tem limites por e-mail/IP e contadores em memória; API em produção limita requisições. IFSP pode compartilhar um IP de saída | Rodar inicialmente uma instância, medir uso da turma e verificar se o proxy informa IP corretamente. Registrar/explicar 429 e 503. Mais instâncias exigem limitador compartilhado; não aumentar limites só para esconder um proxy incorreto. |
| P1 — dados pessoais | Conta registra e-mail, nome/prontuário e histórico; atividade tem retenção de 180 dias. Texto institucional e processo de exclusão continuam pendentes no HANDOFF | Confirmar responsável institucional, canal de suporte e acesso restrito a dados/backups. Não publicar credenciais nem cópia de ensaio com dados reais. |
| Pode esperar | 33 PDFs recentes, cinco padrões antigos FG e 2005 Q60 legível ainda faltam no HANDOFF; revisão humana dos materiais e CQ-2 também são pendências distintas | Divulgar o acervo disponível com suas ressalvas, sem afirmar que todos os anos estão completos ou que conteúdo assistido recebeu revisão humana. Não inventar conteúdo para preencher a falta. |
| Pode esperar | PWA, modo escuro, novas conquistas, ranking por turma, novos materiais e expansões de biblioteca | Não ampliar o escopo para disponibilizar o primeiro conjunto de estudos. MFA/SSO e outras integrações ficam em análise institucional separada. |

### Smoke mínimo na instalação publicada

Os E2E de `accounts.spec.ts`, `study.spec.ts`, `exam.spec.ts`, `edition-exam.spec.ts`, `enade-format.spec.ts`, `discursive.spec.ts` e `mascot-motion.spec.ts` dão cobertura automatizada às jornadas. Os resultados da suíte final precisam constar no PR; esta revisão não os executou. Os testes usam fixtures controladas, portanto não substituem a conferência dos arquivos/dados carregados no servidor.

1. Pela URL HTTPS pública, criar uma conta de ensaio e entrar/sair. Conferir Mostrar/Ocultar senha por mouse e teclado e persistência depois do login.
2. Buscar questão, abrir imagem, responder e ver correção. Recarregar e conferir a resposta salva. Usar um exemplo com figura, não só questão textual.
3. Iniciar treino parcial, salvar, sair/retomar e finalizar com revisão. Conferir aviso ao tentar iniciar outro enquanto ele está aberto.
4. Em uma edição histórica, abrir D1–D5 pelo mapa/rodapé, salvar textos distintos e voltar. No formato 2026, conferir 45 objetivas + uma discursiva e padrão liberado somente após conclusão.
5. Em uma conta comum, abrir diretamente a URL administrativa e chamar uma rota administrativa: acesso recusado. Na conta ADMIN, conferir lista, concessão/revogação de papel e registro da ação.
6. Em 320/390 px e desktop, conferir menu, campos e modal de finalização. Com redução de movimento ativada, navegação e Dudu devem continuar utilizáveis sem gestos.
7. Após reinício dos contêineres, repetir imagem, login e retomada. Conferir que o backup completo recente pode ser restaurado em ambiente separado.

## Pontos residuais proporcionais

- A autorização administrativa é verificada na entrada da requisição, fora da transação de escrita. Uma operação já autorizada pode terminar enquanto outra requisição revoga o papel ou encerra a sessão. Não é caminho de elevação para usuário comum; revalidação/serialização é melhoria de defesa para ações sensíveis futuras.
- Concessão/revogação de papéis hoje não pede senha novamente. A sessão ADMIN roubada permite ações administrativas. Usar HTTPS, proteger o equipamento e adicionar confirmação de senha nos fluxos críticos de recuperação/concessão, sem presumir que esconder a interface ofereça proteção.
- Confirmar no IFSP que só o proxy publica HTTPS, que API/banco não ficam acessíveis por caminho alternativo, que SSH usa acesso restrito e que `TRUST_PROXY` corresponde à cadeia real. O Compose demonstra intenção de isolamento, não comprova o estado do servidor.
