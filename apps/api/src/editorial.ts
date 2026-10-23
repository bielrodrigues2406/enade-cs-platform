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
export async function curator(req: any, client?: PoolClient, lock = false) {
  const user = await requireIdentity(req, client, lock);
  const role = await (client ?? db).query(
    `SELECT identity_id FROM curator_role WHERE identity_id=$1 ${lock ? "FOR SHARE" : ""}`,
    [user.id],
  );
  if (!user.email || !role.rowCount) fail("Acesso reservado à curadoria.", 403);
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
