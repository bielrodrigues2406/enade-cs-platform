import { randomUUID } from "node:crypto";
import { Body, Controller, Get, HttpCode, Param, Post, Put, Req } from "@nestjs/common";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";
import { AREAS } from "./question-areas.js";
import { imageView, type QuestionImage } from "./question-images.js";
import { publicExam, sourceFields, type Source } from "./source-store.js";

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const SIZES = [10, 20, 30];
// Disponibilidade e criação usam exatamente a mesma elegibilidade. Publicação
// e revisão pertencem à curadoria; este módulo não promove conteúdo privado.
export const ELIGIBLE = `SELECT q.id,q.question_id,q.topic,q.origin,q.exam_source_id,q.source_question_number
  FROM editorial_question c JOIN question_version q ON q.id=c.current_version_id
  WHERE q.editorial_status='PUBLISHED' AND q.origin IN ('AUTHOR_CREATED','OFFICIAL')
    AND (SELECT count(*) FROM question_option o WHERE o.question_id=q.id) BETWEEN 2 AND 5
    AND EXISTS(SELECT 1 FROM question_option o WHERE o.question_id=q.id AND o.id=q.correct_option_id)
    AND (q.presentation='TEXT' OR EXISTS(SELECT 1 FROM question_version_image i WHERE i.version_id=q.id))`;

export type Attempt = {
  id: string; size: number; area: string | null; state: "IN_PROGRESS" | "COMPLETED";
  createdAt: Date; finishedAt: Date | null; answered: number; summary: Result | null;
  kind: "PARTIAL" | "EDITION"; examSourceId: string | null; deadlineAt: Date | null;
};
type Counts = { total: number; correct: number; incorrect: number; unanswered: number };
type Result = Counts & {
  official: number; author: number; demonstration: number;
  byTopic: (Counts & { topic: string })[];
  /** Formação Geral e componente específico, como no boletim do ENADE. */
  byBlock: { general: Counts; specific: Counts };
};
type Item = {
  position: number; optionId: string | null; marked: boolean; revision: number;
  id: string; title: string; topic: string; prompt: string; origin: string;
  authorCredit: string; demonstration: boolean; versionNumber: number;
  presentation: "TEXT" | "IMAGE"; reviewOrigin: string;
  examSourceId: string | null; keySourceId: string | null;
  sourcePage: number | null; sourceQuestionNumber: number | null; keyPage: number | null;
  correctOptionId: string; explanation: string; explanationCredit: string | null;
  subject: string | null; reviewNote: string | null;
};
// Tolerância para a última gravação feita no limite do prazo chegar ao servidor.
const DEADLINE_GRACE = "15 seconds";
export const ATTEMPT_FIELDS = `p.id,p.size,p.area,p.state,p.created_at AS "createdAt",p.finished_at AS "finishedAt",p.summary,
  p.kind,p.exam_source_id AS "examSourceId",p.deadline_at AS "deadlineAt",
  (SELECT count(*)::integer FROM practice_item i WHERE i.attempt_id=p.id AND i.option_id IS NOT NULL) AS answered`;

export function closed(body: unknown, keys: string[]) {
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some((key) => !keys.includes(key))) fail("Dados do treino inválidos.", 400);
  return body as Record<string, unknown>;
}
function noQuery(req: any) {
  if (Object.keys(req.query ?? {}).length) fail("Filtro de treino inválido.", 400);
}
function attemptId(value: string) {
  if (!UUID.test(value)) fail("Treino não encontrado.", 404);
  return value.toLowerCase();
}
function attemptSummary(row: Attempt) {
  return {
    id: row.id, state: row.state, size: row.size, area: row.area,
    createdAt: row.createdAt, finishedAt: row.finishedAt, answered: row.answered,
    kind: row.kind, deadlineAt: row.deadlineAt,
  };
}
export async function owned(client: PoolClient, id: string, owner: string, lock = false) {
  const row = (await client.query<Attempt>(
    `SELECT ${ATTEMPT_FIELDS} FROM practice_attempt p WHERE p.id=$1 AND p.owner_id=$2 ${lock ? "FOR UPDATE OF p" : ""}`,
    [id, owner],
  )).rows[0];
  return row ?? fail("Treino não encontrado.", 404);
}

async function items(client: PoolClient, id: string): Promise<Item[]> {
  return (await client.query<Item>(
    `SELECT i.position,i.option_id AS "optionId",i.marked,i.revision,
      q.id,q.title,q.topic,q.prompt,q.origin,q.author_credit AS "authorCredit",q.demonstration,
      q.version_number AS "versionNumber",q.presentation,q.review_origin AS "reviewOrigin",
      q.exam_source_id AS "examSourceId",q.key_source_id AS "keySourceId",
      q.source_page AS "sourcePage",q.source_question_number AS "sourceQuestionNumber",q.key_page AS "keyPage",
      q.correct_option_id AS "correctOptionId",q.explanation,q.explanation_credit AS "explanationCredit",
      q.subject,q.review_note AS "reviewNote"
    FROM practice_item i JOIN question_version q ON q.id=i.version_id
    WHERE i.attempt_id=$1 ORDER BY i.position`, [id],
  )).rows;
}
function result(rows: Item[]): Result {
  const counts = (): Counts => ({ total: 0, correct: 0, incorrect: 0, unanswered: 0 });
  const summary = { ...counts(), official: 0, author: 0, demonstration: 0 };
  const topics = new Map<string, Counts>();
  const byBlock = { general: counts(), specific: counts() };
  for (const row of rows) {
    const topic = topics.get(row.topic) ?? counts();
    const block = byBlock[row.topic === "Formação Geral" ? "general" : "specific"];
    const outcome = row.optionId === null ? "unanswered" : row.optionId === row.correctOptionId ? "correct" : "incorrect";
    summary.total++; summary[outcome]++; topic.total++; topic[outcome]++; block.total++; block[outcome]++;
    topics.set(row.topic, topic);
    if (row.origin === "OFFICIAL") summary.official++;
    else if (row.demonstration) summary.demonstration++;
    else summary.author++;
  }
  return {
    ...summary,
    byBlock,
    byTopic: [...topics].sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([topic, values]) => ({ topic, ...values })),
  };
}
/** Discursivas publicadas da prova de uma tentativa de edição. */
async function editionDiscursive(client: PoolClient, attempt: Attempt) {
  if (attempt.kind !== "EDITION") return [];
  return (await client.query<{ id: string; number: number }>(
    "SELECT id,number FROM discursive_question WHERE exam_source_id=$1 ORDER BY number", [attempt.examSourceId],
  )).rows;
}

/**
 * Finaliza uma vez: resumo imutável e, na prova da edição, envio dos
 * rascunhos das discursivas dela (o padrão de resposta aparece depois).
 */
async function complete(client: PoolClient, attempt: Attempt, owner: string) {
  const summary = result(await items(client, attempt.id));
  await client.query("UPDATE practice_attempt SET state='COMPLETED',finished_at=clock_timestamp(),summary=$2::jsonb WHERE id=$1",
    [attempt.id, JSON.stringify(summary)]);
  const discursive = (await editionDiscursive(client, attempt)).map((row) => row.id);
  if (discursive.length)
    await client.query(
      `UPDATE discursive_response SET submitted_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp()
       WHERE owner_id=$1 AND question_id=ANY($2::text[]) AND submitted_at IS NULL AND btrim(body)<>''`,
      [owner, discursive],
    );
}

/** Prazo da prova vencido: finaliza com o que foi salvo. Devolve se finalizou. */
async function expire(client: PoolClient, attempt: Attempt, owner: string) {
  if (attempt.state !== "IN_PROGRESS" || !attempt.deadlineAt) return false;
  const late = (await client.query(`SELECT $1::timestamptz + interval '${DEADLINE_GRACE}' < clock_timestamp() AS late`,
    [attempt.deadlineAt])).rows[0].late;
  if (late) await complete(client, attempt, owner);
  return late as boolean;
}

export async function view(client: PoolClient, attempt: Attempt) {
  const rows = await items(client, attempt.id);
  const ids = rows.map((row) => row.id);
  const options = (await client.query<{ questionId: string; id: string; text: string }>(
    'SELECT question_id AS "questionId",id,text FROM question_option WHERE question_id=ANY($1::text[]) ORDER BY position', [ids],
  )).rows;
  const images = (await client.query<QuestionImage & { versionId: string }>(
    `SELECT i.version_id AS "versionId",i.asset_sha256 AS sha256,i.source_page AS page,a.width,a.height
      FROM question_version_image i JOIN question_asset a ON a.sha256=i.asset_sha256
      WHERE i.version_id=ANY($1::text[]) ORDER BY i.position`, [ids],
  )).rows;
  const complete = attempt.state === "COMPLETED";
  const sourceIds = [...new Set(rows.flatMap((row) => [row.examSourceId, ...(complete ? [row.keySourceId] : [])]).filter(Boolean))];
  const sources = (await client.query<Source & { finality: string | null }>(
    `SELECT ${sourceFields},key_finality AS finality FROM source_document WHERE id=ANY($1::uuid[])`, [sourceIds],
  )).rows;
  const bySource = new Map(sources.map((source) => [source.id, source]));
  const edition = attempt.examSourceId
    ? (await client.query<Source>(`SELECT ${sourceFields} FROM source_document WHERE id=$1`, [attempt.examSourceId])).rows[0]
    : null;
  return {
    ...attemptSummary(attempt), answered: rows.filter((row) => row.optionId !== null).length,
    summary: complete ? attempt.summary : null,
    edition: edition ? publicExam(edition) : null,
    discursive: await editionDiscursive(client, attempt),
    items: rows.map((row) => {
      const exam = row.examSourceId ? bySource.get(row.examSourceId) : null;
      const key = row.keySourceId ? bySource.get(row.keySourceId) : null;
      return {
        position: row.position,
        // Explicit projection prevents study answers and editorial keys from
        // leaking into an in-progress attempt, even when already studied.
        question: {
          id: row.id, title: row.title, topic: row.topic, subject: row.subject, prompt: row.prompt,
          origin: row.origin, authorCredit: row.authorCredit, demonstration: row.demonstration,
          versionNumber: row.versionNumber,
          options: options.filter((option) => option.questionId === row.id).map(({ id, text }) => ({ id, text })),
          presentation: row.presentation,
          images: images.filter((image) => image.versionId === row.id).map(imageView),
          reviewOrigin: row.reviewOrigin,
          provenance: exam ? { exam: publicExam(exam), page: row.sourcePage, questionNumber: row.sourceQuestionNumber } : null,
        },
        answer: { optionId: row.optionId, marked: row.marked, revision: row.revision },
        ...(complete ? { result: {
          correct: row.optionId === null ? null : row.optionId === row.correctOptionId,
          correctOptionId: row.correctOptionId, explanation: row.explanation, reviewNote: row.reviewNote,
          explanationCredit: row.explanationCredit || row.authorCredit,
          ...(key ? { answerKey: {
            id: key.id, title: key.title, officialUrl: key.officialUrl, sha256: key.sha256,
            page: row.keyPage, finality: key.finality,
          } } : {}),
        } } : {}),
      };
    }),
  };
}

@Controller("api/practice")
export class PracticeController {
  @Get()
  async availability(@Req() req: any) {
    const user = await requireIdentity(req); noQuery(req);
    const data = (await db.query(
      `WITH eligible AS (${ELIGIBLE}), owned AS (
        SELECT ${ATTEMPT_FIELDS} FROM practice_attempt p WHERE p.owner_id=$1
      )
      SELECT json_build_object(
        'sizes',json_build_array(10,20,30),'defaultSize',20,
        'total',(SELECT count(*)::integer FROM eligible),
        'areas',(SELECT json_agg(json_build_object('name',a.name,'count',
          (SELECT count(*)::integer FROM eligible e WHERE e.topic=a.name)) ORDER BY a.ordinality)
          FROM unnest($2::text[]) WITH ORDINALITY a(name,ordinality)),
        'active',(SELECT row_to_json(a) FROM (SELECT id,state,size,area,"createdAt","finishedAt",answered FROM owned WHERE state='IN_PROGRESS') a),
        'recent',COALESCE((SELECT json_agg(a ORDER BY a."finishedAt" DESC,a.id DESC) FROM (
          SELECT id,state,size,area,"createdAt","finishedAt",answered FROM owned
          WHERE state='COMPLETED' ORDER BY "finishedAt" DESC,id DESC LIMIT 5
        ) a),'[]'::json)
      ) AS availability`, [user.id, [...AREAS]],
    )).rows[0].availability;
    return data;
  }

  @Post()
  async start(@Req() req: any, @Body() body: unknown) {
    await requireIdentity(req); noQuery(req);
    const data = closed(body, ["requestId", "size", "area"]);
    if (typeof data.requestId !== "string" || !UUID.test(data.requestId)
      || typeof data.size !== "number" || !SIZES.includes(data.size)
      || !(data.area === null || typeof data.area === "string" && (AREAS as readonly string[]).includes(data.area)))
      fail("Escolha 10, 20 ou 30 questões e uma área disponível.", 400);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const user = await requireIdentity(req, client, true);
      await client.query("SELECT id FROM study_identity WHERE id=$1 FOR UPDATE", [user.id]);
      const previous = (await client.query<Attempt>(
        `SELECT ${ATTEMPT_FIELDS} FROM practice_attempt p WHERE p.owner_id=$1 AND p.request_id=$2 FOR UPDATE OF p`, [user.id, data.requestId],
      )).rows[0];
      if (previous) {
        if (previous.size !== data.size || previous.area !== data.area)
          fail("Esta solicitação já iniciou um treino com outra configuração.", 409);
        const dto = await view(client, previous);
        await client.query("COMMIT");
        return dto;
      }
      if ((await client.query("SELECT 1 FROM practice_attempt WHERE owner_id=$1 AND state='IN_PROGRESS'", [user.id])).rowCount)
        fail("Você já tem um treino em andamento. Retome-o antes de iniciar outro.", 409);
      const selected = (await client.query<{ id: string; question_id: string }>(
        `WITH eligible AS (${ELIGIBLE}) SELECT id,question_id FROM eligible
          WHERE ($1::text IS NULL OR topic=$1) ORDER BY random() LIMIT $2`, [data.area, data.size],
      )).rows;
      if (selected.length !== data.size)
        fail("Ainda não há questões publicadas suficientes para esse tamanho. Escolha outra quantidade ou área.", 409);
      const id = randomUUID();
      await client.query("INSERT INTO practice_attempt(id,owner_id,request_id,size,area) VALUES($1,$2,$3,$4,$5)", [id, user.id, data.requestId, data.size, data.area]);
      for (const [index, row] of selected.entries()) {
        await client.query("INSERT INTO practice_item(attempt_id,position,question_id,version_id) VALUES($1,$2,$3,$4)", [id, index + 1, row.question_id, row.id]);
      }
      const dto = await view(client, await owned(client, id, user.id));
      await client.query("COMMIT");
      return dto;
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }

  @Get(":id")
  async get(@Req() req: any, @Param("id") rawId: string) {
    const user = await requireIdentity(req); noQuery(req);
    const id = attemptId(rawId);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const attempt = await owned(client, id, user.id, true);
      const dto = await view(client, await expire(client, attempt, user.id) ? await owned(client, id, user.id) : attempt);
      await client.query("COMMIT"); return dto;
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }

  @Put(":id/items/:position")
  async save(@Req() req: any, @Param("id") rawId: string, @Param("position") rawPosition: string, @Body() body: unknown) {
    await requireIdentity(req); noQuery(req);
    const id = attemptId(rawId);
    const data = closed(body, ["optionId", "marked", "baseRevision"]);
    if (!/^(?:[1-9]|[1-5][0-9]|60)$/.test(rawPosition)
      || !(data.optionId === null || typeof data.optionId === "string" && data.optionId.length > 0 && data.optionId.length <= 100)
      || typeof data.marked !== "boolean" || !Number.isSafeInteger(data.baseRevision)
      || (data.baseRevision as number) < 0 || (data.baseRevision as number) > 1000000)
      fail("Alternativa, marcação ou revisão inválida.", 400);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const user = await requireIdentity(req, client, true);
      const attempt = await owned(client, id, user.id, true);
      if (await expire(client, attempt, user.id)) {
        await client.query("COMMIT");
        return fail("O tempo da prova acabou. O resultado foi registrado com o que estava salvo.", 409);
      }
      if (attempt.state !== "IN_PROGRESS") fail("Este treino já foi finalizado. Consulte o resultado.", 409);
      const item = (await client.query<{ versionId: string; position: number; optionId: string | null; marked: boolean; revision: number }>(
        'SELECT version_id AS "versionId",position,option_id AS "optionId",marked,revision FROM practice_item WHERE attempt_id=$1 AND position=$2', [id, Number(rawPosition)],
      )).rows[0];
      if (!item) fail("Item não encontrado neste treino.", 404);
      if (data.optionId !== null && !(await client.query("SELECT 1 FROM question_option WHERE question_id=$1 AND id=$2", [item.versionId, data.optionId])).rowCount)
        fail("A alternativa não pertence a esta questão.", 400);
      if (item.revision === (data.baseRevision as number) + 1 && item.optionId === data.optionId && item.marked === data.marked) {
        await client.query("COMMIT");
        return { position: item.position, optionId: item.optionId, marked: item.marked, revision: item.revision };
      }
      if (item.revision !== data.baseRevision || item.revision >= 1000000)
        fail("Esta resposta mudou em outra aba. Reabra o treino para conferir antes de salvar.", 409);
      const saved = (await client.query(
        'UPDATE practice_item SET option_id=$3,marked=$4,revision=revision+1,updated_at=clock_timestamp() WHERE attempt_id=$1 AND position=$2 RETURNING position,option_id AS "optionId",marked,revision', [id, Number(rawPosition), data.optionId, data.marked],
      )).rows[0];
      await client.query("COMMIT"); return saved;
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }

  @Post(":id/finish") @HttpCode(200)
  async finish(@Req() req: any, @Param("id") rawId: string, @Body() body: unknown) {
    await requireIdentity(req); noQuery(req); closed(body, []);
    const id = attemptId(rawId), client = await db.connect();
    try {
      await client.query("BEGIN");
      const user = await requireIdentity(req, client, true);
      const attempt = await owned(client, id, user.id, true);
      if (attempt.state === "IN_PROGRESS") await complete(client, attempt, user.id);
      const dto = await view(client, await owned(client, id, user.id));
      await client.query("COMMIT"); return dto;
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }
}
