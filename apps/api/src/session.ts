import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";

export type Identity = { id: string; email: string | null; name: string | null; tokenHash: string };
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** Normaliza IPv6 ao prefixo /64 e remove prefixo ::ffff: de IPv4 mapeado. */
export function normalizeIpForLimit(raw: string | null | undefined): string {
  const ip = (raw || "unknown").trim().toLowerCase();
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  if (!ip.includes(":")) return ip;
  const [left, right] = ip.split("::");
  const head = left ? left.split(":").filter(Boolean) : [];
  const tail = right !== undefined ? (right ? right.split(":").filter(Boolean) : []) : [];
  const missing = right !== undefined ? Math.max(0, 8 - head.length - tail.length) : 0;
  const full = [...head, ...Array(missing).fill("0"), ...tail].map((g) => g.padStart(4, "0"));
  return full.length >= 4 ? `${full.slice(0, 4).join(":")}::/64` : ip;
}

export function sessionCookieName(production = process.env.NODE_ENV === "production") {
  return production ? "__Host-enade_session" : "enade_session";
}

export function sessionHash(req: any): string | null {
  const prefix = `${sessionCookieName()}=`;
  const matches = (req.headers.cookie ?? "")
    .split(";")
    .map((v: string) => v.trim())
    .filter((v: string) => v.startsWith(prefix))
    .map((v: string) => v.slice(prefix.length));
  // Se outro subdomínio tentar injetar cookie duplicado (cookie tossing), recusamos ambos.
  if (matches.length !== 1) return null;
  const token = matches[0];
  return token && /^[a-f0-9]{64}$/.test(token) ? digest(token) : null;
}
export async function identity(
  req: any,
  client?: PoolClient,
  lock = false,
): Promise<Identity | null> {
  const tokenHash = sessionHash(req);
  if (!tokenHash) return null;
  const row = (
    await (client ?? db).query<{ id: string; email: string | null; name: string | null }>(
      `SELECT s.identity_id AS id,a.email,a.display_name AS name FROM browser_session s LEFT JOIN account a ON a.identity_id=s.identity_id WHERE s.token_hash=$1 AND s.expires_at>clock_timestamp() ${lock ? "FOR UPDATE OF s" : ""}`,
      [tokenHash],
    )
  ).rows[0];
  return row ? { ...row, tokenHash } : null;
}
export async function requireIdentity(
  req: any,
  client?: PoolClient,
  lock = false,
) {
  const user = await identity(req, client, lock);
  return (
    user ?? fail("Sua sessão expirou. Recarregue a página para continuar.", 401)
  );
}
export const sessionView = (user: { email: string | null; name?: string | null }) =>
  user.email
    ? { mode: "account" as const, email: user.email, name: user.name ?? null }
    : { mode: "guest" as const };
export function setSessionCookie(res: any, token: string) {
  const production = process.env.NODE_ENV === "production";
  res.cookie(sessionCookieName(production), token, {
    httpOnly: true,
    sameSite: "strict",
    secure: production,
    maxAge: 30 * 86400000,
    // __Host- exige Path=/ e proíbe Domain no navegador, impedindo subdomínios vizinhos (*.ifsp.edu.br) de forjar o cookie.
    path: production ? "/" : "/api",
  });
}
export async function issueSession(client: PoolClient, identityId: string) {
  const token = randomBytes(32).toString("hex");
  await client.query(
    "INSERT INTO browser_session(token_hash,identity_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '30 days')",
    [digest(token), identityId],
  );
  return token;
}
export async function createGuest(client: PoolClient) {
  const id = randomUUID();
  await client.query("INSERT INTO study_identity(id) VALUES($1)", [id]);
  return issueSession(client, id);
}
