# ADR-015: companhia de estudo e reflexão pessoal

Status: aceito para MAS-2. Data: 02/11/2026.

O Dudu acompanha momentos de estudo sem reagir a alternativas antes da confirmação.
Uma preferência de conta, em `account.mascot_enabled`, acompanha a pessoa entre aparelhos;
visitantes mantêm a escolha no navegador. Cada troca de identidade invalida respostas
assíncronas da preferência anterior. Uma falha nessa leitura não impede estudar.

A reflexão é um recurso de estudo livre, separado de respostas de simulados e de conteúdo
editorial. `answer_reflection` relaciona a identidade à versão respondida; só uma resposta
incorreta dessa identidade autoriza a escrita. A pessoa continua podendo ler sua reflexão
depois de corrigir a questão, mas o caderno deixa de listar o erro resolvido. O texto não
entra em logs, explicações compartilhadas ou correção por IA.

Uma revisão inteira otimista protege abas concorrentes. A transação bloqueia a resposta
do proprietário, compara a revisão e grava uma nova revisão; repetir a mesma gravação
cuja confirmação se perdeu retorna o estado confirmado. Conflitos preservam o texto no
navegador e pedem reabrir a questão. Não há sincronização silenciosa de rascunhos.

O aviso de ritmo conta tempo ativo visível no item de um treino parcial cronometrado.
Aparece uma vez por item nessa instância do navegador após seis minutos. Não oferece
dicas, não funciona em prova completa e só avança após confirmar a marcação no servidor.
Uma recarga reinicia a contagem local; o cronômetro da tentativa continua sob autoridade
do servidor. Não é registrada telemetria adicional de atenção.

Apresentação em HTML/CSS por componente; contratos e persistência em controladores próprios.
A preferência remove imagens sem remover funções de estudo. Animações curtas usam os tokens
existentes e respeitam redução de movimento. Novas artes só substituem as atuais após
conferir os arquivos reais, transparência e legibilidade no tamanho de uso.
