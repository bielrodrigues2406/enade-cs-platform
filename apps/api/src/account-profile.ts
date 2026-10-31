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

  // Nome e prontuário livres; e-mail novo pede a senha atual.
  @Put("profile") async update(@Req() req: any, @Res({ passthrough: true }) res: any, @Body() body: any) {
    const user = await requireAccount(req);
    const { name, enrollment } = profile({ name: body?.name ?? "", enrollment: body?.enrollment ?? "" });
    const email = body?.email === undefined ? user.email! : emailAddress(body.email);
    if (email !== user.email) {
      this.throttle.check(req, res, user.email!);
      await checkPassword(req, user.id, body?.currentPassword);
    }
    if (enrollment && (await db.query("SELECT 1 FROM account WHERE enrollment=$1 AND identity_id<>$2", [enrollment, user.id])).rowCount)
      fail("Esse prontuário já está ligado a outra conta.", 409);
    if (email !== user.email && (await db.query("SELECT 1 FROM account WHERE email=$1", [email])).rowCount)
      fail("Esse e-mail já é de outra conta.", 409);
    await db.query("UPDATE account SET display_name=$2,enrollment=$3,email=$4 WHERE identity_id=$1", [user.id, name, enrollment, email]);
    await recordActivity(db, email === user.email
      ? { category: "ACCOUNT", action: "PROFILE_UPDATED", actorId: user.id, subject: email }
      : { category: "ACCOUNT", action: "EMAIL_CHANGED", actorId: user.id, subject: email, detail: `Antes: ${user.email}` });
    return { email, name, enrollment };
  }

  @Post("password") @HttpCode(200) async password(@Req() req: any, @Res({ passthrough: true }) res: any, @Body() body: any) {
    const user = await requireAccount(req);
    this.throttle.check(req, res, user.email!);
    await checkPassword(req, user.id, body?.currentPassword);
    const { password } = credentials({ email: user.email, password: body?.newPassword });
    await db.query("UPDATE account SET password_hash=$2 WHERE identity_id=$1", [user.id, await hashPassword(password)]);
    // As outras sessões (outros aparelhos) saem; esta continua.
    await db.query("DELETE FROM browser_session WHERE identity_id=$1 AND token_hash<>$2", [user.id, sessionHash(req)]);
    await recordActivity(db, { category: "ACCOUNT", action: "PASSWORD_CHANGED", actorId: user.id, subject: user.email });
    return { status: "CHANGED" };
  }
}
