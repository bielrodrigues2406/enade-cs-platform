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
import { QuestionImportsController } from "./question-imports.js";
import { SourcesController } from "./sources.js";
import { ReviewController } from "./review.js";
import { CatalogController } from "./catalog.js";
import { PracticeController } from "./exam.js";
import {
  QuestionImagesController,
  imageView,
  versionImages,
} from "./question-images.js";
import { sourceById, publicExam } from "./source-store.js";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

async function published(id: string) {
  if (id.length > 100) fail("Questão não encontrada.", 404);
  const q = (
    await db.query<Question>(
      `SELECT id,title,topic,prompt,origin,author_credit AS "authorCredit",demonstration,version_number AS "versionNumber",explanation,explanation_credit AS "explanationCredit",exam_source_id AS "examSourceId",key_source_id AS "keySourceId",source_page AS "sourcePage",source_question_number AS "sourceQuestionNumber",key_page AS "keyPage",correct_option_id AS "correctOptionId",presentation,review_origin AS "reviewOrigin" FROM question_version WHERE id=$1 AND editorial_status='PUBLISHED'`,
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
async function feedback(
  answer: { optionId: string; revision: number },
  q: Question,
) {
  const key = q.keySourceId ? await sourceById(q.keySourceId) : null;
  // D10: diz se o gabarito se declara definitivo ou é o único publicado.
  const finality = key
    ? (
        await db.query<{ finality: string | null }>(
          "SELECT key_finality AS finality FROM source_document WHERE id=$1",
          [key.id],
        )
      ).rows[0].finality
    : null;
  return {
    explanationCredit: q.explanationCredit || q.authorCredit,
    ...(key
      ? {
          answerKey: {
            id: key.id,
            title: key.title,
            officialUrl: key.officialUrl,
            sha256: key.sha256,
            page: q.keyPage,
            finality,
          },
        }
      : {}),
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
      presentation: q.presentation,
      images: (await versionImages(q.id)).map(imageView),
      reviewOrigin: q.reviewOrigin,
      provenance: q.examSourceId
        ? {
            exam: publicExam(await sourceById(q.examSourceId)),
            page: q.sourcePage,
            questionNumber: q.sourceQuestionNumber,
          }
        : null,
      answer: answer ? await feedback(answer, q) : null,
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
          `INSERT INTO answer(owner_id,question_id,option_id,revision,updated_at) VALUES($1,$2,$3,$4,clock_timestamp()) ON CONFLICT(owner_id,question_id) DO UPDATE SET option_id=EXCLUDED.option_id,revision=EXCLUDED.revision,updated_at=clock_timestamp() RETURNING option_id AS "optionId",revision`,
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
@Module({
  controllers: [
    AuthController,
    StudyController,
    CurationController,
    QuestionImportsController,
    SourcesController,
    ReviewController,
    CatalogController,
    PracticeController,
    QuestionImagesController,
  ],
})
class AppModule {}
// Política para a aplicação web servida em produção: nenhum script, estilo
// ou fonte de terceiros e nenhum conteúdo inline (o build não gera inline).
const WEB_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
const API_CSP = "default-src 'none'; frame-ancestors 'none'";

// Erro de configuração cuja mensagem é segura para exibir ao iniciar.
export class ConfigError extends Error {}

// Número de proxies reversos confiáveis à frente da API. Sem isso, atrás de
// um proxy todos os acessos teriam o mesmo IP e o limite de login seria global.
function trustedProxyHops() {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === "") return 0;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0 || hops > 3)
    throw new ConfigError("TRUST_PROXY deve ser um inteiro de 0 a 3.");
  return hops;
}
function webRoot() {
  const dir = process.env.WEB_DIST;
  if (!dir) return null;
  const root = resolve(dir);
  if (!existsSync(join(root, "index.html")))
    throw new ConfigError("WEB_DIST não contém index.html.");
  return root;
}
export async function createApp() {
  const production = process.env.NODE_ENV === "production";
  if (production && !/^https:\/\/[^/]+$/.test(process.env.APP_ORIGIN || ""))
    throw new ConfigError(
      "APP_ORIGIN deve ser a origem HTTPS pública em produção.",
    );
  const hops = trustedProxyHops();
  const web = webRoot();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn"],
    bodyParser: false,
  });
  if (hops) app.set("trust proxy", hops);
  app.disable("x-powered-by");
  app.use((req: any, res: any, next: any) => {
    const api = req.path === "/api" || req.path.startsWith("/api/");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
    res.setHeader("Content-Security-Policy", api ? API_CSP : WEB_CSP);
    if (production)
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    if (api) res.setHeader("Cache-Control", "no-store");
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
  if (web) {
    app.useStaticAssets(web, {
      index: false,
      setHeaders: (res: any, path: string) =>
        res.setHeader(
          "Cache-Control",
          /-[A-Z0-9]{8}\.(?:js|css|woff2)$/.test(path)
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        ),
    });
    // Rotas da aplicação web caem no index.html; arquivos inexistentes e a API
    // seguem para o 404 normal.
    app.use((req: any, res: any, next: any) => {
      if (
        !["GET", "HEAD"].includes(req.method) ||
        req.path === "/api" ||
        req.path.startsWith("/api/") ||
        /\.[a-z0-9]+$/i.test(req.path)
      )
        return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(join(web, "index.html"));
    });
  }
  await app.init();
  return app;
}
