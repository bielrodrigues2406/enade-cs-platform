import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";

export type Identity = { id: string; email: string | null; name: string | null; tokenHash: string };
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function sessionHash(req: any): string | null {
  const token = (req.headers.cookie ?? "")
    .split(";")
    .map((v: string) => v.trim())
    .find((v: string) => v.startsWith("enade_session="))
    ?.slice(14);
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
  res.cookie("enade_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 86400000,
    path: "/api",
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
