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
import { applyInvitations, grantConfiguredAdmin } from "./roles.js";
import { logActivity, recordActivity, requestIp } from "./activity.js";
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
export class AuthThrottle {
  private windows = new Map<string, { count: number; end: number; logged?: boolean }>();
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
        // Um registro por janela bloqueada, para o ataque não inundar o log.
        if (!current.logged) {
          current.logged = true;
          logActivity({ category: "SECURITY", action: "LOGIN_BLOCKED", subject: key.startsWith("email:") ? email : null,
            detail: key.startsWith("email:") ? `${max} tentativas para o e-mail em 15 min` : `${max} tentativas do IP em 15 min`, ip: requestIp(req) });
        }
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
// Sessões de visitante: limite por IP contra encher o banco com identidades
// vazias (auditoria de 31/10, C3). Generoso porque um laboratório do câmpus
// inteiro sai por um IP só; um navegador reaproveita a própria sessão.
const GUEST_SESSIONS_PER_IP = 600;
const GUEST_WINDOW_MS = 15 * 60000;
class GuestThrottle {
  private windows = new Map<string, { count: number; end: number; logged?: boolean }>();
  check(req: any, res: any) {
    const now = Date.now();
    for (const [key, value] of this.windows) if (value.end <= now) this.windows.delete(key);
    const key = digest(req.ip || req.socket.remoteAddress || "unknown");
    const current = this.windows.get(key) ?? { count: 0, end: now + GUEST_WINDOW_MS };
    if (current.count >= GUEST_SESSIONS_PER_IP) {
      if (!current.logged) {
        current.logged = true;
        logActivity({ category: "SECURITY", action: "GUEST_LIMITED", detail: `${GUEST_SESSIONS_PER_IP} sessões novas do IP em 15 min`, ip: requestIp(req) });
      }
      res.setHeader("Retry-After", Math.ceil((current.end - now) / 1000));
      fail("Muitas sessões novas a partir desta rede. Aguarde alguns minutos.", 429);
    }
    if (!this.windows.has(key) && this.windows.size >= 10000) fail("O acesso está ocupado. Tente novamente em instantes.", 503);
    current.count++;
    this.windows.set(key, current);
  }
}
/** E-mail normalizado (minúsculas, sem espaços) ou erro 400. */
export function emailAddress(input: unknown) {
  const email = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
      email,
    )
  )
    fail("Informe um e-mail válido.", 400);
  return email;
}
export function credentials(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail("Informe e-mail e senha.", 400);
  const { email: input, password } = body as Record<string, unknown>;
  const email = emailAddress(input);
  if (
    typeof password !== "string" ||
    [...password].length < 12 ||
    [...password].length > 128
  )
    fail("A senha deve ter de 12 a 128 caracteres.", 400);
  return { email, password: password as string };
}
// Nome e prontuário são opcionais no cadastro; ligam a conta à turma (D13).
export function profile(body: unknown) {
  const { name, enrollment } = (body ?? {}) as Record<string, unknown>;
  const cleanName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  const cleanEnrollment = typeof enrollment === "string" ? enrollment.trim().toUpperCase() : "";
  if (name !== undefined && (typeof name !== "string" || (cleanName && (cleanName.length < 2 || cleanName.length > 120))))
    fail("Informe o nome com 2 a 120 caracteres.", 400);
  if (enrollment !== undefined && (typeof enrollment !== "string" || (cleanEnrollment && !/^[A-Z]{2}[0-9]{6,8}X?$/.test(cleanEnrollment))))
    fail("Prontuário inválido. Use o formato do IFSP, por exemplo PE3012345.", 400);
  return { name: cleanName || null, enrollment: cleanEnrollment || null };
}
@Controller("api")
export class AuthController {
  private throttle = new AuthThrottle();
  private guests = new GuestThrottle();

  @Post("session") async session(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const existing = await identity(req);
    if (existing) return sessionView(existing);
    this.guests.check(req, res);
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
    const { name, enrollment } = profile(body);
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
      if (enrollment && (await client.query("SELECT 1 FROM account WHERE enrollment=$1", [enrollment])).rowCount)
        fail("Esse prontuário já está ligado a outra conta.", 409);
      const created = await client.query(
        "INSERT INTO account(identity_id,email,password_hash,display_name,enrollment) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING identity_id",
        [guest.id, email, encoded, name, enrollment],
      );
      if (!created.rowCount)
        fail(
          "Não foi possível cadastrar esse e-mail. Se você já tem conta, entre com sua senha.",
          409,
        );
      await applyInvitations(client, guest.id, email);
      await recordActivity(client, { category: "ACCESS", action: "REGISTER", actorId: guest.id, subject: email, ip: requestIp(req) });
      await grantConfiguredAdmin(client, email);
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
    if (!(await verifyPassword(password, account?.password_hash)) || !account) {
      logActivity({ category: "ACCESS", action: "LOGIN_FAILED", actorId: account?.identity_id, subject: email, ip: requestIp(req) });
      fail("E-mail ou senha incorretos.", 401);
    }
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const guest = await requireIdentity(req, client, true);
      if (guest.email) fail("Você já está em uma conta.", 409);
      await client.query("DELETE FROM browser_session WHERE token_hash=$1", [
        guest.tokenHash,
      ]);
      const token = await issueSession(client, account.identity_id);
      await recordActivity(client, { category: "ACCESS", action: "LOGIN", actorId: account.identity_id, subject: email, ip: requestIp(req) });
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
