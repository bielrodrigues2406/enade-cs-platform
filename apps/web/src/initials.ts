/**
 * Iniciais para o avatar: primeira letra do primeiro e do último nome
 * ("Maria da Silva" → "MS"). Sem nome, usa a primeira letra do e-mail.
 */
export function initials(name: string | null | undefined, email = ""): string {
  const parts = (name ?? "").trim().split(/\s+/).filter((part) => /\p{L}/u.test(part));
  const letter = (word: string) => [...word.normalize("NFC")].find((char) => /\p{L}/u.test(char)) ?? "";
  if (parts.length >= 2) return (letter(parts[0]) + letter(parts[parts.length - 1])).toLocaleUpperCase("pt-BR");
  if (parts.length === 1) return letter(parts[0]).toLocaleUpperCase("pt-BR");
  return (letter(email) || "?").toLocaleUpperCase("pt-BR");
}

/** Primeiro nome, para o topo da página. */
export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}
