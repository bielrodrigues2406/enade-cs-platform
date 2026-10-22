import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  createGuest,
  digest,
  identity,
  issueSession,
  requireIdentity,
  sessionHash,
  sessionView,
  setSessionCookie,
} from "./session.js";

// Single-process development protection. Do not trust client-supplied forwarding
// headers; deployments behind a proxy need an explicitly configured shared limiter.
class AuthThrottle {
  private windows = new Map<string, { count: number; end: number }>();
  check(req: any, res: any, email: string) {
    const now = Date.now();
    for (const [key, value] of this.windows)
      if (value.end <= now) this.windows.delete(key);
    const keys = [
      [`ip:${digest(req.ip || req.socket.remoteAddress || "unknown")}`, 50],
      [`email:${digest(email)}`, 10],
    ] as const;
    for (const [key, max] of keys) {
      const current = this.windows.get(key);
      if (current && current.count >= max) {
        res.setHeader("Retry-After", Math.ceil((current.end - now) / 1000));
        fail(
          "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.",
          429,
        );
      }
    }
    if (
      this.windows.size +
        keys.filter(([key]) => !this.windows.has(key)).length >
      10000
    )
      fail("O acesso está ocupado. Tente novamente em instantes.", 503);
    for (const [key] of keys) {
      const current = this.windows.get(key) ?? {
        count: 0,
        end: now + 15 * 60000,
      };
      current.count++;
      this.windows.set(key, current);
    }
  }
}
function credentials(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail("Informe e-mail e senha.", 400);
  const { email: input, password } = body as Record<string, unknown>;
  const email = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
      email,
    )
  )
    fail("Informe um e-mail válido.", 400);
  if (
    typeof password !== "string" ||
    [...password].length < 12 ||
    [...password].length > 128
  )
    fail("A senha deve ter de 12 a 128 caracteres.", 400);
  return { email, password: password as string };
}
@Controller("api")
export class AuthController {
  private throttle = new AuthThrottle();

  @Post("session") async session(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const existing = await identity(req);
    if (existing) return sessionView(existing);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const token = await createGuest(client);
      await client.query("COMMIT");
      setSessionCookie(res, token);
      return { mode: "guest" };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  @Get("auth/me") async me(@Req() req: any) {
    return sessionView(await requireIdentity(req));
  }

  @Post("auth/register") async register(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Body() body: unknown,
  ) {
    const { email, password } = credentials(body);
    this.throttle.check(req, res, email);
    const current = await requireIdentity(req);
    if (current.email)
      fail("Você já está em uma conta. Saia antes de criar outra.", 409);
    const encoded = await hashPassword(password);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const guest = await requireIdentity(req, client, true);
      if (guest.email) fail("Você já está em uma conta.", 409);
      await client.query(
        "SELECT id FROM study_identity WHERE id=$1 FOR UPDATE",
        [guest.id],
      );
      const created = await client.query(
        "INSERT INTO account(identity_id,email,password_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING identity_id",
        [guest.id, email, encoded],
      );
      if (!created.rowCount)
        fail(
          "Não foi possível cadastrar esse e-mail. Se você já tem conta, entre com sua senha.",
          409,
        );
      // Rotate all guest credentials. A leaked anonymous token must not gain account access.
      await client.query("DELETE FROM browser_session WHERE identity_id=$1", [
        guest.id,
      ]);
      const token = await issueSession(client, guest.id);
      await client.query("COMMIT");
      setSessionCookie(res, token);
      return { mode: "account", email };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  @Post("auth/login") @HttpCode(200) async login(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Body() body: unknown,
  ) {
    const { email, password } = credentials(body);
    this.throttle.check(req, res, email);
    const current = await requireIdentity(req);
    if (current.email)
      fail("Você já está em uma conta. Saia antes de entrar em outra.", 409);
    const account = (
      await db.query<{ identity_id: string; password_hash: string }>(
        "SELECT identity_id,password_hash FROM account WHERE email=$1",
        [email],
      )
    ).rows[0];
    if (!(await verifyPassword(password, account?.password_hash)) || !account)
      fail("E-mail ou senha incorretos.", 401);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const guest = await requireIdentity(req, client, true);
      if (guest.email) fail("Você já está em uma conta.", 409);
      await client.query("DELETE FROM browser_session WHERE token_hash=$1", [
        guest.tokenHash,
      ]);
      const token = await issueSession(client, account.identity_id);
      await client.query("COMMIT");
      setSessionCookie(res, token);
      return { mode: "account", email };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  @Post("auth/logout") @HttpCode(200) async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      // DELETE locks the current session, serializing with in-flight answer saves.
      const tokenHash = sessionHash(req);
      if (tokenHash)
        await client.query("DELETE FROM browser_session WHERE token_hash=$1", [
          tokenHash,
        ]);
      const token = await createGuest(client);
      await client.query("COMMIT");
      setSessionCookie(res, token);
      return { mode: "guest" };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
