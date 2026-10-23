import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";

type Option = { id: string; text: string };
type Content = {
  title: string;
  topic: string;
  prompt: string;
  authorCredit: string;
  explanation: string;
  correctOptionId: string;
  options: Option[];
};
type Version = Content & {
  demonstration: boolean;
  id: string;
  questionId: string;
  sequence: number;
  revision: number;
  editorialStatus: string;
  createdBy: string | null;
  lastEditor: string | null;
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Dados inválidos.", 400);
  return value as Record<string, unknown>;
};
function text(value: unknown, name: string, max: number, min = 1): string {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    fail(`${name}: use de ${min} a ${max} caracteres.`, 400);
  return (value as string).trim();
}
function revision(body: Record<string, unknown>) {
  if (
    !Number.isSafeInteger(body.baseRevision) ||
    (body.baseRevision as number) < 1 ||
    (body.baseRevision as number) > 1000000
  )
    fail("Revisão inválida. Reabra a versão.", 400);
  return body.baseRevision as number;
}
function content(body: Record<string, unknown>): Content {
  if (body.origin !== undefined && body.origin !== "AUTHOR_CREATED")
    fail(
      "Este fluxo aceita somente questões autorais. Importação oficial ainda não está habilitada.",
      400,
    );
  const options = body.options;
  if (!Array.isArray(options) || options.length < 2 || options.length > 5)
    fail("Use de 2 a 5 alternativas.", 400);
  const parsed = (options as unknown[]).map((value) => {
    const option = object(value);
    const id = text(option.id, "Identificador de alternativa", 64);
    if (!/^[a-zA-Z0-9_-]+$/.test(id))
      fail("Identificador de alternativa inválido.", 400);
    return { id, text: text(option.text, "Alternativa", 1000) };
  });
  const correctOptionId = text(body.correctOptionId, "Gabarito", 64);
  if (
    new Set(parsed.map((o) => o.id)).size !== parsed.length ||
    !parsed.some((o) => o.id === correctOptionId)
  )
    fail("Alternativas repetidas ou gabarito incompatível.", 400);
  return {
    title: text(body.title, "Título", 160),
    topic: text(body.topic, "Assunto", 80),
    prompt: text(body.prompt, "Enunciado", 6000),
    authorCredit: text(body.authorCredit, "Crédito autoral", 160),
    explanation: text(body.explanation, "Explicação", 4000),
    correctOptionId,
    options: parsed,
  };
}
async function curator(req: any, client?: PoolClient, lock = false) {
  const user = await requireIdentity(req, client, lock);
  const role = await (client ?? db).query(
    `SELECT identity_id FROM curator_role WHERE identity_id=$1 ${lock ? "FOR SHARE" : ""}`,
    [user.id],
  );
  if (!user.email || !role.rowCount) fail("Acesso reservado à curadoria.", 403);
  return user;
}
async function transaction<T>(
  req: any,
  action: (client: PoolClient, actorId: string) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const user = await curator(req, client, true);
    const result = await action(client, user.id);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505")
      fail("Já existe uma versão aberta. Atualize a fila.", 409);
    throw error;
  } finally {
    client.release();
  }
}
const fields = `v.id,v.question_id AS "questionId",v.version_number AS sequence,v.editorial_revision AS revision,v.title,v.topic,v.prompt,v.origin,v.editorial_status AS "editorialStatus",v.author_credit AS "authorCredit",v.explanation,v.correct_option_id AS "correctOptionId",v.demonstration,v.created_by AS "createdBy",v.last_editor_id AS "lastEditor"`;
async function detail(id: string, actorId: string, client?: PoolClient) {
  if (id.length > 100) fail("Versão não encontrada.", 404);
  const row = (
    await (client ?? db).query<Version & Record<string, unknown>>(
      `SELECT ${fields},q.current_version_id AS "currentVersionId",(SELECT json_agg(json_build_object('id',o.id,'text',o.text) ORDER BY o.position) FROM question_option o WHERE o.question_id=v.id) AS options,(SELECT e.note FROM editorial_event e WHERE e.version_id=v.id AND e.event_type='REJECTED' ORDER BY e.id DESC LIMIT 1) AS "reviewNote" FROM question_version v JOIN editorial_question q ON q.id=v.question_id WHERE v.id=$1`,
      [id],
    )
  ).rows[0];
  if (!row) fail("Versão não encontrada.", 404);
  const { createdBy, lastEditor, ...dto } = row;
  return {
    ...dto,
    isAuthor: createdBy === actorId,
    canReview:
      row.editorialStatus === "IN_REVIEW" &&
      createdBy !== actorId &&
      lastEditor !== actorId,
  };
}
async function lockedVersion(
  client: PoolClient,
  id: string,
  expected: number,
): Promise<Version> {
  if (id.length > 100) fail("Versão não encontrada.", 404);
  const parent = (
    await client.query("SELECT question_id FROM question_version WHERE id=$1", [
      id,
    ])
  ).rows[0];
  if (!parent) fail("Versão não encontrada.", 404);
  await client.query(
    "SELECT id FROM editorial_question WHERE id=$1 FOR UPDATE",
    [parent.question_id],
  );
  const row = (
    await client.query<Version>(
      `SELECT ${fields} FROM question_version v WHERE id=$1 FOR UPDATE`,
      [id],
    )
  ).rows[0];
  if (!row) fail("Versão não encontrada.", 404);
  if (row.revision !== expected)
    fail(
      "A versão mudou. Reabra antes de continuar; seu texto local foi preservado.",
      409,
    );
  return row;
}
async function options(client: PoolClient, id: string, choices: Option[]) {
  await client.query("DELETE FROM question_option WHERE question_id=$1", [id]);
  for (const [position, option] of choices.entries())
    await client.query(
      "INSERT INTO question_option(question_id,id,text,position) VALUES($1,$2,$3,$4)",
      [id, option.id, option.text, position],
    );
}
async function event(
  client: PoolClient,
  questionId: string,
  versionId: string,
  actorId: string,
  type: string,
  note: string | null = null,
) {
  await client.query(
    "INSERT INTO editorial_event(question_id,version_id,actor_id,event_type,note) VALUES($1,$2,$3,$4,$5)",
    [questionId, versionId, actorId, type, note],
  );
}
async function insertVersion(
  client: PoolClient,
  questionId: string,
  actorId: string,
  input: Content,
  sequence = 1,
  demonstration = false,
) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO question_version(id,question_id,version_number,title,topic,prompt,origin,editorial_status,author_credit,explanation,correct_option_id,created_by,last_editor_id,demonstration) VALUES($1,$2,$3,$4,$5,$6,'AUTHOR_CREATED','DRAFT',$7,$8,$9,$10,$10,$11)`,
    [
      id,
      questionId,
      sequence,
      input.title,
      input.topic,
      input.prompt,
      input.authorCredit,
      input.explanation,
      input.correctOptionId,
      actorId,
      demonstration,
    ],
  );
  await options(client, id, input.options);
  return id;
}

@Controller("api/curation")
export class CurationController {
  @Get("access") async access(@Req() req: any) {
    const user = await requireIdentity(req);
    const role = await db.query(
      "SELECT 1 FROM curator_role WHERE identity_id=$1",
      [user.id],
    );
    return { canCurate: !!user.email && !!role.rowCount };
  }
  @Get("questions") async queue(@Req() req: any) {
    const user = await curator(req);
    return (
      await db.query(
        `SELECT v.id,v.question_id AS "questionId",v.title,v.topic,v.origin,v.editorial_status AS "editorialStatus",v.version_number AS sequence,v.editorial_revision AS revision,v.author_credit AS "authorCredit",q.current_version_id AS "currentVersionId",COALESCE(v.created_by=$1,false) AS "isAuthor",(v.editorial_status='IN_REVIEW' AND v.created_by IS DISTINCT FROM $1::uuid AND v.last_editor_id IS DISTINCT FROM $1::uuid) AS "canReview" FROM editorial_question q JOIN LATERAL(SELECT * FROM question_version WHERE question_id=q.id ORDER BY version_number DESC LIMIT 1) v ON true ORDER BY v.title,q.id LIMIT 50`,
        [user.id],
      )
    ).rows;
  }
  @Get("versions/:id") async get(@Req() req: any, @Param("id") id: string) {
    const user = await curator(req);
    return detail(id, user.id);
  }
  @Post("questions") async create(@Req() req: any, @Body() body: unknown) {
    const input = content(object(body));
    return transaction(req, async (client, actor) => {
      const questionId = randomUUID();
      await client.query(
        "INSERT INTO editorial_question(id,origin) VALUES($1,'AUTHOR_CREATED')",
        [questionId],
      );
      const id = await insertVersion(client, questionId, actor, input);
      await event(client, questionId, id, actor, "CREATED");
      return detail(id, actor, client);
    });
  }
  @Put("versions/:id") async edit(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = object(body),
      expected = revision(input),
      values = content(input);
    return transaction(req, async (client, actor) => {
      const current = await lockedVersion(client, id, expected);
      if (!["DRAFT", "REJECTED"].includes(current.editorialStatus))
        fail("Só é possível editar rascunhos ou versões devolvidas.", 409);
      await client.query(
        `UPDATE question_version SET title=$2,topic=$3,prompt=$4,author_credit=$5,explanation=$6,correct_option_id=$7,last_editor_id=$8,reviewed_by=NULL,reviewed_at=NULL,editorial_status='DRAFT',editorial_revision=editorial_revision+1 WHERE id=$1`,
        [
          id,
          values.title,
          values.topic,
          values.prompt,
          values.authorCredit,
          values.explanation,
          values.correctOptionId,
          actor,
        ],
      );
      await options(client, id, values.options);
      await event(client, current.questionId, id, actor, "EDITED");
      return detail(id, actor, client);
    });
  }
  @Post("versions/:id/submit") @HttpCode(200) async submit(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const expected = revision(object(body));
    return transaction(req, async (client, actor) => {
      const current = await lockedVersion(client, id, expected);
      if (current.editorialStatus !== "DRAFT")
        fail("Apenas rascunhos podem ser enviados para revisão.", 409);
      await client.query(
        "UPDATE question_version SET editorial_status='IN_REVIEW',editorial_revision=editorial_revision+1 WHERE id=$1",
        [id],
      );
      await event(client, current.questionId, id, actor, "SUBMITTED");
      return detail(id, actor, client);
    });
  }
  @Post("versions/:id/review") @HttpCode(200) async review(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = object(body),
      expected = revision(input),
      note = text(input.note, "Parecer", 2000, 10);
    if (!["PUBLISH", "REJECT"].includes(input.decision as string))
      fail("Decisão de revisão inválida.", 400);
    if (input.decision === "PUBLISH") {
      const checklist = object(input.checklist);
      if (
        checklist.content !== true ||
        checklist.answer !== true ||
        checklist.credit !== true
      )
        fail(
          "Confira conteúdo, gabarito/explicação e crédito autoral antes de publicar.",
          400,
        );
    }
    return transaction(req, async (client, actor) => {
      const current = await lockedVersion(client, id, expected);
      if (current.editorialStatus !== "IN_REVIEW")
        fail("A versão não está aguardando revisão.", 409);
      if (current.createdBy === actor || current.lastEditor === actor)
        fail("Outra pessoa da curadoria deve revisar esta versão.", 403);
      const publish = input.decision === "PUBLISH";
      await client.query(
        "UPDATE question_version SET editorial_status=$2,reviewed_by=$3,reviewed_at=now(),editorial_revision=editorial_revision+1 WHERE id=$1",
        [id, publish ? "PUBLISHED" : "REJECTED", actor],
      );
      if (publish)
        await client.query(
          "UPDATE editorial_question SET current_version_id=$2 WHERE id=$1",
          [current.questionId, id],
        );
      await event(
        client,
        current.questionId,
        id,
        actor,
        publish ? "PUBLISHED" : "REJECTED",
        note,
      );
      return detail(id, actor, client);
    });
  }
  @Post("questions/:id/versions") async clone(
    @Req() req: any,
    @Param("id") questionId: string,
    @Body() body: unknown,
  ) {
    const input = object(body),
      base = text(input.baseCurrentVersionId, "Versão publicada", 100);
    if (questionId.length > 100) fail("Questão não encontrada.", 404);
    return transaction(req, async (client, actor) => {
      const parent = (
        await client.query(
          "SELECT current_version_id,origin FROM editorial_question WHERE id=$1 FOR UPDATE",
          [questionId],
        )
      ).rows[0];
      if (!parent) fail("Questão não encontrada.", 404);
      if (parent.origin !== "AUTHOR_CREATED")
        fail("Este fluxo aceita somente conteúdo autoral.", 400);
      if (parent.current_version_id !== base)
        fail("A publicação atual mudou. Atualize a fila.", 409);
      const open = await client.query(
        "SELECT 1 FROM question_version WHERE question_id=$1 AND editorial_status<>'PUBLISHED'",
        [questionId],
      );
      if (open.rowCount)
        fail("Já existe uma versão aberta para esta questão.", 409);
      const current = await detail(base, actor, client);
      const next = (
        await client.query(
          "SELECT max(version_number)+1 AS sequence FROM question_version WHERE question_id=$1",
          [questionId],
        )
      ).rows[0].sequence;
      const id = await insertVersion(
        client,
        questionId,
        actor,
        current as unknown as Content,
        next,
        current.demonstration === true,
      );
      await event(client, questionId, id, actor, "VERSION_CREATED");
      return detail(id, actor, client);
    });
  }
}
