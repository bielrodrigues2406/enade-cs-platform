import { randomBytes } from "node:crypto";
import { Body, Controller, HttpCode, Param, Post, Put, Req, Res } from "@nestjs/common";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity, sessionHash } from "./session.js";
import { hashPassword, verifyPassword } from "./password.js";
import { AuthThrottle, credentials, emailAddress, profile } from "./auth.js";
import { applyInvitations, requireRole, rolesOf, type Role } from "./roles.js";
import { logActivity, recordActivity, requestIp } from "./activity.js";

// Manutenção administrativa de contas (ADM-2): correção cadastral (nome,
// prontuário e e-mail), redefinição de senha com encerramento de sessões e
// revogação avulsa de sessões ativas. Tudo revalida o papel ADMIN na transação
// e registra auditoria sem guardar senhas ou tokens.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LockedAccount = {
  id: string;
  email: string;
  name: string | null;
  enrollment: string | null;
  roles: Role[];
};

function parseAccountId(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value))
    return fail("Conta não encontrada.", 404);
  return value.toLowerCase();
}

function parseReason(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return fail("Informe um motivo válido.", 400);
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  if ([...cleaned].length > 160) return fail("Use até 160 caracteres no motivo.", 400);
  return cleaned;
}

function withReason(summary: string, reason: string | null): string {
  return reason ? `${summary} · Motivo: ${reason}` : summary;
}

async function verifyAdminPassword(
  req: any,
  res: any,
  adminId: string,
  adminEmail: string,
  password: unknown,
  throttle: AuthThrottle,
) {
  throttle.check(req, res, adminEmail);
  const stored = (
    await db.query<{ password_hash: string }>(
      "SELECT password_hash FROM account WHERE identity_id=$1",
      [adminId],
    )
  ).rows[0]?.password_hash;
  if (typeof password !== "string" || !(await verifyPassword(password, stored))) {
    logActivity({
      category: "SECURITY",
      action: "WRONG_PASSWORD",
      actorId: adminId,
      detail: "Senha de administrador incorreta na manutenção de contas",
      ip: requestIp(req),
    });
    fail("Sua senha de administrador está incorreta.", 403);
  }
  throttle.refund(req, adminEmail);
}

async function requireLockedAdmin(req: any, client: PoolClient) {
  const user = await requireIdentity(req, client, true);
  if (!user.email || !(await rolesOf(user.id, client)).includes("ADMIN"))
    fail("Esta área é restrita.", 403);
  return { id: user.id, email: user.email };
}

async function lockTargetAccount(client: PoolClient, id: string): Promise<LockedAccount> {
  const row = (
    await client.query<{
      id: string;
      email: string;
      name: string | null;
      enrollment: string | null;
    }>(
      `SELECT identity_id AS id,email,display_name AS name,enrollment
       FROM account WHERE identity_id=$1 FOR UPDATE`,
      [id],
    )
  ).rows[0];
  if (!row) fail("Conta não encontrada.", 404);
  const roles = await rolesOf(id, client);
  return { ...row, roles };
}

export async function eraseAccountData(
  client: PoolClient,
  id: string,
  email: string,
  disabledPasswordHash: string,
  actorId: string | null,
  reason: string | null = null,
): Promise<"DELETED" | "ANONYMIZED"> {
  await client.query("DELETE FROM browser_session WHERE identity_id=$1", [id]);
  await client.query("DELETE FROM answer WHERE owner_id=$1", [id]);
  await client.query("DELETE FROM role_invitation WHERE claimed_by=$1 OR email=$2", [id, email]);
  await client.query(
    "UPDATE activity_log SET subject='conta-excluida', detail=NULL WHERE subject=$2 OR actor_id=$1",
    [id, email],
  );
  await client.query("UPDATE role_event SET email='conta-excluida@anon.invalid' WHERE email=$1", [email]);

  let mode: "DELETED" | "ANONYMIZED" = "DELETED";
  await client.query("SAVEPOINT hard_delete_account");
  try {
    await client.query("DELETE FROM curator_role WHERE identity_id=$1", [id]);
    await client.query("DELETE FROM account WHERE identity_id=$1", [id]);
    await client.query("DELETE FROM study_identity WHERE id=$1", [id]);
    await client.query("RELEASE SAVEPOINT hard_delete_account");
  } catch (error: any) {
    if (error?.code !== "23503") throw error;
    await client.query("ROLLBACK TO SAVEPOINT hard_delete_account");
    mode = "ANONYMIZED";
    await client.query("DELETE FROM practice_attempt WHERE owner_id=$1", [id]);
    await client.query("DELETE FROM answer_event WHERE owner_id=$1", [id]);
    await client.query("DELETE FROM discursive_response WHERE owner_id=$1", [id]);
    await client.query("DELETE FROM study_goal WHERE identity_id=$1", [id]);
    await client.query("DELETE FROM achievement_unlock WHERE identity_id=$1", [id]);
    await client.query("DELETE FROM flashcard_state WHERE identity_id=$1", [id]);
    await client.query("DELETE FROM flashcard_review WHERE identity_id=$1", [id]);
    await client.query("DELETE FROM answer_reflection WHERE owner_id=$1", [id]);
    await client.query("DELETE FROM account_role WHERE identity_id=$1", [id]);
    await client.query("DELETE FROM curator_role WHERE identity_id=$1", [id]);
    const anonEmail = `excluida-${id.slice(0, 8)}-${randomBytes(3).toString("hex")}@anon.invalid`;
    await client.query(
      `UPDATE account
       SET email=$2,password_hash=$3,display_name=NULL,enrollment=NULL,ranking_visible=false,mascot_enabled=false
       WHERE identity_id=$1`,
      [id, anonEmail, disabledPasswordHash],
    );
  }

  await recordActivity(client, {
    category: "ACCOUNT",
    action: "ACCOUNT_DELETED",
    actorId,
    subject: "conta-excluida",
    detail: withReason(
      mode === "DELETED"
        ? "Conta e histórico de estudo removidos"
        : "Dados pessoais e de estudo removidos; autoria institucional anonimizada",
      reason,
    ),
  });
  return mode;
}

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") fail("Esse e-mail ou prontuário já está ligado a outra conta.", 409);
    throw error;
  } finally {
    client.release();
  }
}

@Controller("api/admin/accounts")
export class AdminAccountsController {
  private throttle = new AuthThrottle();

  @Put(":id")
  async updateProfile(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Param("id") rawId: string,
    @Body() body: any,
  ) {
    const admin = await requireRole(req, "ADMIN");
    const id = parseAccountId(rawId);
    const { name, enrollment } = profile({
      name: body?.name ?? "",
      enrollment: body?.enrollment ?? "",
    });
    const requestedEmail = body?.email === undefined ? null : emailAddress(body.email);
    const reason = parseReason(body?.reason);

    // Se o cliente informou um e-mail diferente do atual, exigimos a senha do admin antes de abrir escrita.
    const existingEmail = (
      await db.query<{ email: string }>("SELECT email FROM account WHERE identity_id=$1", [id])
    ).rows[0]?.email;
    if (!existingEmail) fail("Conta não encontrada.", 404);
    if (requestedEmail && requestedEmail !== existingEmail) {
      await verifyAdminPassword(req, res, admin.id, admin.email!, body?.adminPassword, this.throttle);
    }

    return inTransaction(async (client) => {
      const actor = await requireLockedAdmin(req, client);
      const target = await lockTargetAccount(client, id);
      if (target.roles.includes("ADMIN") && target.id !== actor.id) {
        fail("Outras contas da administração só podem ser alteradas pela própria pessoa ou pelo servidor.", 409);
      }
      const nextEmail = requestedEmail ?? target.email;
      // Caso o e-mail tenha mudado em outra requisição entre a pré-checagem e o lock, recusa sem gravar.
      if (target.email !== existingEmail) {
        fail("A conta mudou em outra aba. Reabra os dados antes de salvar.", 409);
      }
      if (
        enrollment &&
        (await client.query("SELECT 1 FROM account WHERE enrollment=$1 AND identity_id<>$2", [enrollment, id])).rowCount
      ) {
        fail("Esse prontuário já está ligado a outra conta.", 409);
      }
      if (
        nextEmail !== target.email &&
        (await client.query("SELECT 1 FROM account WHERE email=$1 AND identity_id<>$2", [nextEmail, id])).rowCount
      ) {
        fail("Esse e-mail já é de outra conta.", 409);
      }

      await client.query(
        "UPDATE account SET display_name=$2,enrollment=$3,email=$4 WHERE identity_id=$1",
        [id, name, enrollment, nextEmail],
      );
      if (nextEmail !== target.email) {
        await client.query("DELETE FROM role_invitation WHERE claimed_by=$1", [id]);
        await applyInvitations(client, id, nextEmail);
        await recordActivity(client, {
          category: "ACCOUNT",
          action: "ADMIN_EMAIL_CHANGED",
          actorId: actor.id,
          subject: nextEmail,
          detail: withReason(`Antes: ${target.email}`, reason),
        });
      } else {
        await recordActivity(client, {
          category: "ACCOUNT",
          action: "ADMIN_PROFILE_UPDATED",
          actorId: actor.id,
          subject: nextEmail,
          detail: withReason(enrollment ? `Prontuário: ${enrollment}` : "Sem prontuário", reason),
        });
      }
      return { id, email: nextEmail, name, enrollment };
    });
  }

  @Post(":id/reset-password")
  @HttpCode(200)
  async resetPassword(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Param("id") rawId: string,
    @Body() body: any,
  ) {
    const admin = await requireRole(req, "ADMIN");
    const id = parseAccountId(rawId);
    const reason = parseReason(body?.reason);
    const { password } = credentials({ email: admin.email, password: body?.newPassword });
    await verifyAdminPassword(req, res, admin.id, admin.email!, body?.adminPassword, this.throttle);
    const encoded = await hashPassword(password);

    return inTransaction(async (client) => {
      const actor = await requireLockedAdmin(req, client);
      const target = await lockTargetAccount(client, id);
      if (target.roles.includes("ADMIN")) {
        fail("Senhas da administração são trocadas em Meu perfil ou pelo comando no servidor.", 409);
      }
      await client.query("UPDATE account SET password_hash=$2 WHERE identity_id=$1", [id, encoded]);
      const revoked =
        (await client.query("DELETE FROM browser_session WHERE identity_id=$1", [id])).rowCount ?? 0;
      await recordActivity(client, {
        category: "ACCOUNT",
        action: "ADMIN_PASSWORD_RESET",
        actorId: actor.id,
        subject: target.email,
        detail: withReason(
          revoked ? `${revoked} sessão(ões) encerrada(s)` : "Nenhuma sessão ativa",
          reason,
        ),
      });
      return { status: "PASSWORD_RESET" as const, revokedSessions: revoked };
    });
  }

  @Post(":id/revoke-sessions")
  @HttpCode(200)
  async revokeSessions(@Req() req: any, @Param("id") rawId: string, @Body() body: any) {
    await requireRole(req, "ADMIN");
    const id = parseAccountId(rawId);
    const reason = parseReason(body?.reason);

    return inTransaction(async (client) => {
      const actor = await requireLockedAdmin(req, client);
      const target = await lockTargetAccount(client, id);
      if (target.roles.includes("ADMIN") && target.id !== actor.id) {
        fail("Sessões de outra pessoa da administração só são encerradas pela própria conta ou no servidor.", 409);
      }
      const revoked =
        target.id === actor.id
          ? (
              await client.query(
                "DELETE FROM browser_session WHERE identity_id=$1 AND token_hash<>$2",
                [id, sessionHash(req)],
              )
            ).rowCount ?? 0
          : (await client.query("DELETE FROM browser_session WHERE identity_id=$1", [id])).rowCount ?? 0;
      await recordActivity(client, {
        category: "ACCOUNT",
        action: "SESSIONS_REVOKED",
        actorId: actor.id,
        subject: target.email,
        detail: withReason(`${revoked} sessão(ões) encerrada(s)`, reason),
      });
      return { status: "REVOKED" as const, revokedSessions: revoked };
    });
  }

  @Post(":id/delete")
  @HttpCode(200)
  async deleteAccount(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Param("id") rawId: string,
    @Body() body: any,
  ) {
    const admin = await requireRole(req, "ADMIN");
    const id = parseAccountId(rawId);
    const reason = parseReason(body?.reason);
    await verifyAdminPassword(req, res, admin.id, admin.email!, body?.adminPassword, this.throttle);
    const disabledHash = await hashPassword(randomBytes(32).toString("hex"));

    return inTransaction(async (client) => {
      const actor = await requireLockedAdmin(req, client);
      const target = await lockTargetAccount(client, id);
      if (target.roles.includes("ADMIN") || target.email.endsWith("@anon.invalid")) {
        fail("Contas da administração só podem ser excluídas pelo comando no servidor.", 409);
      }
      const status = await eraseAccountData(client, id, target.email, disabledHash, actor.id, reason);
      return { status };
    });
  }
}
