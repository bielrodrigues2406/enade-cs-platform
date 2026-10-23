import "reflect-metadata";
import "dotenv/config";
import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { db, type Answer, type Question } from "./database.js";
export { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";
import { AuthController } from "./auth.js";
import { CurationController } from "./curation.js";

async function published(id: string) {
  if (id.length > 100) fail("Questão não encontrada.", 404);
  const q = (
    await db.query<Question>(
      `SELECT id,title,topic,prompt,origin,author_credit AS "authorCredit",demonstration,version_number AS "versionNumber",explanation,correct_option_id AS "correctOptionId" FROM question_version WHERE id=$1 AND editorial_status='PUBLISHED'`,
      [id],
    )
  ).rows[0];
  if (!q) fail("Questão não encontrada.", 404);
  q.options = (
    await db.query<{ id: string; text: string }>(
      "SELECT id,text FROM question_option WHERE question_id=$1 ORDER BY position",
      [id],
    )
  ).rows;
  return q;
}
function feedback(
  answer: { optionId: string; revision: number },
  q: { correctOptionId: string; explanation: string },
) {
  return {
    optionId: answer.optionId,
    revision: answer.revision,
    correct: answer.optionId === q.correctOptionId,
    correctOptionId: q.correctOptionId,
    explanation: q.explanation,
  };
}
@Controller("api")
class StudyController {
  @Get("health") async health() {
    await db.query("SELECT 1");
    return { status: "ok", database: "ok" };
  }

  @Get("questions") async catalog(
    @Req() req: any,
    @Query("q") search = "",
    @Query("topic") topic = "",
  ) {
    const user = await requireIdentity(req);
    if (
      typeof search !== "string" ||
      typeof topic !== "string" ||
      search.length > 120 ||
      topic.length > 80
    )
      fail("Filtro inválido.", 400);
    return (
      await db.query(
        `SELECT q.id,q.title,q.topic,q.origin,q.demonstration,q.version_number AS "versionNumber",EXISTS(SELECT 1 FROM answer a WHERE a.question_id=q.id AND a.owner_id=$1) AS answered FROM editorial_question c JOIN question_version q ON q.id=c.current_version_id WHERE editorial_status='PUBLISHED' AND ($2='' OR topic=$2) AND ($3='' OR strpos(lower(title),lower($3)) > 0 OR strpos(lower(prompt),lower($3)) > 0) ORDER BY q.id LIMIT 50`,
        [user.id, topic, search],
      )
    ).rows;
  }

  @Get("questions/:id") async question(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const user = await requireIdentity(req);
    const q = await published(id);
    const answer = (
      await db.query<Answer>(
        'SELECT option_id AS "optionId",revision FROM answer WHERE owner_id=$1 AND question_id=$2',
        [user.id, id],
      )
    ).rows[0];
    return {
      id: q.id,
      title: q.title,
      topic: q.topic,
      prompt: q.prompt,
      origin: q.origin,
      authorCredit: q.authorCredit,
      demonstration: q.demonstration,
      versionNumber: q.versionNumber,
      options: q.options.map(({ id, text }) => ({ id, text })),
      answer: answer ? feedback(answer, q) : null,
    };
  }

  @Put("questions/:id/answer") async answer(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const user = await requireIdentity(req);
    const q = await published(id);
    if (!body || typeof body !== "object") fail("Resposta inválida.", 400);
    const { optionId, baseRevision } = body as Record<string, unknown>;
    if (
      typeof optionId !== "string" ||
      !q.options.some((o) => o.id === optionId) ||
      !Number.isSafeInteger(baseRevision) ||
      (baseRevision as number) < 0 ||
      (baseRevision as number) > 1000000
    )
      fail("Alternativa ou revisão inválida.", 400);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      // Recheck and lock the credential so logout and answer writes serialize.
      await requireIdentity(req, client, true);
      // Serialize writes for this study owner; revisions reject outdated operations.
      await client.query(
        "SELECT id FROM study_identity WHERE id=$1 FOR UPDATE",
        [user.id],
      );
      const previous = (
        await client.query<Answer>(
          'SELECT option_id AS "optionId",revision FROM answer WHERE owner_id=$1 AND question_id=$2',
          [user.id, id],
        )
      ).rows[0];
      if (
        previous &&
        previous.revision === (baseRevision as number) + 1 &&
        previous.optionId === optionId
      ) {
        await client.query("COMMIT");
        return feedback(previous, q);
      }
      if ((previous?.revision || 0) !== baseRevision)
        fail(
          "A resposta mudou em outra aba. Reabra a questão antes de responder.",
          409,
        );
      const result = (
        await client.query<Answer>(
          `INSERT INTO answer(owner_id,question_id,option_id,revision) VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,question_id) DO UPDATE SET option_id=EXCLUDED.option_id,revision=EXCLUDED.revision,updated_at=now() RETURNING option_id AS "optionId",revision`,
          [user.id, id, optionId, (baseRevision as number) + 1],
        )
      ).rows[0];
      await client.query("COMMIT");
      return feedback(result, q);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
@Module({ controllers: [AuthController, StudyController, CurationController] })
class AppModule {}
export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn"],
    bodyParser: false,
  });
  app.use((req: any, res: any, next: any) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== (process.env.APP_ORIGIN || "http://localhost:4200")
    )
      return res.status(403).json({ message: "Origem não autorizada." });
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !req.is("application/json")
    ) {
      return res
        .status(415)
        .json({ message: "Envie os dados em formato JSON." });
    }
    next();
  });
  app.useBodyParser("json", {
    limit: "64kb",
    type: (req: any) =>
      /^\/api\/curation(?:\/|$)/.test(req.url || "") &&
      !!req.is("application/json"),
  });
  app.useBodyParser("json", { limit: "16kb" });
  await app.init();
  return app;
}
