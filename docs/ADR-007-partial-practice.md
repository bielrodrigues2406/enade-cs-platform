# ADR 007 — Tentativas de treino parcial

Status: aceita e implementada em SIM-P1, 29/10/2026. Gabriel pediu continuar após CAT-1 e ampliar o treino parcial. A proposta de cinco foi substituída por 10/20/30, com 20 como padrão.

## Escopo

Treino parcial sem cronômetro, misto ou por área canônica. Começar só com o tamanho exato de questões lógicas distintas publicadas; nunca duplicar nem promover itens privados para completar. A disponibilidade considera os ponteiros publicados atuais, incluindo autorais/demonstrações identificadas. O treino não reproduz uma prova oficial nem prevê nota ENADE. Formato completo, tempo de prova e discursivas são incrementos posteriores.

Uma tentativa fixa as versões e a ordem dos itens, sem embaralhar alternativas. Usa IDs das alternativas, não sua letra/posição. Uma nova publicação não altera o conteúdo/gabarito aplicado. Não há modelo paralelo para diagnóstico futuro: seleção e tentativa pertencem ao mesmo domínio.

## Persistência e integridade

Migration 012 cria tentativa e itens. Uma tentativa em andamento por identidade; visitantes e contas usam o mesmo proprietário já existente. Cadastro conserva esse proprietário; login em conta existente não mescla o treino anônimo. Tentativas pertencem à identidade, sem ID de proprietário recebido do cliente. Excluir a identidade administrativa remove suas tentativas; versões utilizadas permanecem referenciadas enquanto houver tentativa.

Criar usa requestId UUID, único por proprietário: retry da mesma configuração devolve a mesma tentativa; reutilizar com outra configuração dá 409. Uma segunda criação distinta durante tentativa ativa dá 409. Seleção e persistência são transacionais, serializadas pelo proprietário. Respostas só podem apontar para uma alternativa da versão do próprio item.

Cada item mantém revisão monotônica para alternativa e marcação de revisão. Retry idêntico é idempotente; base antiga/conflitante dá 409. Escritas revalidam e bloqueiam a sessão e a tentativa. Salvar e finalizar serializam na mesma linha: nenhuma escrita posterior altera o resultado finalizado. Finalização é idempotente e registra resumo imutável; respostas não dadas contam separadamente, sem serem omitidas do denominador.

O DTO em andamento não contém acerto, gabarito, explicação, link do gabarito ou resumo de correção, mesmo se o estudante já respondeu a mesma questão no estudo livre. O conteúdo público da prova e seus recortes continuam acessíveis; este é treino de estudo, não fiscalização de prova. Após finalizar, o DTO inclui revisão por item e acertos/total, erradas, não respondidas e distribuição por assunto. Respostas do treino não sobrescrevem respostas do estudo livre nem alimentam seu caderno de erros nesta etapa; PRG-1 poderá consumir os resultados pelo contrato.

## Experiência

Entrada em /treino, com tamanho/área, disponibilidade real, retomada da tentativa ativa e cinco resultados recentes. Tela de tentativa usa a apresentação de questão existente, navegação por número e marcação de revisão. Seleção salva automaticamente com confirmação do servidor; erro mantém o rascunho, permite retry e bloqueia finalização/navegação que descartaria dados. Conflito não é sobrescrito silenciosamente: oferecer reabrir a tentativa.

Antes de finalizar, confirmar quantidade respondida, em branco e marcada. Após finalizar, apresentar resultado e permitir rever cada item com o mesmo conteúdo aplicado. Reload, novo acesso e troca de aba recuperam o estado do servidor. URL contém somente tentativa e item, sem alternativas ou dados da conta. Não usar localStorage para respostas.

## Verificação

PostgreSQL real: autorização, falta de conteúdo, versões fixas, IDs estrangeiros, revisões, concorrência entre saves/finalização, idempotência, ausência de gabarito em andamento e resultado calculado independentemente. Chromium: vazio/indisponível, início, salvamento, retry/conflito, retorno/reload, confirmação, revisão final, imagens, teclado e 320/390/768/1440 px. Fixtures TEST ONLY removidas; nenhum item real publicado para viabilizar os testes.

## Evidência da entrega

Build, 139 testes API/PostgreSQL/utilitários e 48 fluxos Chromium passaram em sequência. Os 12 casos de API do domínio usam credenciais distintas nas concorrências e conferem resultado com três acertos, um erro e seis brancas, versões/gabaritos antigos e integridade no banco. Nove novos E2E cobrem os três tamanhos, retomada, falha com resposta aplicada no servidor, retry, conflito, chave ausente antes do fim, fonte/imagem D10 e cadastro/saída. Rodaram também com limite padrão de 30 s.

Revisão independente de agente corrigiu gravação incerta que liberava a guarda, snapshot de retry de criação e foco ao iniciar/retomar; sem bloqueadores remanescentes. Capturas em 320/390/768/1440 antes/depois levaram à folha recolhível no mobile, sem duplicar renderer. Não é certificação WCAG, teste com leitor de tela real ou validação humana de aprendizagem.

Após limpar as fixtures, a consulta READ ONLY confirmou 605 ocorrências privadas, 169 com assunto, as três demos públicas originais, zero tentativas e zero questões de fixture restantes. Nenhuma questão oficial foi publicada. Artefatos locais ignorados em `.local/partial-practice/`; a entrega está no [PR #22](https://github.com/bielrodrigues2406/enade-cs-platform/pull/22), condicionada ao CI de seu HEAD final.
