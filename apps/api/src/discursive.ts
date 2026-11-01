import { Body, Controller, Get, HttpCode, Param, Post, Put, Req } from "@nestjs/common";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";
import { imageView, type QuestionImage } from "./question-images.js";

// Discursivas (DISC-1, ADR-013). O aluno escreve a resposta (rascunho salvo),
// envia, e só então vê o padrão de resposta do Inep e se autoavalia item a
// item. A nota estimada é dele; não há correção automática de texto livre.

const ID = /^discursive-[a-f0-9]{12}-[qd][0-9]{1,3}$/;
const MAX_BODY = 6000;
export type Criterion = { label: string | null; points: number };
/** 0 não contemplei, 1 contemplei em parte, 2 contemplei. */
export type Level = 0 | 1 | 2;
type Response = { body: string; revision: number; submittedAt: string | null; assessment: { levels: Level[]; score: number } | null };

/** Nota estimada de 0 a 10, com uma casa: cada item vale seus pontos × nível/2. */
export function estimateScore(criteria: Criterion[], levels: Level[]) {
  const total = criteria.reduce((sum, c, i) => sum + (c.points * levels[i]) / 2, 0);
  return Math.round(total * 10) / 10;
}

function title(row: { year: number; modality: string; number: number }) {
  const modality = row.modality === "LICENCIATURA" ? " · Licenciatura" : "";
  return `ENADE ${row.year}${modality} · Discursiva ${row.number}`;
}

async function question(id: string) {
  if (!ID.test(id)) fail("Discursiva não encontrada.", 404);
  const row = (await db.query(
    `SELECT q.id,q.year,q.modality,q.number,q.area,q.subject,q.criteria,
       e.official_url AS "examUrl",s.official_url AS "standardUrl",
       -- Conferida por agente (DISC-2): a tela avisa, como nas objetivas.
       CASE WHEN q.review_origin='ASSISTED' THEN 'Recortes e itens conferidos por agente de IA (' || q.assisted_reviewer || '), sem revisão humana. Na dúvida, vale a prova original.' END AS "reviewCredit",
       q.review_note AS "reviewNote"
     FROM discursive_question q JOIN source_document e ON e.id=q.exam_source_id
     JOIN source_document s ON s.id=q.standard_source_id WHERE q.id=$1`, [id],
  )).rows[0];
  return row ?? fail("Discursiva não encontrada.", 404);
}

async function images(id: string, part: "PROMPT" | "STANDARD") {
  return (await db.query<QuestionImage>(
    `SELECT i.asset_sha256 AS sha256,i.source_page AS page,a.width,a.height
     FROM discursive_image i JOIN question_asset a ON a.sha256=i.asset_sha256
     WHERE i.question_id=$1 AND i.part=$2 ORDER BY i.position`, [id, part],
  )).rows.map(imageView);
}

async function response(owner: string, id: string): Promise<Response | null> {
  return (await db.query(
    `SELECT body,revision,submitted_at AS "submittedAt",assessment
     FROM discursive_response WHERE owner_id=$1 AND question_id=$2`, [owner, id],
  )).rows[0] ?? null;
}

function readBody(input: any) {
  const body = typeof input?.body === "string" ? input.body.replace(/\r\n/g, "\n") : fail("Resposta inválida.", 400);
  if (body.length > MAX_BODY) fail(`A resposta passa de ${MAX_BODY} caracteres.`, 400);
  const base = Number(input?.baseRevision);
  if (!Number.isInteger(base) || base < 0 || base > 1_000_000) fail("Revisão inválida.", 400);
  return { body, base };
}

/** Grava o texto se a revisão bater e a resposta ainda não foi enviada. */
async function saveDraft(owner: string, id: string, body: string, base: number, submit: boolean) {
  const result = base === 0
    ? await db.query(
      `INSERT INTO discursive_response(owner_id,question_id,body,revision,submitted_at)
       VALUES($1,$2,$3,1,CASE WHEN $4 THEN clock_timestamp() END) ON CONFLICT DO NOTHING RETURNING revision`,
      [owner, id, body, submit])
    : await db.query(
      `UPDATE discursive_response SET body=$3,revision=revision+1,updated_at=clock_timestamp(),
         submitted_at=CASE WHEN $5 THEN clock_timestamp() END
       WHERE owner_id=$1 AND question_id=$2 AND revision=$4 AND submitted_at IS NULL RETURNING revision`,
      [owner, id, body, base, submit]);
  if (!result.rowCount) fail("A resposta mudou em outra aba ou já foi enviada. Reabra a questão.", 409);
  return result.rows[0].revision as number;
}

@Controller("api/discursive")
export class DiscursiveController {
  @Get() async list(@Req() req: any) {
    const user = await requireIdentity(req);
    const rows = (await db.query(
      `SELECT q.id,q.year,q.modality,q.number,q.area,q.subject,
         CASE WHEN r.assessment IS NOT NULL THEN 'ASSESSED' WHEN r.submitted_at IS NOT NULL THEN 'SUBMITTED'
              WHEN r.owner_id IS NOT NULL THEN 'DRAFT' ELSE 'NEW' END AS status,
         (r.assessment->>'score')::numeric::float AS score
       FROM discursive_question q
       LEFT JOIN discursive_response r ON r.question_id=q.id AND r.owner_id=$1
       ORDER BY q.year DESC,q.modality,q.number`, [user.id],
    )).rows;
    return rows.map((row) => ({ ...row, title: title(row) }));
  }

  @Get(":id") async detail(@Req() req: any, @Param("id") id: string) {
    const user = await requireIdentity(req);
    const row = await question(id);
    const mine = await response(user.id, id);
    return {
      ...row,
      title: title(row),
      promptImages: await images(id, "PROMPT"),
      // O padrão de resposta só aparece depois do envio.
      standardImages: mine?.submittedAt ? await images(id, "STANDARD") : [],
      response: mine,
    };
  }

  @Put(":id/response") async save(@Req() req: any, @Param("id") id: string, @Body() input: any) {
    const user = await requireIdentity(req);
    await question(id);
    const { body, base } = readBody(input);
    return { revision: await saveDraft(user.id, id, body, base, false) };
  }

  @Post(":id/submit") @HttpCode(200) async submit(@Req() req: any, @Param("id") id: string, @Body() input: any) {
    const user = await requireIdentity(req);
    await question(id);
    const { body, base } = readBody(input);
    if (!body.trim()) fail("Escreva a resposta antes de enviar.", 400);
    await saveDraft(user.id, id, body, base, true);
    return { response: await response(user.id, id), standardImages: await images(id, "STANDARD") };
  }

  @Put(":id/assessment") async assess(@Req() req: any, @Param("id") id: string, @Body() input: any) {
    const user = await requireIdentity(req);
    const row = await question(id);
    const criteria = row.criteria as Criterion[];
    const levels = input?.levels;
    if (!Array.isArray(levels) || levels.length !== criteria.length || !levels.every((l) => l === 0 || l === 1 || l === 2))
      fail("Avalie cada item com 0, 1 ou 2.", 400);
    const assessment = { levels, score: estimateScore(criteria, levels as Level[]) };
    const updated = await db.query(
      `UPDATE discursive_response SET assessment=$3,updated_at=clock_timestamp()
       WHERE owner_id=$1 AND question_id=$2 AND submitted_at IS NOT NULL`,
      [user.id, id, JSON.stringify(assessment)],
    );
    if (!updated.rowCount) fail("Envie a resposta antes de se autoavaliar.", 409);
    return assessment;
  }
}
