import { Body, Controller, Get, Param, Put, Req } from "@nestjs/common";
import type { IncomingMessage } from "node:http";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";

type Reflection = { text: string; revision: number };

function versionId(value: string) {
  if (!/^[a-z0-9][a-z0-9_-]{0,199}$/i.test(value)) fail("Questão não encontrada.", 404);
  return value;
}

function draft(body: unknown): Reflection {
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).length !== 2 || !("text" in body) || !("revision" in body)
    || typeof body.text !== "string" || body.text.length > 600
    || typeof body.revision !== "number" || !Number.isInteger(body.revision)
    || body.revision < 0 || body.revision >= 1000000) return fail("Use até 600 caracteres para a reflexão.", 400);
  return { text: body.text.trim(), revision: body.revision };
}

@Controller("api/review/:version/reflection")
export class AnswerReflectionsController {
  @Get() async get(@Req() req: IncomingMessage, @Param("version") version: string) {
    const user = await requireIdentity(req);
    const row = (await db.query<Reflection>(
      `SELECT COALESCE(r.body,'') AS text,COALESCE(r.revision,0)::int AS revision
       FROM answer a LEFT JOIN answer_reflection r ON r.owner_id=a.owner_id AND r.version_id=a.question_id
       WHERE a.owner_id=$1 AND a.question_id=$2`, [user.id, versionId(version)],
    )).rows[0];
    return row ?? fail("Responda a questão antes de guardar uma reflexão.", 404);
  }

  @Put() async save(@Req() req: IncomingMessage, @Param("version") version: string, @Body() body: unknown) {
    const value = draft(body);
    const id = versionId(version);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const user = await requireIdentity(req, client, true);
      const answer = (await client.query<{ correct: boolean }>(
        `SELECT a.option_id=v.correct_option_id AS correct FROM answer a
         JOIN question_version v ON v.id=a.question_id
         WHERE a.owner_id=$1 AND a.question_id=$2 FOR UPDATE OF a`, [user.id, id],
      )).rows[0];
      if (!answer) fail("Responda a questão antes de guardar uma reflexão.", 404);
      if (answer.correct) fail("A reflexão acompanha uma resposta incorreta do estudo.", 409);
      const current = (await client.query<Reflection>(
        'SELECT body AS text,revision FROM answer_reflection WHERE owner_id=$1 AND version_id=$2', [user.id, id],
      )).rows[0] ?? { text: "", revision: 0 };
      const repeated = current.revision === value.revision + 1 && current.text === value.text;
      if (!repeated && current.revision !== value.revision)
        fail("A reflexão mudou em outra aba. Reabra a questão antes de editar.", 409);
      const saved = repeated ? current : (await client.query<Reflection>(
        `INSERT INTO answer_reflection(owner_id,version_id,body,revision) VALUES($1,$2,$3,$4)
         ON CONFLICT(owner_id,version_id) DO UPDATE SET body=EXCLUDED.body,
           revision=EXCLUDED.revision,updated_at=clock_timestamp()
         RETURNING body AS text,revision`, [user.id, id, value.text, value.revision + 1],
      )).rows[0];
      await client.query("COMMIT");
      return saved;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
}
