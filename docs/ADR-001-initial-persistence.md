# ADR 001 — Persistência do primeiro fluxo executável

Data: 22/10/2026. Estado: adotada para a base de desenvolvimento.

## Contexto e decisão

A especificação recomenda Prisma após verificar compatibilidade. No onboarding, o registro npm estava acessível, mas o domínio de binários do Prisma respondeu HTTP 403 da política de rede. Não desabilitamos TLS, checksums ou assinatura. O domínio foi inicialmente solicitado no rascunho, mas não houve liberação de runtime confirmada.

A base usa `pg` 8.23.1 (MIT) e SQL parametrizado, PostgreSQL 17.6 fixado por digest. Angular 22.2.3 e NestJS 12.2.0 são versões estáveis MIT, compatíveis com Node 24.19.0; TypeScript 6.0.3 atende ao peer dependency do compilador Angular. Versões e licenças foram verificadas nos metadados publicados pelos mantenedores no npm. As instalações preservaram verificação de integridade do lockfile. Não adotamos a versão RC do Prisma listada pelo registro.

Migrations SQL versionadas usam transação, trava advisory e checksum; `scripts/migrate.mjs` recusa alteração de migration aplicada. O seed é transacional e não modifica uma versão já cadastrada. A constraint composta de alternativas protege respostas de IDs existentes em outra questão. A alternativa correta também tem FK composta, diferida para permitir inserção transacional do conteúdo. Publicação oficial está bloqueada por constraint até existir modelo de procedência e revisão.

## Limites e consequências

Não há ORM nem geração automática de tipos SQL nesta fatia. Prisma poderá ser adotado em ADR posterior, com migration baseline revisada e rede disponível; não introduzir um segundo dono do schema silenciosamente. O domínio de binários não é necessário ao setup atual e foi removido das adições de rede do rascunho.

`question_version` representa versões imutáveis por convenção de aplicação/seed. Não há API editorial nesta entrega. O modelo completo de identidade lógica, fontes, autoria/revisão e publicação controlada continua pendente; não liberar curadoria usando SQL manual como recurso de produto.

As respostas são de prática individual, com revisão monotônica e serialização por visitante. Não existem tentativas de simulado, finalização, deadline ou métricas. Esses contratos serão introduzidos com testes próprios. O catálogo limita respostas a 50 itens; paginação deve preceder crescimento do conteúdo.

Sessões anônimas têm tokens aleatórios de 256 bits, hash no banco, cookie HttpOnly/SameSite Strict e expiração de 30 dias. Cookie Secure depende de NODE_ENV=production, mas isso não torna a aplicação pronta para produção. Não há cadastro/login, recuperação de histórico, limpeza programada de visitantes expirados ou rate limiting. O histórico identifica somente a sessão deste navegador e não uma pessoa autenticada.

## Evidência

Build completo; 5 testes de API/PostgreSQL e 5 E2E Chromium aprovados. Migrations/seed executados duas vezes sem duplicação. Testes cobrem acesso por sessão, não vazamento de conteúdo pendente, retries, conflito concorrente, salvamento/reload, teclado e reflow em quatro larguras. Falha de rede no E2E é injetada somente no endpoint de gravação; os demais passos usam frontend/API/banco reais. Não foram executados WebKit, Firefox, piloto com estudantes, pentest ou auditoria completa de acessibilidade.
