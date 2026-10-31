import { Controller, Get, Req } from "@nestjs/common";
import { db } from "./database.js";
import { requireIdentity } from "./session.js";
import { AREAS } from "./question-areas.js";

// Desempenho da pessoa (o "Meu desempenho" da página inicial). Conta a
// primeira resposta a cada questão — no estudo livre ou em treino/prova
// finalizados — para que refazer até acertar não infle o acerto. Também traz o
// que está pendente: erros prontos para revisar e o treino em andamento.

export type AreaProgress = {
  area: string;
  published: number;
  /** Questões da área já respondidas pela pessoa (estudo, treino ou prova). */
  firstAttempts: number;
  firstCorrect: number;
};

// Primeira resposta por questão editorial, juntando estudo livre e treinos finalizados.
const FIRST_ANSWERS = `
  WITH answers AS (
    SELECT v.question_id,v.topic,e.correct,e.answered_at AS at,e.id AS ord
    FROM answer_event e JOIN question_version v ON v.id=e.version_id WHERE e.owner_id=$1
    UNION ALL
    SELECT v.question_id,v.topic,i.option_id=v.correct_option_id,p.finished_at,0
    FROM practice_item i JOIN practice_attempt p ON p.id=i.attempt_id
    JOIN question_version v ON v.id=i.version_id
    WHERE p.owner_id=$1 AND p.state='COMPLETED' AND i.option_id IS NOT NULL
  )
  SELECT DISTINCT ON (question_id) question_id,topic,correct FROM answers ORDER BY question_id,at,ord`;

const PUBLISHED = `
  SELECT v.question_id,v.topic FROM editorial_question c JOIN question_version v ON v.id=c.current_version_id
  WHERE v.editorial_status='PUBLISHED'`;

export async function areaProgress(owner: string): Promise<AreaProgress[]> {
  return (await db.query<AreaProgress>(
    `WITH first AS (${FIRST_ANSWERS}), published AS (${PUBLISHED})
     SELECT a.name AS area,
       (SELECT count(*)::int FROM published p WHERE p.topic=a.name) AS published,
       (SELECT count(*)::int FROM first f WHERE f.topic=a.name) AS "firstAttempts",
       (SELECT count(*)::int FROM first f WHERE f.topic=a.name AND f.correct) AS "firstCorrect"
     FROM unnest($2::text[]) WITH ORDINALITY a(name,ord)
     ORDER BY a.ord`, [owner, [...AREAS]],
  )).rows.filter((row) => row.published > 0);
}

/** Erros do estudo livre: total e os que já passaram do intervalo de revisão. */
export async function errorCounts(owner: string) {
  return (await db.query<{ total: number; ready: number }>(
    `WITH latest AS (
       SELECT DISTINCT ON (v.question_id) a.option_id=v.correct_option_id AS correct,a.updated_at
       FROM answer a JOIN question_version v ON v.id=a.question_id
       WHERE a.owner_id=$1 AND v.editorial_status='PUBLISHED'
       ORDER BY v.question_id,a.updated_at DESC,v.version_number DESC,v.id)
     SELECT count(*) FILTER (WHERE NOT correct)::int AS total,
       count(*) FILTER (WHERE NOT correct AND updated_at <= now() - interval '1 day')::int AS ready
     FROM latest`, [owner],
  )).rows[0];
}

@Controller("api/me")
export class ProgressController {
  @Get("progress") async progress(@Req() req: any) {
    const user = await requireIdentity(req);
    const [areas, errors, active] = await Promise.all([
      areaProgress(user.id),
      errorCounts(user.id),
      db.query(
        `SELECT p.id,p.kind,p.size,p.area,p.paused_at AS "pausedAt",
           (SELECT count(*)::int FROM practice_item i WHERE i.attempt_id=p.id AND i.option_id IS NOT NULL) AS answered
         FROM practice_attempt p WHERE p.owner_id=$1 AND p.state='IN_PROGRESS'`, [user.id],
      ),
    ]);
    return { areas, errors, active: active.rows[0] ?? null };
  }
}
