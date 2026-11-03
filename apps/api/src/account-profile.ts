import { Body, Controller, Get, HttpCode, Post, Put, Req, Res } from "@nestjs/common";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity, sessionHash } from "./session.js";
import { hashPassword, verifyPassword } from "./password.js";
import { AuthThrottle, credentials, emailAddress, profile } from "./auth.js";
import { logActivity, recordActivity, requestIp } from "./activity.js";

// Meu perfil: a própria pessoa vê e altera nome, prontuário e e-mail e troca a
// senha. E-mail e senha exigem a senha atual; trocar a senha encerra as outras
// sessões da conta.

async function requireAccount(req: any) {
  const user = await requireIdentity(req);
  if (!user.email) fail("Entre na sua conta para ver o perfil.", 401);
  return user;
}

async function checkPassword(req: any, identityId: string, password: unknown) {
  const stored = (await db.query("SELECT password_hash FROM account WHERE identity_id=$1", [identityId])).rows[0]?.password_hash;
  if (typeof password !== "string" || !(await verifyPassword(password, stored))) {
    logActivity({ category: "SECURITY", action: "WRONG_PASSWORD", actorId: identityId, detail: "Senha atual errada no perfil", ip: requestIp(req) });
    fail("Senha atual incorreta.", 403);
  }
}

@Controller("api/me")
export class AccountProfileController {
  private throttle = new AuthThrottle();

  @Get("profile") async get(@Req() req: any) {
    const user = await requireAccount(req);
    return (await db.query(
      `SELECT email,display_name AS name,enrollment,created_at AS "createdAt" FROM account WHERE identity_id=$1`, [user.id],
    )).rows[0];
  }

  // Definir prontuário pela primeira vez é livre; alterar um prontuário já salvo
  // ou trocar o e-mail exige a senha atual (evita varredura de prontuários alheios).
  @Put("profile") async update(@Req() req: any, @Res({ passthrough: true }) res: any, @Body() body: any) {
    const user = await requireAccount(req);
    const current = (
      await db.query<{ email: string; enrollment: string | null }>(
        "SELECT email,enrollment FROM account WHERE identity_id=$1",
        [user.id],
      )
    ).rows[0];
    if (!current) fail("Conta não encontrada.", 404);
    const parsed = profile({
      name: body?.name ?? "",
      enrollment: body?.enrollment === undefined ? (current.enrollment ?? "") : body.enrollment,
    });
    const name = parsed.name;
    const enrollment = body?.enrollment === undefined ? current.enrollment : parsed.enrollment;
    const email = body?.email === undefined ? current.email : emailAddress(body.email);
    const changingEmail = email !== current.email;
    const changingExistingEnrollment = Boolean(current.enrollment) && enrollment !== current.enrollment;

    if (changingEmail || changingExistingEnrollment) {
      this.throttle.check(req, res, current.email);
      await checkPassword(req, user.id, body?.currentPassword);
      this.throttle.refund(req, current.email);
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      if (enrollment && (await client.query("SELECT 1 FROM account WHERE enrollment=$1 AND identity_id<>$2", [enrollment, user.id])).rowCount)
        fail("Esse prontuário já está ligado a outra conta.", 409);
      if (changingEmail && (await client.query("SELECT 1 FROM account WHERE email=$1 AND identity_id<>$2", [email, user.id])).rowCount)
        fail("Esse e-mail já é de outra conta.", 409);
      await client.query("UPDATE account SET display_name=$2,enrollment=$3,email=$4 WHERE identity_id=$1", [user.id, name, enrollment, email]);
      await recordActivity(client, changingEmail
        ? { category: "ACCOUNT", action: "EMAIL_CHANGED", actorId: user.id, subject: email, detail: `Antes: ${current.email}` }
        : {
            category: "ACCOUNT",
            action: "PROFILE_UPDATED",
            actorId: user.id,
            subject: email,
            detail: changingExistingEnrollment ? `Prontuário: ${current.enrollment} -> ${enrollment ?? "removido"}` : null,
          });
      await client.query("COMMIT");
      return { email, name, enrollment };
    } catch (error: any) {
      await client.query("ROLLBACK");
      if (error?.code === "23505") fail("Esse e-mail ou prontuário já está ligado a outra conta.", 409);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post("password") @HttpCode(200) async password(@Req() req: any, @Res({ passthrough: true }) res: any, @Body() body: any) {
    const user = await requireAccount(req);
    this.throttle.check(req, res, user.email!);
    await checkPassword(req, user.id, body?.currentPassword);
    this.throttle.refund(req, user.email!);
    const { password } = credentials({ email: user.email, password: body?.newPassword });
    const encoded = await hashPassword(password);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE account SET password_hash=$2 WHERE identity_id=$1", [user.id, encoded]);
      // As outras sessões (outros aparelhos) saem; esta continua.
      await client.query("DELETE FROM browser_session WHERE identity_id=$1 AND token_hash<>$2", [user.id, sessionHash(req)]);
      await recordActivity(client, { category: "ACCOUNT", action: "PASSWORD_CHANGED", actorId: user.id, subject: user.email });
      await client.query("COMMIT");
      return { status: "CHANGED" };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
