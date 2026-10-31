import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";

export const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Dados inválidos.", 400);
  return value as Record<string, unknown>;
};
export function text(
  value: unknown,
  name: string,
  max: number,
  min = 1,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    fail(`${name}: use de ${min} a ${max} caracteres.`, 400);
  return (value as string).trim();
}
export function revision(body: Record<string, unknown>) {
  if (
    !Number.isSafeInteger(body.baseRevision) ||
    (body.baseRevision as number) < 1 ||
    (body.baseRevision as number) > 1000000
  )
    fail("Revisão inválida. Reabra a versão.", 400);
  return body.baseRevision as number;
}
/**
 * Quem cura conteúdo: o papel próprio de curadoria ou os papéis de professor e
 * administração. Publicar continua exigindo a revisão de outra pessoa.
 * Com `lock`, segura as linhas de papel até o fim da transação.
 */
export async function canCurate(client: PoolClient | typeof db, identityId: string, lock = false) {
  const share = lock ? " FOR SHARE" : "";
  const own = await client.query(`SELECT 1 FROM curator_role WHERE identity_id=$1${share}`, [identityId]);
  if (own.rowCount) return true;
  const staff = await client.query(
    `SELECT 1 FROM account_role WHERE identity_id=$1 AND role IN ('PROFESSOR','ADMIN')${share}`, [identityId]);
  return Boolean(staff.rowCount);
}
export async function curator(req: any, client?: PoolClient, lock = false) {
  const user = await requireIdentity(req, client, lock);
  if (!user.email || !(await canCurate(client ?? db, user.id, lock))) fail("Acesso reservado à curadoria.", 403);
  return user;
}
export async function transaction<T>(
  req: any,
  action: (client: PoolClient, actorId: string) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const user = await curator(req, client, true);
    const result = await action(client, user.id);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505")
      fail("O registro já existe. Atualize a fila para continuar.", 409);
    throw error;
  } finally {
    client.release();
  }
}
