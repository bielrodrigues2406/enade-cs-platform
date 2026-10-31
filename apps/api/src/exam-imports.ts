import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, Res, UploadedFiles, UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { AREAS } from "./question-areas.js";
import { requireRole } from "./roles.js";
import { sourcePath, validateOfficialUrl } from "./source-store.js";
import { publishImport } from "./exam-import-publish.js";

// Importação de provas futuras (IMP-1). Quem administra envia prova,
// gabarito e, se houver discursivas, o padrão de resposta; o processo `scripts/import-exam.mjs` propõe as caixas; a pessoa
// confere e ajusta cada questão na tela; só o confirmado é publicado.

const run = promisify(execFile);
const MAX_PDF = 10 * 1024 * 1024;
const PAGE_DPI = 100; // pré-visualização no editor; o recorte final usa 200 dpi
const MODALITIES = ["BACHARELADO", "LICENCIATURA", "CST", "COMUM"];
const ID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export type Box = { page: number; x0: number; y0: number; x1: number; y1: number };
type Upload = { buffer: Buffer; size: number };
type PageSize = { width: number; height: number };
export type Criterion = { label: string | null; points: number };

export async function archivePdf(bytes: Buffer) {
  if (bytes.length < 5 || bytes.length > MAX_PDF || bytes.subarray(0, 5).toString() !== "%PDF-")
    fail("Envie arquivos PDF de até 10 MB.", 400);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const file = sourcePath(sha256);
  if (!(await stat(file).catch(() => null))) {
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  return sha256;
}

/** Processo separado: o servidor responde na hora e o lote fica em PROCESSING. */
function startExtraction(id: string) {
  const worker = path.resolve("scripts/import-exam.mjs");
  spawn(process.execPath, [worker, id], { detached: true, stdio: "ignore", env: process.env }).unref();
}

async function batch(id: string) {
  if (!ID.test(id)) fail("Importação não encontrada.", 404);
  const row = (await db.query(
    `SELECT id,year,modality,exam_url AS "examUrl",key_url AS "keyUrl",exam_sha256 AS "examSha256",
       page_count AS "pageCount",page_sizes AS "pageSizes",state,failure,issues,created_at AS "createdAt",
       standard_url AS "standardUrl",standard_sha256 AS "standardSha256",standard_page_sizes AS "standardPageSizes"
     FROM exam_import WHERE id=$1`, [id],
  )).rows[0];
  return row ?? fail("Importação não encontrada.", 404);
}

export function validBoxes(value: unknown, pageSizes: PageSize[]): Box[] {
  if (!Array.isArray(value) || value.length > 10) fail("Caixas inválidas.", 400);
  return (value as Record<string, unknown>[]).map((box) => {
    const page = Number(box?.page);
    const size = pageSizes[page - 1];
    const [x0, y0, x1, y1] = ["x0", "y0", "x1", "y1"].map((k) => Math.round(Number(box?.[k]) * 100) / 100);
    if (!size || ![x0, y0, x1, y1].every(Number.isFinite) || x0 < 0 || y0 < 0 ||
      x1 - x0 < 10 || y1 - y0 < 10 || x1 > size.width + 0.5 || y1 > size.height + 0.5)
      fail("Caixa fora da página ou pequena demais.", 400);
    return { page, x0, y0, x1, y1 };
  });
}

/** Itens de avaliação de uma discursiva: rótulos a–f distintos (ou um só sem rótulo), 0,5 a 10 pontos. */
export function validCriteria(value: unknown): Criterion[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) fail("Informe de 1 a 6 itens de avaliação.", 400);
  const criteria = (value as Record<string, unknown>[]).map((item) => {
    const label = item?.label === null || item?.label === undefined || item?.label === "" ? null : String(item.label).toLowerCase();
    const points = Math.round(Number(item?.points) * 100) / 100;
    if ((label !== null && !/^[a-f]$/.test(label)) || !(points >= 0.5 && points <= 10)) fail("Item de avaliação inválido.", 400);
    return { label, points };
  });
  const labels = criteria.map((c) => c.label);
  if (new Set(labels).size !== labels.length || (labels.includes(null) && labels.length > 1))
    fail("Use rótulos diferentes (a, b, c…) ou um único item sem rótulo.", 400);
  return criteria;
}

@Controller("api/imports")
export class ExamImportsController {
  @Get() async list(@Req() req: any) {
    await requireRole(req, "ADMIN");
    return (await db.query(
      `SELECT i.id,i.year,i.modality,i.state,i.failure,i.created_at AS "createdAt",
         count(t.*)::int AS total,
         count(t.*) FILTER (WHERE t.status='CONFIRMED')::int AS confirmed,
         count(t.*) FILTER (WHERE t.status='EXCLUDED')::int AS excluded
       FROM exam_import i LEFT JOIN exam_import_item t ON t.import_id=i.id
       GROUP BY i.id ORDER BY i.created_at DESC LIMIT 50`,
    )).rows;
  }

  @Post() @HttpCode(201)
  @UseInterceptors(FileFieldsInterceptor(
    [{ name: "exam", maxCount: 1 }, { name: "key", maxCount: 1 }, { name: "standard", maxCount: 1 }],
    { limits: { fileSize: MAX_PDF, files: 3, fields: 7 } }))
  async create(@Req() req: any, @UploadedFiles() files: { exam?: Upload[]; key?: Upload[]; standard?: Upload[] }, @Body() body: any) {
    const admin = await requireRole(req, "ADMIN");
    const year = Number(body?.year);
    if (!Number.isInteger(year) || year < 2004 || year > 2100) fail("Ano inválido.", 400);
    if (!MODALITIES.includes(body?.modality)) fail("Modalidade inválida.", 400);
    const examUrl = validateOfficialUrl(String(body?.examUrl ?? ""));
    const keyUrl = validateOfficialUrl(String(body?.keyUrl ?? ""));
    const exam = files?.exam?.[0], key = files?.key?.[0];
    if (!exam || !key) fail("Envie o PDF da prova e o do gabarito.", 400);
    const [examSha256, keySha256] = [await archivePdf(exam!.buffer), await archivePdf(key!.buffer)];
    if (examSha256 === keySha256) fail("Prova e gabarito são o mesmo arquivo.", 400);
    // Padrão de resposta das discursivas: opcional, mas arquivo e link vêm juntos.
    const standard = files?.standard?.[0];
    if (Boolean(standard) !== Boolean(body?.standardUrl)) fail("Envie o PDF do padrão de resposta junto com o link dele.", 400);
    const standardUrl = standard ? validateOfficialUrl(String(body.standardUrl)) : null;
    const standardSha256 = standard ? await archivePdf(standard.buffer) : null;
    if (standardSha256 && [examSha256, keySha256].includes(standardSha256)) fail("O padrão de resposta repete outro arquivo.", 400);
    const id = randomUUID();
    await db.query(
      `INSERT INTO exam_import(id,year,modality,exam_url,key_url,exam_sha256,key_sha256,standard_url,standard_sha256,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, year, body.modality, examUrl, keyUrl, examSha256, keySha256, standardUrl, standardSha256, admin.id],
    );
    startExtraction(id);
    return { id, state: "PROCESSING" };
  }

  @Get(":id") async get(@Req() req: any, @Param("id") id: string) {
    await requireRole(req, "ADMIN");
    const row = await batch(id);
    const items = (await db.query(
      `SELECT question_key AS key,number,kind,answer,key_answer AS "keyAnswer",answer_note AS "answerNote",
         boxes,prompt,options,status,area,subject,warnings,revision,
         standard_boxes AS "standardBoxes",criteria,
         -- Questão desta prova que já está no ar (publicada antes, por outro caminho).
         EXISTS(SELECT 1 FROM editorial_question q JOIN source_document s ON s.id=q.official_exam_id
                WHERE s.sha256=$2 AND q.official_question_number=t.number AND t.kind='OBJECTIVE') AS "alreadyPublished"
       FROM exam_import_item t WHERE import_id=$1 ORDER BY kind DESC,number`, [id, row.examSha256],
    )).rows;
    const { standardSha256, ...visible } = row;
    return { ...visible, hasStandard: Boolean(standardSha256), areas: AREAS, items };
  }

  // Página renderizada para o editor de caixas (prova ou, com ?doc=standard,
  // padrão de resposta); guardada em cache temporário.
  @Get(":id/pages/:page") async page(@Req() req: any, @Res() res: any, @Param("id") id: string,
    @Param("page") pageParam: string, @Query("doc") doc?: string) {
    await requireRole(req, "ADMIN");
    const row = await batch(id);
    const standard = doc === "standard";
    const sha256: string | null = standard ? row.standardSha256 : row.examSha256;
    const count = standard ? (row.standardPageSizes?.length ?? 0) : (row.pageCount ?? 0);
    const page = Number(pageParam);
    if (!sha256 || !Number.isInteger(page) || page < 1 || page > count) fail("Página inválida.", 404);
    const cache = path.join(tmpdir(), "enade-import-pages", `${sha256}-${page}`);
    if (!(await stat(`${cache}.png`).catch(() => null))) {
      await mkdir(path.dirname(cache), { recursive: true });
      await run("pdftoppm", ["-png", "-r", String(PAGE_DPI), "-f", String(page), "-l", String(page),
        "-singlefile", sourcePath(sha256!), cache], { timeout: 30000 });
    }
    const bytes = await readFile(`${cache}.png`);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.end(bytes);
  }

  // Ajuste de uma questão: caixas, situação, área e assunto; na objetiva, a
  // letra do gabarito; na discursiva, as caixas do padrão e os itens. Revisão otimista.
  @Put(":id/items/:key") async edit(@Req() req: any, @Param("id") id: string, @Param("key") key: string, @Body() body: any) {
    const admin = await requireRole(req, "ADMIN");
    const row = await batch(id);
    if (row.state !== "READY") fail("Esta importação não está aberta para ajustes.", 409);
    const item = (await db.query("SELECT kind FROM exam_import_item WHERE import_id=$1 AND question_key=$2", [id, key])).rows[0];
    if (!item) fail("Questão não encontrada.", 404);
    const discursive = item.kind === "DISCURSIVE";
    const boxes = validBoxes(body?.boxes, row.pageSizes ?? []);
    const status = body?.status;
    if (!["PENDING", "CONFIRMED", "EXCLUDED"].includes(status)) fail("Situação inválida.", 400);
    const area = body?.area ? String(body.area) : null;
    if (area && !(AREAS as readonly string[]).includes(area)) fail("Área fora da lista.", 400);
    const subject = typeof body?.subject === "string" && body.subject.trim() ? body.subject.trim().slice(0, 80) : null;
    // Letra do gabarito: pode ser corrigida (inclusive para ANULADA), com justificativa.
    const answer = discursive ? null : body?.answer ?? null;
    if (answer !== null && !["A", "B", "C", "D", "E", "ANULADA"].includes(answer)) fail("Letra do gabarito inválida.", 400);
    const answerNote = typeof body?.answerNote === "string" && body.answerNote.trim() ? body.answerNote.trim().slice(0, 500) : null;
    if (answerNote && answerNote.length < 5) fail("Explique a troca do gabarito em pelo menos 5 caracteres.", 400);
    const standardBoxes = discursive ? validBoxes(body?.standardBoxes ?? [], row.standardPageSizes ?? []) : [];
    const criteria = discursive && body?.criteria !== undefined ? validCriteria(body.criteria) : [];
    if (status === "CONFIRMED" && (!area || !boxes.length))
      fail("Para confirmar, informe a área e pelo menos uma caixa.", 400);
    if (status === "CONFIRMED" && discursive && (!standardBoxes.length || !criteria.length))
      fail("Para confirmar a discursiva, marque a caixa do padrão de resposta e os itens de avaliação.", 400);
    const updated = await db.query(
      `UPDATE exam_import_item SET boxes=$3,status=$4,area=$5,subject=$6,revision=revision+1,
         answer=$9,answer_note=CASE WHEN $9 IS NOT DISTINCT FROM key_answer THEN NULL ELSE $10 END,
         standard_boxes=$11,criteria=CASE WHEN kind='DISCURSIVE' AND $12::jsonb <> '[]' THEN $12::jsonb ELSE criteria END,
         confirmed_by=CASE WHEN $4='CONFIRMED' THEN $7::uuid END,
         confirmed_at=CASE WHEN $4='CONFIRMED' THEN now() END
       WHERE import_id=$1 AND question_key=$2 AND revision=$8
         AND ($4<>'CONFIRMED' OR kind='DISCURSIVE' OR $9 IN ('A','B','C','D','E'))
         AND ($9 IS NOT DISTINCT FROM key_answer OR $10::text IS NOT NULL)
       RETURNING revision`,
      [id, key, JSON.stringify(boxes), status, area, subject, admin.id, Number(body?.revision), answer, answerNote,
        JSON.stringify(standardBoxes), JSON.stringify(criteria)],
    );
    if (!updated.rowCount)
      fail("Não foi possível salvar: a questão mudou em outra aba, está anulada ou a troca de letra está sem justificativa.", 409);
    return { revision: updated.rows[0].revision };
  }

  @Post(":id/publish") @HttpCode(200) async publish(@Req() req: any, @Param("id") id: string) {
    const admin = await requireRole(req, "ADMIN");
    await batch(id);
    return publishImport(id, admin.id);
  }
}
