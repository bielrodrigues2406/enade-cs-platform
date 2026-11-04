# Preparação ENADE · Ciência da Computação

Plataforma de estudo para o ENADE de Ciência da Computação do IFSP Presidente Epitácio, em português. Angular 22, NestJS 12 e PostgreSQL 17.

## O que tem

- **Banco de questões:** 246 objetivas oficiais de 2005 a 2021, com imagem da prova, gabarito, área e explicação, além das questões autorais.
- **Treinos:** por quantidade ou área (simulado de Redes, por exemplo), com cronômetro opcional; prova completa da edição em 4 h com pausa; "Refazer as erradas".
- **Caderno de erros** com revisão espaçada e **discursivas** com padrão de resposta e autoavaliação.
- **Contas e papéis:** perfil, administração (correção cadastral, redefinição de senha provisória e encerramento de sessões), professores, turmas, chamada pelo celular e painel de desempenho.
- **Curadoria:** cadastro de questões com revisão por outra pessoa; importador de provas novas (PDF + gabarito) com editor de recortes.
- **Segurança:** limites contra força bruta e excesso de requisições; registro de atividades para a administração.

## Rodar no computador

Requisitos: Node 24.19, Docker Desktop e Poppler (`pdfinfo`). No Windows: `winget install -e --id oschwartz10612.Poppler`.

```sh
npm ci
npm run db:up            # banco local no Docker (cria o .env na primeira vez)
npm run db:migrate
npm run db:seed          # 3 questões de demonstração
npm run bootstrap:content   # baixa as provas do Inep e publica as 246 questões
```

Depois, em dois terminais:

```sh
npm run dev:api          # API em http://localhost:3000 (teste: /api/health)
npm run dev:web          # site em http://localhost:4200
```

Para criar o primeiro administrador (ou recuperar a senha de um administrador), cadastre a conta pelo site e rode `npm run admin:role -- grant seu@email` ou `npm run admin:role -- reset-password seu@email` no servidor. Cadastro público e variáveis de e-mail não concedem privilégios.

## Testes

```sh
npm run build
npm test                 # API com PostgreSQL
npm run test:e2e         # navegador (Chromium)
npm run test:e2e:production # build otimizado servido pela API, com CSP real (após npm run build)
```

O CI do GitHub roda tudo isso e constrói a imagem de produção em cada PR.

## Publicar

A imagem do `Dockerfile` serve API e site juntos. O caminho recomendado é o **servidor do câmpus IFSP** usando `deploy/campus/` ([DEPLOY §5.1](docs/DEPLOY.md)), com scripts prontos para subir/atualizar, fazer backup diário, desligar após novembro e restaurar depois sem perda de dados.

## Documentação

- [Deploy e segurança](docs/DEPLOY.md) · [Contrato da API](docs/API.md) · [Arquitetura](docs/ARCHITECTURE.md)
- [Produto](docs/MASTER-SPEC.md) · [Experiência de uso](docs/UX-DESIGN-SPEC.md) · [Engenharia](docs/ENGINEERING-AND-DELIVERY.md)
- [Fontes oficiais](docs/OFFICIAL-SOURCES.md) · [Conferência das questões](data/agent-reviews/PROCESS.md) · [Importação](docs/QUESTION-IMAGES-AND-IMPORT.md)
- [Quadro de trabalho](docs/WORKBOARD.md) · decisões em `docs/ADR-*.md`

O projeto será entregue à Fábrica de Software do IFSP. Antes disso falta a revisão integral do código ([CQ-2](docs/ENGINEERING-AND-DELIVERY.md#13-manutenção-humana-e-passagem-à-fábrica-de-software)).
