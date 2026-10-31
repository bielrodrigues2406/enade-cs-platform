import { Controller, Get, Query, Req } from "@nestjs/common";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireRole } from "./roles.js";

// Registro de atividades (ACT-1): o que aconteceu, quem fez e, em acessos e
// segurança, de qual IP. Serve à administração para acompanhar o uso e
// investigar abusos (força bruta, excesso de requisições).

export const ACTIVITY_CATEGORIES = ["ACCESS", "SECURITY", "ACCOUNT", "ROLE", "CONTENT", "CLASS"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];
export type Activity = {
  category: ActivityCategory;
  action: string;
  actorId?: string | null;
  /** O alvo: e-mail, título da questão, nome da turma. */
  subject?: string | null;
  detail?: string | null;
  /** Só para ACCESS e SECURITY. */
  ip?: string | null;
};
/** Entradas mais antigas que isso são apagadas. */
export const ACTIVITY_RETENTION_DAYS = 180;
const PAGE_SIZE = 50;

type Queryable = Pick<PoolClient, "query">;

/** Grava dentro da transação de quem chama: o registro some se a operação desfizer. */
export async function recordActivity(client: Queryable, activity: Activity) {
  const keepIp = activity.category === "ACCESS" || activity.category === "SECURITY";
  await client.query(
    "INSERT INTO activity_log(category,action,actor_id,subject,detail,ip) VALUES($1,$2,$3,$4,$5,$6)",
    [activity.category, activity.action, activity.actorId ?? null, clip(activity.subject, 300),
      clip(activity.detail, 500), keepIp ? clip(activity.ip, 64) : null],
  );
}

/**
 * Grava fora de transação, sem esperar: usado quando a operação vai falhar em
 * seguida (senha errada, bloqueio). Uma falha do registro não muda a resposta.
 */
export function logActivity(activity: Activity) {
  void recordActivity(db, activity).catch(() => undefined);
}

export function requestIp(req: any): string | null {
  return req?.ip || req?.socket?.remoteAddress || null;
}

export async function purgeOldActivity() {
  await db.query("DELETE FROM activity_log WHERE at < now() - make_interval(days => $1)", [ACTIVITY_RETENTION_DAYS]);
}

function clip(value: string | null | undefined, max: number) {
  return value ? value.slice(0, max) : null;
}

@Controller("api/admin/activity")
export class ActivityController {
  @Get() async list(@Req() req: any, @Query("category") category = "", @Query("q") q = "", @Query("page") page = "1") {
    await requireRole(req, "ADMIN");
    if (category && !(ACTIVITY_CATEGORIES as readonly string[]).includes(category)) fail("Categoria inválida.", 400);
    if (typeof q !== "string" || q.length > 120) fail("Busca muito longa.", 400);
    const pageNumber = /^[1-9][0-9]{0,4}$/.test(page) ? Number(page) : 1;
    const filters = `($1='' OR l.category=$1) AND ($2='' OR strpos(lower(COALESCE(a.email,'')||' '||COALESCE(l.subject,'')||' '||COALESCE(l.ip,'')),lower($2))>0)`;
    const [items, total, summary] = await Promise.all([
      db.query(
        `SELECT l.id,l.at,l.category,l.action,a.email AS "actorEmail",a.display_name AS "actorName",l.subject,l.detail,l.ip
         FROM activity_log l LEFT JOIN account a ON a.identity_id=l.actor_id
         WHERE ${filters} ORDER BY l.at DESC,l.id DESC LIMIT $3 OFFSET $4`,
        [category, q.trim(), PAGE_SIZE, (pageNumber - 1) * PAGE_SIZE],
      ),
      db.query(`SELECT count(*)::int AS n FROM activity_log l LEFT JOIN account a ON a.identity_id=l.actor_id WHERE ${filters}`,
        [category, q.trim()]),
      // Resumo das últimas 24 horas, para ver de relance se há ataque.
      db.query(
        `SELECT count(*) FILTER (WHERE action='LOGIN')::int AS logins,
           count(*) FILTER (WHERE action='LOGIN_FAILED')::int AS "failedLogins",
           count(*) FILTER (WHERE category='SECURITY')::int AS blocked,
           count(DISTINCT ip) FILTER (WHERE action='LOGIN_FAILED' OR category='SECURITY')::int AS "suspiciousIps"
         FROM activity_log WHERE at > now() - interval '24 hours'`,
      ),
    ]);
    return {
      total: total.rows[0].n, page: pageNumber, pageSize: PAGE_SIZE, retentionDays: ACTIVITY_RETENTION_DAYS,
      summary: summary.rows[0], items: items.rows,
    };
  }
}
