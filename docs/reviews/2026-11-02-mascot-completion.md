# MAS-2 — revisão de entrega (02/11/2026)

O Dudu acompanha início, acesso, biblioteca, revisão, discursivas, resumo, conquistas,
espera e erro do catálogo. Não aparece com pistas durante a resolução nem nas telas
administrativas. A preferência é visível para visitante e conta; a conta a conserva
no servidor, com proteção contra respostas atrasadas de outra identidade.

O aviso de ritmo só conta tempo visível e ativo do item no treino parcial cronometrado.
Após seis minutos, oferece marcar e seguir, espera confirmação do servidor e não
repete nesse item na mesma instância. Provas completas não o exibem.
A reflexão é pessoal, opcional e só aparece após erro confirmado no estudo livre;
protege texto não salvo, conflitos e falha de rede e volta no caderno.

Revisão estática independente pelo agente `content_completion`: achados sobre saída
com rascunho, corrida na preferência e sincronização do ritmo foram corrigidos e
rechecados. API/persistência sem achado P1; revisão não se apresenta como teste humano.

Validação local: 173 testes API passaram; cinco contratos novos foram repetidos após
o acabamento dos retornos. Build final abaixo de 500 kB. A suíte Chromium completa
executou 73 casos: 65 preexistentes passaram, e as duas falhas novas eram asserções de teste
(mensagem após avanço e texto com rótulo). Os casos ajustados foram reexecutados.
Conferidos preferência de conta/visitante, persistência da reflexão com falha/retry,
proteção de rascunho, redução de movimento, aviso fechável por teclado e larguras
320/390/768/1440. A inspeção visual ainda encontrou herança indevida de CSS global de
`aside` no aviso de ritmo: o contêiner agora tem semântica de nota e tamanho próprio,
com questão e ações visíveis em 390/1440. Cadastro passou a alinhar o aceno ao título.

As cinco novas imagens inline foram comparadas visualmente, não incorporadas.
MASCOT.md registra qualidade, resolução por pose e cuidado com o magenta/transparência.
Referência anti-slop consultada sem instalar instruções; os outros dois links foram
bloqueados pelo proxy. Nada desta validação representa deploy ou revisão integral CQ-2.
