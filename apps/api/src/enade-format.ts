import { randomUUID } from "node:crypto";
import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";
import { ATTEMPT_FIELDS, closed, owned, view, type Attempt } from "./exam.js";
import { ELIGIBLE } from "./practice-eligibility.js";
import { pinDiscursive } from "./practice-discursive.js";

export const ENADE_2026 = { year: 2026, general: 15, specific: 30, discursive: 1, minutes: 240 } as const;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
// Restringir a bacharelado/comum também evita repetir a FG compartilhada
// com cadernos de Licenciatura. Só versões atuais e fontes verificadas.
export const FORMAT_OBJECTIVES = `WITH eligible AS (${ELIGIBLE})
  SELECT e.* FROM eligible e JOIN question_version q ON q.id=e.id
    JOIN source_document s ON s.id=e.exam_source_id
  WHERE e.origin='OFFICIAL' AND NOT q.demonstration AND q.reviewed_at IS NOT NULL
    AND s.status='VERIFIED' AND s.year<2026 AND s.modality IN ('BACHARELADO','COMUM')
    AND s.area IN ('Computação','Ciência da Computação')
    AND (SELECT count(*) FROM question_option o WHERE o.question_id=e.id)=5`;
export const FORMAT_DISCURSIVES = `SELECT d.id FROM discursive_question d
  JOIN source_document e ON e.id=d.exam_source_id JOIN source_document s ON s.id=d.standard_source_id
  WHERE d.area<>'Formação Geral' AND d.year<2026 AND d.modality IN ('BACHARELADO','COMUM')
    AND e.status='VERIFIED' AND s.status='VERIFIED' AND e.year=d.year AND s.year=d.year
    AND e.modality=d.modality AND s.modality=d.modality AND e.area IN ('Computação','Ciência da Computação')
    AND EXISTS(SELECT 1 FROM discursive_image i WHERE i.question_id=d.id AND i.part='PROMPT')
    AND EXISTS(SELECT 1 FROM discursive_image i WHERE i.question_id=d.id AND i.part='STANDARD')`;

type Availability = { general: number; specific: number; discursive: number };
async function availability(client: Pick<PoolClient, "query">) {
  const counts = (await client.query<Availability>(
    `WITH candidates AS (${FORMAT_OBJECTIVES}) SELECT
       count(*) FILTER (WHERE topic='Formação Geral')::int AS general,
       count(*) FILTER (WHERE topic<>'Formação Geral')::int AS specific,
       (SELECT count(*)::int FROM (${FORMAT_DISCURSIVES}) d) AS discursive FROM candidates`,
  )).rows[0];
  const missing = {
    general: Math.max(0, ENADE_2026.general-counts.general),
    specific: Math.max(0, ENADE_2026.specific-counts.specific),
    discursive: Math.max(0, ENADE_2026.discursive-counts.discursive),
  };
  return { format: ENADE_2026, counts, missing, available: Object.values(missing).every(n => n===0) };
}

@Controller("api/formats/enade-2026")
export class EnadeFormatController {
  @Get() async availability(@Req() req: any) {
    const user = await requireIdentity(req);
    const lastResult = (await db.query(
      `SELECT id AS "attemptId",(summary->>'correct')::int AS correct,(summary->>'total')::int AS total,
        finished_at AS "finishedAt" FROM practice_attempt WHERE owner_id=$1 AND kind='FORMAT'
        AND format_year=2026 AND state='COMPLETED' ORDER BY finished_at DESC,id DESC LIMIT 1`, [user.id],
    )).rows[0] ?? null;
    return {...await availability(db),lastResult};
  }

  @Post("attempts") async start(@Req() req: any, @Body() body: unknown) {
    await requireIdentity(req);
    const data = closed(body, ["requestId"]);
    if (typeof data.requestId!=="string" || !UUID.test(data.requestId)) fail("Solicitação inválida.",400);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const user = await requireIdentity(req,client,true);
      await client.query("SELECT id FROM study_identity WHERE id=$1 FOR UPDATE",[user.id]);
      const previous = (await client.query<Attempt>(
        `SELECT ${ATTEMPT_FIELDS} FROM practice_attempt p WHERE p.owner_id=$1 AND p.request_id=$2`,[user.id,data.requestId],
      )).rows[0];
      if (previous) {
        if (previous.kind!=="FORMAT" || previous.formatYear!==2026) fail("Esta solicitação já iniciou outro treino.",409);
        const result = await view(client,previous);
        await client.query("COMMIT"); return result;
      }
      if ((await client.query("SELECT 1 FROM practice_attempt WHERE owner_id=$1 AND state='IN_PROGRESS'",[user.id])).rowCount)
        fail("Você já tem um treino em andamento. Retome-o ou finalize antes de começar o simulado.",409);
      const selected: { id:string; question_id:string }[] = [];
      for (const [general,count] of [[true,15],[false,30]] as const) {
        selected.push(...(await client.query<{id:string;question_id:string}>(
          `WITH candidates AS (${FORMAT_OBJECTIVES}) SELECT id,question_id FROM candidates
           WHERE (topic='Formação Geral')=$1 ORDER BY random() LIMIT $2`,[general,count],
        )).rows);
        if (selected.length !== (general ? 15 : 45)) fail("Ainda faltam questões revisadas para completar este formato.",409);
      }
      const discursive = (await client.query<{id:string}>(`${FORMAT_DISCURSIVES} ORDER BY random() LIMIT 1`)).rows[0];
      if (!discursive) fail("Ainda falta uma discursiva específica revisada para este formato.",409);
      const id = randomUUID();
      await client.query(
        `WITH instant AS (SELECT clock_timestamp() AS now)
         INSERT INTO practice_attempt(id,owner_id,request_id,size,kind,format_year,created_at,deadline_at)
         SELECT $1,$2,$3,45,'FORMAT',2026,now,now+interval '4 hours' FROM instant`,[id,user.id,data.requestId]);
      for (const [index,row] of selected.entries()) await client.query(
        "INSERT INTO practice_item(attempt_id,position,question_id,version_id) VALUES($1,$2,$3,$4)",[id,index+1,row.question_id,row.id]);
      await pinDiscursive(client,id,discursive.id);
      const result = await view(client,await owned(client,id,user.id));
      await client.query("COMMIT"); return result;
    } catch(error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
