import { Body, Controller, Get, Param, Put, Req, Res } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { IncomingMessage, ServerResponse } from "node:http";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";
import { attemptId, closed, expire, owned, type Attempt } from "./exam.js";
import { estimateScore, type Criterion, type Level } from "./discursive.js";
import { readAsset, type QuestionImage } from "./question-images.js";

type Assessment = { levels: Level[]; score: number };
type PinnedContent = {
  id: string; title: string; number: number; area: string; subject: string | null;
  criteria: Criterion[]; examUrl: string; standardUrl: string;
  reviewCredit: string | null; reviewNote: string | null;
};
type Pinned = {
  questionId: string; content: PinnedContent; body: string; revision: number; assessment: Assessment | null;
};

/** Copia a referência e os recortes aprovados: outra tentativa terá outro rascunho. */
export async function pinDiscursive(client: PoolClient, id: string, question: string) {
  await client.query(
    `INSERT INTO practice_discursive(attempt_id,question_id,content)
     SELECT $1,q.id,jsonb_build_object('id',q.id,'number',q.number,'area',q.area,'subject',q.subject,
       'title','ENADE '||q.year||' · Discursiva '||q.number,'criteria',q.criteria,
       'examUrl',e.official_url,'standardUrl',s.official_url,'reviewNote',q.review_note,
       'reviewCredit',CASE WHEN q.review_origin='ASSISTED' THEN
         'Recortes e itens conferidos por agente de IA ('||q.assisted_reviewer||'), sem revisão humana. Na dúvida, vale a prova original.' END)
     FROM discursive_question q JOIN source_document e ON e.id=q.exam_source_id
       JOIN source_document s ON s.id=q.standard_source_id WHERE q.id=$2`,[id,question]);
  await client.query(
    `INSERT INTO practice_discursive_image(attempt_id,part,position,asset_sha256,source_page,box,dpi)
     SELECT $1,part,position,asset_sha256,source_page,box,dpi FROM discursive_image WHERE question_id=$2`,[id,question]);
}

export async function formatDiscursiveSummary(client: PoolClient, attempt: Attempt) {
  if (attempt.kind!=="FORMAT") return [];
  return (await client.query<{id:string;number:number}>(
    `SELECT question_id AS id,(content->>'number')::int AS number FROM practice_discursive WHERE attempt_id=$1`,[attempt.id],
  )).rows;
}

async function pinned(client: PoolClient, id: string) {
  const row = (await client.query<Pinned>(
    'SELECT question_id AS "questionId",content,body,revision,assessment FROM practice_discursive WHERE attempt_id=$1',[id],
  )).rows[0];
  return row ?? fail("Discursiva não encontrada nesta tentativa.",404);
}
async function images(client: PoolClient, id: string, part: "PROMPT" | "STANDARD") {
  return (await client.query<QuestionImage>(
    `SELECT i.asset_sha256 AS sha256,i.source_page AS page,a.width,a.height FROM practice_discursive_image i
     JOIN question_asset a ON a.sha256=i.asset_sha256 WHERE i.attempt_id=$1 AND i.part=$2 ORDER BY i.position`,[id,part],
  )).rows.map(({sha256,...image}) => ({...image,url:`/api/practice/${id}/discursive/images/${sha256}.webp`}));
}

/** O padrão depende da conclusão desta tentativa, não de uma resposta antiga no estudo. */
async function detail(client: PoolClient, attempt: Attempt) {
  const row = await pinned(client,attempt.id);
  const completed = attempt.state==="COMPLETED";
  return {
    ...row.content, standardUrl: completed ? row.content.standardUrl : null,
    reviewNote: completed ? row.content.reviewNote : null,
    promptImages: await images(client,attempt.id,"PROMPT"),
    standardImages: completed ? await images(client,attempt.id,"STANDARD") : [],
    response: {body:row.body,revision:row.revision,submittedAt:completed ? attempt.finishedAt : null,assessment:row.assessment},
  };
}

function readDraft(input: unknown) {
  const data = closed(input,["body","baseRevision"]);
  if (typeof data.body!=="string" || data.body.length>6000 || !Number.isInteger(data.baseRevision)
    || (data.baseRevision as number)<0 || (data.baseRevision as number)>=1000000)
    fail("Use até 6000 caracteres e uma revisão válida.",400);
  return {body:(data.body as string).replace(/\r\n/g,"\n"),base:data.baseRevision as number};
}

@Controller("api/practice/:id/discursive")
export class PracticeDiscursiveController {
  @Get() async detail(@Req() req: IncomingMessage,@Param("id") rawId: string) {
    const user = await requireIdentity(req), id=attemptId(rawId), client=await db.connect();
    try {
      await client.query("BEGIN");
      let attempt = await owned(client,id,user.id,true);
      if (await expire(client,attempt,user.id)) attempt=await owned(client,id,user.id);
      const result = await detail(client,attempt);
      await client.query("COMMIT"); return result;
    } catch(error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  @Put("response") async save(@Req() req: IncomingMessage,@Param("id") rawId: string,@Body() input: unknown) {
    const value=readDraft(input), id=attemptId(rawId), client=await db.connect();
    try {
      await client.query("BEGIN");
      const user=await requireIdentity(req,client,true);
      const attempt=await owned(client,id,user.id,true);
      if (await expire(client,attempt,user.id)) {
        await client.query("COMMIT"); return fail("O tempo acabou. O texto salvo foi preservado no resultado.",409);
      }
      if (attempt.state!=="IN_PROGRESS" || attempt.pausedAt) fail("A tentativa está pausada ou já foi finalizada.",409);
      const row=await pinned(client,id);
      const repeated=row.revision===value.base+1 && row.body===value.body;
      if (!repeated && row.revision!==value.base) fail("O texto mudou em outra aba. Reabra a discursiva antes de editar.",409);
      const revision=repeated ? row.revision : (await client.query<{revision:number}>(
        `UPDATE practice_discursive SET body=$2,revision=revision+1,updated_at=clock_timestamp()
         WHERE attempt_id=$1 RETURNING revision`,[id,value.body],
      )).rows[0].revision;
      await client.query("COMMIT"); return {revision};
    } catch(error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  @Put("assessment") async assess(@Req() req: IncomingMessage,@Param("id") rawId: string,@Body() input: unknown) {
    const data=closed(input,["levels"]), id=attemptId(rawId), client=await db.connect();
    try {
      await client.query("BEGIN");
      const user=await requireIdentity(req,client,true), attempt=await owned(client,id,user.id,true);
      if (attempt.state!=="COMPLETED") fail("Finalize o simulado antes de se autoavaliar.",409);
      const row=await pinned(client,id), levels=data.levels;
      if (!Array.isArray(levels) || levels.length!==row.content.criteria.length || !levels.every(n=>n===0||n===1||n===2))
        fail("Avalie cada item com 0, 1 ou 2.",400);
      const assessment={levels:levels as Level[],score:estimateScore(row.content.criteria,levels as Level[])};
      await client.query("UPDATE practice_discursive SET assessment=$2 WHERE attempt_id=$1",[id,JSON.stringify(assessment)]);
      await client.query("COMMIT"); return assessment;
    } catch(error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  @Get("images/:file") async image(@Req() req: IncomingMessage,@Param("id") rawId: string,@Param("file") file: string,@Res() res: ServerResponse) {
    const user=await requireIdentity(req), id=attemptId(rawId), match=/^([a-f0-9]{64})\.webp$/.exec(file);
    if (!match) return fail("Imagem não encontrada.",404);
    const row=(await db.query<{byteSize:number}>(
      `SELECT a.byte_size AS "byteSize" FROM practice_discursive_image i JOIN practice_attempt p ON p.id=i.attempt_id
       JOIN question_asset a ON a.sha256=i.asset_sha256 WHERE p.id=$1 AND p.owner_id=$2 AND a.sha256=$3
         AND (i.part='PROMPT' OR p.state='COMPLETED') LIMIT 1`,[id,user.id,match[1]],
    )).rows[0];
    if (!row) return fail("Imagem não encontrada.",404);
    const bytes=await readAsset(match[1],row.byteSize);
    res.setHeader("Content-Type","image/webp"); res.setHeader("Content-Length",bytes.length);
    res.setHeader("Cache-Control","private, no-store"); res.end(bytes);
  }
}
