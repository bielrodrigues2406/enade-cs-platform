import { Body, Controller, Get, HttpCode, Post, Put, Req } from "@nestjs/common";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";
import { evaluateAchievements, type AchievementView } from "./achievements.js";

// Engajamento (ENG-1): meta diária de questões, sequência de dias, conquistas
// e ranking de constância. Os dias seguem o horário de Brasília. Conta cada
// questão uma vez por dia, no estudo livre ou em treino/prova.

export const TIME_ZONE = "America/Sao_Paulo";
export const DEFAULT_GOAL = 5;

/** Questões distintas respondidas por dia (data local), dos últimos 400 dias. */
export async function dailyCounts(owner: string): Promise<Map<string, number>> {
  const rows = (await db.query<{ day: string; n: number }>(
    `WITH events AS (
       SELECT (answered_at AT TIME ZONE '${TIME_ZONE}')::date AS day,v.question_id AS q
       FROM answer_event e JOIN question_version v ON v.id=e.version_id
       WHERE e.owner_id=$1 AND e.origin='STUDY'
       UNION
       SELECT (i.updated_at AT TIME ZONE '${TIME_ZONE}')::date,i.question_id
       FROM practice_item i JOIN practice_attempt p ON p.id=i.attempt_id
       WHERE p.owner_id=$1 AND i.option_id IS NOT NULL)
     SELECT to_char(day,'YYYY-MM-DD') AS day,count(DISTINCT q)::int AS n FROM events
     WHERE day >= (now() AT TIME ZONE '${TIME_ZONE}')::date - 400 GROUP BY day`, [owner],
  )).rows;
  return new Map(rows.map((row) => [row.day, row.n]));
}

/** Data local "AAAA-MM-DD" de hoje, e aritmética simples de dias. */
export function localToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}
export function addDays(day: string, delta: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
/** Segunda-feira da semana do dia (a folga vale uma por semana). */
function weekOf(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  return addDays(day, -((date.getUTCDay() + 6) % 7));
}

/**
 * Sequência de dias com a meta batida, terminando hoje (ou ontem, se hoje
 * ainda não bateu). Um dia sem meta por semana é perdoado: não conta, mas
 * não quebra. Devolve também os dias perdoados, para a tela mostrar.
 */
export function currentStreak(counts: Map<string, number>, goal: number, today: string) {
  const met = (day: string) => (counts.get(day) ?? 0) >= goal;
  let day = met(today) ? today : addDays(today, -1);
  let streak = 0;
  const forgiven: string[] = [];
  for (let i = 0; i < 400; i++, day = addDays(day, -1)) {
    if (met(day)) { streak++; continue; }
    const week = weekOf(day);
    const usedThisWeek = forgiven.some((d) => weekOf(d) === week);
    // Só perdoa entre dias batidos: o dia anterior precisa ter meta.
    if (streak > 0 && !usedThisWeek && met(addDays(day, -1))) { forgiven.push(day); continue; }
    break;
  }
  return { streak, forgiven };
}

/** Maior sequência já feita (mesma regra da folga), para a conquista e o perfil. */
export function bestStreak(counts: Map<string, number>, goal: number, today: string) {
  let best = 0;
  for (const day of counts.keys())
    if ((counts.get(day) ?? 0) >= goal && day <= today)
      best = Math.max(best, currentStreak(counts, goal, day).streak);
  return best;
}

export async function goalOf(owner: string) {
  return (await db.query<{ daily_target: number }>(
    "SELECT daily_target FROM study_goal WHERE identity_id=$1", [owner],
  )).rows[0]?.daily_target ?? DEFAULT_GOAL;
}

export type Engagement = {
  goal: number; today: number; streak: number; best: number;
  /** Últimos 28 dias, do mais antigo a hoje: questões, meta batida e folga. */
  days: { day: string; count: number; met: boolean; forgiven: boolean }[];
  achievements: AchievementView[];
};

export async function engagement(owner: string): Promise<Engagement> {
  const [counts, goal] = await Promise.all([dailyCounts(owner), goalOf(owner)]);
  const today = localToday();
  const { streak, forgiven } = currentStreak(counts, goal, today);
  const best = Math.max(streak, bestStreak(counts, goal, today));
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27)).map((day) => {
    const count = counts.get(day) ?? 0;
    return { day, count, met: count >= goal, forgiven: forgiven.includes(day) };
  });
  const achievements = await evaluateAchievements(owner, { best, metGoal: [...counts.values()].some((n) => n >= goal) });
  return { goal, today: counts.get(today) ?? 0, streak, best, days, achievements };
}

/** Nome do ranking: primeiro nome e inicial do último ("Maria S."). */
export function rankingName(name: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Estudante";
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)!.charAt(0).toUpperCase()}.` : parts[0];
}

@Controller("api")
export class EngagementController {
  @Get("me/engagement") async get(@Req() req: any) {
    const user = await requireIdentity(req);
    return engagement(user.id);
  }

  @Put("me/goal") async setGoal(@Req() req: any, @Body() body: any) {
    const user = await requireIdentity(req);
    const target = Number(body?.dailyTarget);
    if (!Number.isInteger(target) || target < 1 || target > 50) fail("Escolha uma meta de 1 a 50 questões por dia.", 400);
    await db.query(
      `INSERT INTO study_goal(identity_id,daily_target) VALUES($1,$2)
       ON CONFLICT(identity_id) DO UPDATE SET daily_target=$2,updated_at=clock_timestamp()`, [user.id, target],
    );
    return engagement(user.id);
  }

  /** O aviso animado já apareceu: não repete. */
  @Post("me/achievements/seen") @HttpCode(200) async seen(@Req() req: any) {
    const user = await requireIdentity(req);
    await db.query("UPDATE achievement_unlock SET seen_at=clock_timestamp() WHERE identity_id=$1 AND seen_at IS NULL", [user.id]);
    return { status: "SEEN" };
  }

  /**
   * Ranking de constância: dias com estudo (questão ou flashcard) nos últimos
   * 7 e 30 dias. Só contas que não saíram do ranking; nunca mostra acerto.
   */
  @Get("ranking") async ranking(@Req() req: any) {
    const user = await requireIdentity(req);
    const rows = (await db.query<{ id: string; name: string | null; days7: number; days30: number; visible: boolean }>(
      `WITH activity AS (
         SELECT e.owner_id AS id,(e.answered_at AT TIME ZONE '${TIME_ZONE}')::date AS day FROM answer_event e
         WHERE e.origin='STUDY' AND e.answered_at > now() - interval '31 days'
         UNION SELECT p.owner_id,(i.updated_at AT TIME ZONE '${TIME_ZONE}')::date FROM practice_item i
         JOIN practice_attempt p ON p.id=i.attempt_id WHERE i.option_id IS NOT NULL AND i.updated_at > now() - interval '31 days'
         UNION SELECT r.identity_id,(r.reviewed_at AT TIME ZONE '${TIME_ZONE}')::date FROM flashcard_review r
         WHERE r.reviewed_at > now() - interval '31 days'),
       today AS (SELECT (now() AT TIME ZONE '${TIME_ZONE}')::date AS d)
       SELECT a.identity_id AS id,a.display_name AS name,a.ranking_visible AS visible,
         count(DISTINCT x.day) FILTER (WHERE x.day > (SELECT d FROM today) - 7)::int AS days7,
         count(DISTINCT x.day) FILTER (WHERE x.day > (SELECT d FROM today) - 30)::int AS days30
       FROM account a JOIN activity x ON x.id=a.identity_id
       GROUP BY a.identity_id
       ORDER BY days7 DESC,days30 DESC,a.display_name`,
    )).rows;
    const listed = rows.filter((row) => row.visible);
    const position = (row: (typeof rows)[number]) => listed.indexOf(row) + 1;
    const me = rows.find((row) => row.id === user.id);
    const visible = user.email ? (await db.query<{ ranking_visible: boolean }>(
      "SELECT ranking_visible FROM account WHERE identity_id=$1", [user.id])).rows[0]?.ranking_visible ?? true : false;
    return {
      top: listed.slice(0, 20).map((row) => ({
        position: position(row), name: rankingName(row.name), days7: row.days7, days30: row.days30, me: row.id === user.id,
      })),
      me: me ? { position: me.visible ? position(me) : null, days7: me.days7, days30: me.days30 } : null,
      visible, canJoin: Boolean(user.email),
    };
  }

  @Put("me/ranking") async setRanking(@Req() req: any, @Body() body: any) {
    const user = await requireIdentity(req);
    if (!user.email) fail("Crie uma conta para aparecer no ranking.", 403);
    if (typeof body?.visible !== "boolean") fail("Informe se quer aparecer no ranking.", 400);
    await db.query("UPDATE account SET ranking_visible=$2 WHERE identity_id=$1", [user.id, body.visible]);
    return { visible: body.visible };
  }
}
