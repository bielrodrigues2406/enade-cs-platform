import { randomUUID } from "node:crypto";
import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";
import { ATTEMPT_FIELDS, ELIGIBLE, attemptId, closed, expire, owned, view, type Attempt } from "./exam.js";

// Prova completa da edição (SIM-1, ADR-014): as objetivas publicadas de uma
// prova oficial, na ordem original, com o tempo da prova. Usa a mesma
// tentativa do treino parcial; só a seleção, o prazo e a pausa são próprios.

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
/** Duração das provas de 2004 a 2026 (bacharelados e CST): quatro horas. */
export const EDITION_MINUTES = 240;
/** Abaixo disso não vale como prova: a edição não é oferecida (2008 tem 16 de Computação). */
export const MIN_OBJECTIVES = 10;

type Edition = {
  id: string; year: number; modality: string; title: string; officialUrl: string;
  objectives: number; general: number; discursive: number; numbers: number[];
};

/** Números de 1 ao maior publicado que não estão publicados (anuladas ou pendentes). */
export function missingNumbers(numbers: number[]) {
  const present = new Set(numbers);
  return Array.from({ length: Math.max(0, ...numbers) }, (_, i) => i + 1).filter((n) => !present.has(n));
}

async function editions(): Promise<Edition[]> {
  return (await db.query<Edition>(
    `WITH eligible AS (${ELIGIBLE})
     SELECT s.id,s.year,s.modality,s.title,s.official_url AS "officialUrl",
       count(*)::int AS objectives,count(*) FILTER (WHERE e.topic='Formação Geral')::int AS general,
       (SELECT count(*)::int FROM discursive_question d WHERE d.exam_source_id=s.id) AS discursive,
       array_agg(e.source_question_number ORDER BY e.source_question_number) AS numbers
     FROM eligible e JOIN source_document s ON s.id=e.exam_source_id
     WHERE e.origin='OFFICIAL' GROUP BY s.id HAVING count(*) >= $1
     ORDER BY s.year DESC,s.modality`, [MIN_OBJECTIVES],
  )).rows;
}

/** Pausa ou retoma o cronômetro. Pausada, a prova não vence e não aceita respostas. */
async function setPaused(req: any, rawId: string, paused: boolean) {
  const id = attemptId(rawId);
  const client: PoolClient = await db.connect();
  try {
    await client.query("BEGIN");
    const user = await requireIdentity(req, client, true);
    const attempt = await owned(client, id, user.id, true);
    if (attempt.kind !== "EDITION") fail("Só a prova completa tem cronômetro.", 400);
    if (!(await expire(client, attempt, user.id)) && attempt.state === "IN_PROGRESS")
      await client.query(paused
        ? "UPDATE practice_attempt SET paused_at=COALESCE(paused_at,clock_timestamp()) WHERE id=$1"
        : `UPDATE practice_attempt SET paused_ms=paused_ms+(extract(epoch FROM clock_timestamp()-paused_at)*1000)::bigint,
             paused_at=NULL WHERE id=$1 AND paused_at IS NOT NULL`, [id]);
    const dto = await view(client, await owned(client, id, user.id));
    await client.query("COMMIT");
    return dto;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

@Controller("api/editions")
export class EditionExamController {
  @Get() async list(@Req() req: any) {
    await requireIdentity(req);
    return {
      minutes: EDITION_MINUTES,
      editions: (await editions()).map(({ numbers, ...edition }) => ({
        ...edition,
        // Caderno compartilhado tem questões de outros cursos: lacunas não dizem nada.
        missing: edition.modality === "COMUM" ? [] : missingNumbers(numbers),
      })),
    };
  }

  @Post("attempts/:id/pause") @HttpCode(200) pause(@Req() req: any, @Param("id") id: string) {
    return setPaused(req, id, true);
  }

  @Post("attempts/:id/resume") @HttpCode(200) resume(@Req() req: any, @Param("id") id: string) {
    return setPaused(req, id, false);
  }

  @Post(":source/attempts") async start(@Req() req: any, @Param("source") source: string, @Body() body: unknown) {
    await requireIdentity(req);
    const data = closed(body, ["requestId"]);
    if (!UUID.test(source) || typeof data.requestId !== "string" || !UUID.test(data.requestId))
      fail("Prova ou solicitação inválida.", 400);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const user = await requireIdentity(req, client, true);
      await client.query("SELECT id FROM study_identity WHERE id=$1 FOR UPDATE", [user.id]);
      // Repetição da mesma solicitação devolve a mesma prova.
      const previous = (await client.query<Attempt>(
        `SELECT ${ATTEMPT_FIELDS} FROM practice_attempt p WHERE p.owner_id=$1 AND p.request_id=$2`, [user.id, data.requestId],
      )).rows[0];
      if (previous) {
        if (previous.kind !== "EDITION" || previous.examSourceId !== source.toLowerCase())
          fail("Esta solicitação já iniciou outro treino.", 409);
        const dto = await view(client, previous);
        await client.query("COMMIT");
        return dto;
      }
      if ((await client.query("SELECT 1 FROM practice_attempt WHERE owner_id=$1 AND state='IN_PROGRESS'", [user.id])).rowCount)
        fail("Você já tem um treino em andamento. Retome-o ou finalize antes de começar a prova.", 409);
      const selected = (await client.query<{ id: string; question_id: string }>(
        `WITH eligible AS (${ELIGIBLE}) SELECT id,question_id FROM eligible
         WHERE exam_source_id=$1 AND origin='OFFICIAL' ORDER BY source_question_number,id`, [source],
      )).rows;
      if (selected.length < MIN_OBJECTIVES || selected.length > 60)
        fail("Esta prova ainda não tem objetivas publicadas suficientes.", 409);
      const id = randomUUID();
      await client.query(
        `INSERT INTO practice_attempt(id,owner_id,request_id,size,kind,exam_source_id,deadline_at)
         VALUES($1,$2,$3,$4,'EDITION',$5,clock_timestamp() + make_interval(mins => $6))`,
        [id, user.id, data.requestId, selected.length, source, EDITION_MINUTES],
      );
      for (const [index, row] of selected.entries())
        await client.query("INSERT INTO practice_item(attempt_id,position,question_id,version_id) VALUES($1,$2,$3,$4)",
          [id, index + 1, row.question_id, row.id]);
      const dto = await view(client, await owned(client, id, user.id));
      await client.query("COMMIT");
      return dto;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
