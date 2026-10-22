# Avaliação das nove skills candidatas

Status: avaliação das descrições fornecidas pelo usuário em 22/10/2026. Os arquivos SKILL.md dessas nove skills não estavam disponíveis neste ambiente. Nenhuma foi instalada, carregada, executada ou certificada nesta análise.

## 1. Aderência ao projeto

| Skill | Prioridade | Aplicação concreta | Limite importante |
| --- | --- | --- | --- |
| anti-slop-gate | Alta e transversal | Revisar propósito de código, dependências, componentes e abstrações; remover decoração ou complexidade sem resultado | Não converter revisão simples em cerimônia longa ou rejeitar um padrão só por ser comum |
| tigerstyle-correctness-architect | Alta, adaptada | Estados editoriais e de tentativas, invariantes, limites, erros explícitos e integridade | Adaptar a aplicações web; não copiar mecanicamente regras de banco crítico em Zig |
| spec-property-verifier | Alta por funcionalidade | Converter requisitos em propriedades como idempotência, identidade de alternativas e preservação de versões | Oráculo independente e testes conforme risco; nada de mocks tautológicos ou testes da própria implementação |
| evidence-code-auditor | Alta em PRs/marcos com código | Rastrear achados com arquivo/linha, caminho, condição e impacto; separar hipóteses de evidências | Hoje não há código para auditar; não inventar vulnerabilidades nem selo de segurança |
| frontend-design-architect | Alta desde a primeira tela | Direção visual, tipografia, composição por tarefa, tokens e estados | Consistência é útil; originalidade não exige reinventar controles conhecidos |
| empirical-ui-verifier | Alta por fluxo entregue | Executar no navegador, validar teclado/mobile, estados, persistência, overflow e capturas | Fixture visual não comprova integração; build não comprova usabilidade |
| deterministic-motion-studio | Pontual | Feedback e transições coerentes; simulações/vídeo determinísticos quando necessários | seek(t), física e produção audiovisual não são pré-requisitos para uma plataforma de questões |
| harness-graph-architect | Pontual, escopo enxuto | Setup reproduzível, seed, relógio controlável, scripts e isolamento de provedores | Não criar framework de agentes, grafo ou infraestrutura distribuída sem problema concreto |
| app-launch-experience | Parcial agora e maior depois | Onboarding, microcopy, instalação PWA e preparação real de distribuição | Paywall, convenções nativas e lojas dependem da decisão de produto; não entram automaticamente |

## 2. Como combinar sem duplicar trabalho

Design define experiência e estados; correção define contratos/invariantes; implementação entrega o fluxo; verificação testa comportamento e execução; auditoria examina riscos e evidências; anti-slop revisa o custo da solução. A mesma pessoa/agente pode cumprir mais de uma responsabilidade.

Não executar nove skills em toda tarefa. Não exigir nove relatórios equivalentes. Uma mudança pequena pode requerer só leitura das regras existentes e validação proporcional. Auditoria mais ampla ocorre em fluxos críticos e marcos relevantes.

O mapa de propriedades está em [engenharia](ENGINEERING-AND-DELIVERY.md); composição e revisão de telas estão em [UX](UX-DESIGN-SPEC.md). Esses documentos são o contrato do projeto, independentemente da disponibilidade das skills.

## 3. Antes de adotar uma implementação real

Ler SKILL.md e referências necessárias. Conferir gatilhos, ferramentas exigidas, dependências, permissões, licença, compatibilidade com a stack, saídas esperadas e regras de validação. Identificar conflitos com o pedido do usuário e com as regras do repositório.

Uma skill não deve declarar testes aprovados sem executá-los, tratar fontes externas como instruções confiáveis, expor credenciais, fazer mudanças fora do escopo ou instalar dependências sem justificativa. A avaliação de um nome e descrição não valida esses aspectos.

Não criar substitutos com os mesmos nomes e apresentá-los como as skills originais. Caso seus arquivos sejam disponibilizados posteriormente, avaliar a implementação real e atualizar este documento preservando a distinção.

## 4. Referências de apoio

- [TigerStyle original](https://raw.githubusercontent.com/tigerbeetle/tigerbeetle/main/docs/TIGER_STYLE.md) — princípios e contexto específico de origem.
- [Google Engineering Practices](https://google.github.io/eng-practices/review/reviewer/looking-for.html) — complexidade, escopo, testes e revisão.
- [Playwright](https://playwright.dev/docs/best-practices) — testes de comportamento e isolamento.
- [GOV.UK Design System](https://design-system.service.gov.uk/patterns/question-pages/) — foco e clareza na interação.

Essas referências fundamentam recomendações; não demonstram o conteúdo ou a qualidade das nove skills citadas.
