import { Body, Controller, Get, HttpCode, Post, Query, Req } from "@nestjs/common";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";

// Papéis da plataforma (ROLE-1, D14). A curadoria editorial continua em
// curator_role; aqui ficam administração e docência.
export const ROLES = ["ADMIN", "PROFESSOR"] as const;
export type Role = (typeof ROLES)[number];
type Actor = string | null; // nulo: comando administrativo no servidor

const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const PAGE_SIZE = 25;

export function parseRole(value: unknown): Role {
  if (typeof value !== "string" || !(ROLES as readonly string[]).includes(value))
    fail("Papel inválido.", 400);
  return value as Role;
}
export function parseEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) fail("Informe um e-mail válido.", 400);
  return email;
}

export async function rolesOf(identityId: string, client?: PoolClient): Promise<Role[]> {
  const rows = await (client ?? db).query<{ role: Role }>(
    "SELECT role FROM account_role WHERE identity_id=$1 ORDER BY role",
    [identityId],
  );
  return rows.rows.map((row) => row.role);
}

/** Exige conta com o papel; 403 para quem não tem, sem revelar mais nada. */
export async function requireRole(req: any, role: Role) {
  const user = await requireIdentity(req);
  if (!user.email || !(await rolesOf(user.id)).includes(role))
    fail("Esta área é restrita.", 403);
  return user;
}

async function record(client: PoolClient, email: string, role: Role, action: string, actor: Actor) {
  await client.query(
    "INSERT INTO role_event(email,role,action,actor_id) VALUES($1,$2,$3,$4)",
    [email, role, action, actor],
  );
}

/**
 * Autoriza um e-mail para um papel. Se a conta já existe, o papel vale na
 * hora; senão fica um convite, aplicado quando a conta for criada.
 */
export async function authorize(client: PoolClient, email: string, role: Role, actor: Actor) {
  const account = (await client.query<{ id: string }>(
    "SELECT identity_id AS id FROM account WHERE email=$1 FOR SHARE", [email],
  )).rows[0];
  if (account) {
    const granted = await client.query(
      "INSERT INTO account_role(identity_id,role,granted_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [account.id, role, actor],
    );
    if (granted.rowCount) await record(client, email, role, "GRANTED", actor);
    return { status: "GRANTED" as const };
  }
  if (!actor) fail("Não há conta com esse e-mail. Crie a conta pelo site antes.", 404);
  const invited = await client.query(
    "INSERT INTO role_invitation(email,role,invited_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [email, role, actor],
  );
  if (invited.rowCount) await record(client, email, role, "INVITED", actor);
  return { status: "INVITED" as const };
}

/** Remove o papel e o convite pendente do e-mail. */
export async function revoke(client: PoolClient, email: string, role: Role, actor: Actor) {
  const removed = await client.query(
    `DELETE FROM account_role r USING account a
     WHERE a.identity_id=r.identity_id AND a.email=$1 AND r.role=$2`,
    [email, role],
  );
  if (removed.rowCount) await record(client, email, role, "REVOKED", actor);
  const cancelled = await client.query(
    "DELETE FROM role_invitation WHERE email=$1 AND role=$2", [email, role],
  );
  if (cancelled.rowCount) await record(client, email, role, "INVITATION_CANCELLED", actor);
}

/**
 * Primeiro administrador pela configuração do servidor (ADMIN_EMAILS, e-mails
 * separados por vírgula): recebe o papel quando a conta existe, ao iniciar o
 * servidor ou no cadastro, **somente enquanto não houver nenhum administrador**.
 * Como o e-mail não é confirmado, isso limita a janela em que outra pessoa
 * poderia cadastrar o endereço antes do dono (auditoria de 31/10, C1).
 */
export function configuredAdmins(value = process.env.ADMIN_EMAILS ?? "") {
  return value.split(",").map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 254);
}

export async function grantConfiguredAdmin(client: PoolClient, email: string) {
  if (!configuredAdmins().includes(email)) return;
  // Serializa com outros cadastros para dois e-mails não virarem o "primeiro" juntos.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('first-admin',0))");
  const hasAdmin = (await client.query("SELECT 1 FROM account_role WHERE role='ADMIN' LIMIT 1")).rowCount;
  const exists = (await client.query("SELECT 1 FROM account WHERE email=$1", [email])).rowCount;
  if (!hasAdmin && exists) await authorize(client, email, "ADMIN", null);
}

export async function grantConfiguredAdmins() {
  for (const email of configuredAdmins()) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await grantConfiguredAdmin(client, email);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

/** Converte convites pendentes em papéis quando a conta passa a existir. */
export async function applyInvitations(client: PoolClient, identityId: string, email: string) {
  const invitations = (await client.query<{ role: Role; invitedBy: string }>(
    `DELETE FROM role_invitation WHERE email=$1 RETURNING role,invited_by AS "invitedBy"`,
    [email],
  )).rows;
  for (const invitation of invitations) {
    await client.query(
      "INSERT INTO account_role(identity_id,role,granted_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [identityId, invitation.role, invitation.invitedBy],
    );
    await record(client, email, invitation.role, "GRANTED", invitation.invitedBy);
  }
}

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

@Controller("api")
export class RolesController {
  // Papéis da sessão atual, para a interface decidir o que mostrar.
  @Get("access") async access(@Req() req: any) {
    const user = await requireIdentity(req);
    return { roles: user.email ? await rolesOf(user.id) : [] };
  }

  @Get("admin/users") async users(@Req() req: any, @Query("q") q = "", @Query("page") page = "1") {
    await requireRole(req, "ADMIN");
    if (typeof q !== "string" || q.length > 120 || !/^[1-9]\d{0,4}$/.test(String(page)))
      fail("Filtro inválido.", 400);
    const offset = (Number(page) - 1) * PAGE_SIZE;
    const result = await db.query(
      `WITH matching AS (
         SELECT a.identity_id AS id,a.email,a.display_name AS name,a.enrollment,a.created_at AS "createdAt",
           COALESCE(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL),'{}') AS roles,
           (SELECT count(*)::int FROM answer x WHERE x.owner_id=a.identity_id) AS answers
         FROM account a LEFT JOIN account_role r ON r.identity_id=a.identity_id
         WHERE $1='' OR strpos(lower(a.email),lower($1))>0 OR strpos(lower(COALESCE(a.display_name,'')),lower($1))>0
           OR strpos(lower(COALESCE(a.enrollment,'')),lower($1))>0
         GROUP BY a.identity_id)
       SELECT (SELECT count(*)::int FROM matching) AS total,
         COALESCE((SELECT json_agg(m ORDER BY m."createdAt" DESC) FROM
           (SELECT * FROM matching ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3) m),'[]') AS items,
         COALESCE((SELECT json_agg(i ORDER BY i."createdAt" DESC) FROM
           (SELECT email,role,created_at AS "createdAt" FROM role_invitation) i),'[]') AS invitations`,
      [q.trim(), PAGE_SIZE, offset],
    );
    return { ...result.rows[0], page: Number(page), pageSize: PAGE_SIZE };
  }

  @Post("admin/roles") @HttpCode(200) async grant(@Req() req: any, @Body() body: any) {
    const admin = await requireRole(req, "ADMIN");
    const email = parseEmail(body?.email), role = parseRole(body?.role);
    return inTransaction((client) => authorize(client, email, role, admin.id));
  }

  @Post("admin/roles/revoke") @HttpCode(200) async remove(@Req() req: any, @Body() body: any) {
    const admin = await requireRole(req, "ADMIN");
    const email = parseEmail(body?.email), role = parseRole(body?.role);
    if (email === admin.email && role === "ADMIN")
      fail("Você não pode remover o próprio acesso de administrador.", 409);
    await inTransaction((client) => revoke(client, email, role, admin.id));
    return { status: "REVOKED" };
  }
}
