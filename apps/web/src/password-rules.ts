// Espelho das regras do servidor (apps/api/src/password-policy.ts), só para o medidor.
// Quem aceita ou recusa a senha é sempre o servidor.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
const SITE_WORDS = ["enade", "cadernocc"];

export type PasswordOwner = { email?: string | null; name?: string | null; enrollment?: string | null };
export type PasswordCheck = {
  length: boolean;
  /** null enquanto a lista de senhas comuns não chegou. */
  uncommon: boolean | null;
  personal: boolean;
  varied: boolean;
  score: 0 | 1 | 2 | 3 | 4;
};

let common: Promise<Set<string>> | null = null;
/** A lista (18 kB) só é baixada quando alguém começa a digitar uma senha nova. */
export function loadCommonPasswords() {
  common ??= fetch("/security/common-passwords.txt")
    .then((res) => (res.ok ? res.text() : ""))
    .then((text) => new Set(text.split("\n").map((line) => line.trim()).filter(Boolean)))
    .catch(() => new Set<string>());
  return common;
}

export function normalizePassword(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function personalWords(owner: PasswordOwner) {
  const local = owner.email?.split("@")[0] ?? "";
  return [...local.split(/[._+-]+/), ...(owner.name ?? "").split(/\s+/), owner.enrollment ?? "", ...SITE_WORDS]
    .map(normalizePassword)
    // Trechos hexadecimais com dígito (pedaços de UUID, anos) não identificam a pessoa.
    .filter((word) => word.length >= 4 && !(/^[0-9a-f]+$/.test(word) && /\d/.test(word)));
}

function isSequence(text: string) {
  const steps = new Set([...text].slice(1).map((char, i) => char.charCodeAt(0) - text.charCodeAt(i)));
  return steps.size === 1 && [...steps].every((step) => Math.abs(step) === 1);
}

/** Tipos de caractere presentes: minúscula, maiúscula, dígito, símbolo ou espaço. */
function characterKinds(password: string) {
  return [/\p{Ll}/u, /\p{Lu}/u, /\d/, /[^\p{L}\d]/u].filter((kind) => kind.test(password)).length;
}

export function checkPassword(password: string, owner: PasswordOwner, list: Set<string> | null): PasswordCheck {
  const size = [...password].length;
  const text = normalizePassword(password);
  const length = size >= PASSWORD_MIN && size <= PASSWORD_MAX;
  const uncommon = list ? !list.has(text) && !isSequence(text) && new Set(text).size >= 4 : null;
  const personal = !personalWords(owner).some((word) => text.includes(word));
  const varied = characterKinds(password) >= 2 && /\d|[^\p{L}\d]/u.test(password);
  let score: PasswordCheck["score"] = 0;
  if (size && length && uncommon !== false && personal) {
    // Tamanho pesa mais que variedade: uma frase longa vale mais que "Abc@1234".
    const base = size >= 14 ? 3 : size >= 10 ? 2 : 1;
    score = Math.min(4, base + (varied ? 1 : 0)) as PasswordCheck["score"];
  } else if (size) score = 1;
  return { length, uncommon, personal, varied, score };
}
