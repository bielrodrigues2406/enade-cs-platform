# Dudu em camadas

Origem: sete PNGs enviados por Gabriel em `dudu_7_camadas.zip`, recebidos em 02/11/2026.
Os hashes dos arquivos recebidos e dos fontes preparados estão em `provenance.json`.

- `reference.png`: referência completa fornecida por Gabriel, preservada.
- `body.png` e `open-eyes.png`: camadas fornecidas com alfa, preservadas.
- `head.png`, `left-wing.png`, `right-wing.png` e `closed-eyes.png`: fundo quadriculado
  removido com image_gen, preservando personagem, proporções e posição geral.

Todos os fontes têm 1024 × 1536 pixels e canal alfa. Há resíduos quase transparentes
fora das silhuetas; a caixa de enquadramento considera alfa ≥8. Os fundos foram
conferidos no navegador sobre papel e azul-marinho. As quatro edições são preparação
de arte; não atribuir ao remetente os PNGs tratados como se fossem bytes originais.

Para gerar os derivados de produção, com ImageMagick 6 ou 7 instalado:

```sh
node scripts/prepare-mascot-assets.mjs
```

O script apenas codifica WebP sem perdas, mantendo dimensões e pixels visíveis.
Não recorta, redimensiona ou redesenha o personagem. Os seis derivados somam cerca
de 639 KiB; são externos ao JavaScript e carregados sob demanda, com URLs comuns às telas.

O enquadramento e os pivôs estão em `apps/web/src/dudu-figure.component.css`.
O palco usa 900 × 1200 unidades com origem `(60,180)` na referência. As variáveis
`--source-*` são caixas em pixels dos fontes; posições percentuais montam as peças
no palco. Alterar uma arte exige conferir essas medidas, repouso e gestos em 56/64/80/120 px.
Não alterar somente o tamanho do arquivo e esperar que os pivôs continuem corretos.
