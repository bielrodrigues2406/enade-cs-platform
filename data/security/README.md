# Senhas comuns

`common-passwords.txt`: senhas recusadas ao criar ou trocar senha, uma por linha, em minúsculas e com 8 ou mais caracteres (as menores já são recusadas pelo tamanho).

- Base: a lista `10k-most-common.txt` do [SecLists](https://github.com/danielmiessler/SecLists) (licença MIT), filtrada para 8 ou mais caracteres.
- Acréscimos: algumas senhas comuns no Brasil e ligadas ao projeto ("senha123", times de futebol, "enade2026", "cadernocc").

O servidor carrega este arquivo em `apps/api/src/password-policy.ts`, e a tela de senha usa a mesma lista (copiada para `/security/` pelo `angular.json`) só para o medidor. Quem decide é sempre o servidor.
