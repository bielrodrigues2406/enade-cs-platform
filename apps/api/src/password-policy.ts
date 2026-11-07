import { readFileSync } from "node:fs";
import path from "node:path";
import { fail } from "./api-error.js";

// Regras para criar ou trocar senha (pedido de Gabriel em 07/11/2026): mínimo de 8
// caracteres, como na OWASP ASVS 5.0, compensado por recusar senhas comuns e dados
// da própria pessoa. Sem exigir símbolos: a NIST desaconselha regras de composição.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
// Palavras do próprio site que tornariam a senha fácil de adivinhar.
const SITE_WORDS = ["enade", "cadernocc"];

export type PasswordOwner = { email?: string | null; name?: string | null; enrollment?: string | null };

let common: Set<string> | null = null;
/** Lista do SecLists filtrada (data/security/README.md), carregada uma vez. */
function commonPasswords() {
  common ??= new Set(
    readFileSync(path.resolve("data/security/common-passwords.txt"), "utf8")
      .split("\n").map((line) => line.trim()).filter(Boolean),
  );
  return common;
}

/** Minúsculas e sem acento: "Gabriel" e "gabriél" contam como o mesmo nome. */
export function normalizePassword(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Partes com 4 ou mais letras do e-mail, do nome e o prontuário. */
function personalWords(owner: PasswordOwner) {
  const local = owner.email?.split("@")[0] ?? "";
  return [...local.split(/[._+-]+/), ...(owner.name ?? "").split(/\s+/), owner.enrollment ?? "", ...SITE_WORDS]
    .map(normalizePassword)
    // Trechos hexadecimais com dígito (pedaços de UUID, anos) não identificam a pessoa.
    .filter((word) => word.length >= 4 && !(/^[0-9a-f]+$/.test(word) && /\d/.test(word)));
}

/** Sequências como "12345678", "abcdefgh" ou "87654321". */
function isSequence(text: string) {
  const steps = new Set([...text].slice(1).map((char, i) => char.charCodeAt(0) - text.charCodeAt(i)));
  return steps.size === 1 && [...steps].every((step) => Math.abs(step) === 1);
}

/** Motivo da recusa em português, ou null se a senha serve. */
export function passwordProblem(password: string, owner: PasswordOwner = {}): string | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN || length > PASSWORD_MAX)
    return `A senha deve ter de ${PASSWORD_MIN} a ${PASSWORD_MAX} caracteres.`;
  const text = normalizePassword(password);
  if (commonPasswords().has(text) || isSequence(text))
    return "Essa senha está entre as mais usadas. Escolha outra.";
  if (new Set(text).size < 4) return "Use caracteres mais variados.";
  if (personalWords(owner).some((word) => text.includes(word)))
    return "A senha não pode conter seu nome, e-mail, prontuário ou o nome do site.";
  return null;
}

/** Para as rotas que criam ou trocam senha; o login usa só o limite de tamanho. */
export function requireNewPassword(password: unknown, owner: PasswordOwner = {}) {
  if (typeof password !== "string") fail(`A senha deve ter de ${PASSWORD_MIN} a ${PASSWORD_MAX} caracteres.`, 400);
  const problem = passwordProblem(password as string, owner);
  if (problem) fail(problem, 400);
  return password as string;
}

/** Dados guardados da conta, para a política comparar com a senha nova (troca e reset). */
export async function passwordOwnerOf(db: { query: (sql: string, args: unknown[]) => Promise<{ rows: any[] }> }, identityId: string): Promise<PasswordOwner> {
  const row = (await db.query("SELECT email, display_name, enrollment FROM account WHERE identity_id=$1", [identityId])).rows[0];
  return row ? { email: row.email, name: row.display_name, enrollment: row.enrollment } : {};
}
