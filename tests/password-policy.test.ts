import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { passwordProblem } from "../apps/api/src/password-policy.js";
import { checkPassword } from "../apps/web/src/password-rules.js";

// Senha com 8 caracteres (pedido de Gabriel, 07/11/2026), compensada por recusar
// senhas comuns e dados da própria pessoa. O medidor da tela segue a mesma regra.

const owner = { email: "maria.souza@example.invalid", name: "Maria Souza", enrollment: "PE3012345" };
const list = new Set(readFileSync("data/security/common-passwords.txt", "utf8").split("\n").filter(Boolean));

test("eight characters are enough when the password is not common or personal", () => {
  assert.equal(passwordProblem("v7#kq!2m", owner), null);
  assert.equal(passwordProblem("chuva na serra fria", owner), null);
  assert.match(passwordProblem("k7#q2m", owner)!, /de 8 a 128/);
  assert.match(passwordProblem("x".repeat(129), owner)!, /de 8 a 128/);
});

test("common passwords, sequences and repeated characters are refused regardless of case or accents", () => {
  for (const password of ["Password", "12345678", "SENHA123", "flamengo", "abcdefgh", "87654321", "aaaaaaaa", "abababab"])
    assert.ok(passwordProblem(password, owner), password);
});

test("the owner's name, e-mail, enrollment and the site name are refused inside the password", () => {
  for (const password of ["maria2026!", "Souza#2026", "pe3012345x", "Enade2026!", "meu cadernocc"])
    assert.match(passwordProblem(password, owner)!, /nome, e-mail, matrícula/, password);
  // Partes curtas do nome (menos de 4 letras) não bloqueiam senhas comuns de uma pessoa chamada "Ana".
  assert.equal(passwordProblem("ana-viaja-9", { name: "Ana Lu" }), null);
});

test("the screen meter agrees with the server and rewards length over symbols", () => {
  for (const password of ["v7#kq!2m", "12345678", "maria2026!", "k7#q2m", "chuva na serra fria"]) {
    const check = checkPassword(password, owner, list);
    const accepted = check.length && check.uncommon === true && check.personal;
    assert.equal(accepted, passwordProblem(password, owner) === null, password);
  }
  assert.equal(checkPassword("Abc@1234x", owner, list).score, 2);
  assert.equal(checkPassword("chuva na serra fria 7", owner, list).score, 4);
  assert.equal(checkPassword("12345678", owner, list).score, 1);
  // Sem a lista ainda carregada, o medidor não acusa nem aprova a regra das senhas comuns.
  assert.equal(checkPassword("v7#kq!2m", owner, null).uncommon, null);
});
