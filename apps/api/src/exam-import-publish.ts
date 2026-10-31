import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { storeAsset } from "./question-images.js";
import { sourcePath } from "./source-store.js";

// Publicação de uma importação conferida (IMP-1): recorta as caixas
// confirmadas em 200 dpi, registra prova e gabarito como fontes conferidas na
// importação e cria uma versão publicada por questão. Quem confirmou na tela
// fica registrado como revisor (revisão IMPORT).

const run = promisify(execFile);
const CROP_DPI = 200;
type Box = { page: number; x0: number; y0: number; x1: number; y1: number };
type Item = { key: string; number: number; answer: string; boxes: Box[]; prompt: string;
  options: { letter: string; text: string }[]; area: string; subject: string | null; confirmedBy: string };

async function renderCrop(pdf: string, box: Box, work: string) {
  const px = (value: number) => Math.round((value * CROP_DPI) / 72);
  const base = path.join(work, randomUUID());
  await run("pdftoppm", ["-r", String(CROP_DPI), "-f", String(box.page), "-l", String(box.page),
    "-x", String(px(box.x0)), "-y", String(px(box.y0)), "-W", String(px(box.x1) - px(box.x0)),
    "-H", String(px(box.y1) - px(box.y0)), "-png", "-singlefile", pdf, base], { timeout: 30000 });
  await run("convert", [`${base}.png`, "-strip", "-define", "webp:lossless=true", `${base}.webp`], { timeout: 30000 });
  return readFile(`${base}.webp`);
}

async function pageCount(pdf: string) {
  const { stdout } = await run("pdfinfo", [pdf], { timeout: 15000 });
  return Number(/^Pages:\s+(\d+)/m.exec(stdout)?.[1] ?? 0);
}

/** Registra (ou reaproveita) a fonte conferida pela importação. */
async function source(client: PoolClient, batch: any, kind: "EXAM" | "ANSWER_KEY", admin: string) {
  const sha256 = kind === "EXAM" ? batch.exam_sha256 : batch.key_sha256;
  const existing = (await client.query("SELECT id,status FROM source_document WHERE sha256=$1", [sha256])).rows[0];
  if (existing) {
    if (existing.status !== "VERIFIED") fail("Este PDF já está cadastrado como fonte ainda não conferida.", 409);
    return existing.id as string;
  }
  const file = sourcePath(sha256);
  const id = randomUUID();
  const label = kind === "EXAM" ? "Prova" : "Gabarito";
  await client.query(
    `INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,
       status,verification_origin,imported_by,last_editor_id,reviewed_by,reviewed_at,is_final,key_finality)
     VALUES($1,$2,$3,$4,$5,'Ciência da Computação',$6,$7,$8,$9,'VERIFIED','IMPORT',$10,$10,$10,now(),$11,$12)`,
    [id, `ENADE ${batch.year} · ${batch.modality.toLowerCase()} · ${label}`,
      kind === "EXAM" ? batch.exam_url : batch.key_url, kind, batch.year, batch.modality, sha256,
      (await readFile(file)).length, await pageCount(file), admin, kind === "ANSWER_KEY",
      kind === "ANSWER_KEY" ? "DECLARED" : null],
  );
  return id;
}

async function publishItem(client: PoolClient, batch: any, item: Item, ids: { exam: string; key: string }, work: string) {
  const questionId = `official-${batch.exam_sha256.slice(0, 12)}-${item.key.toLowerCase()}`;
  const parent = await client.query(
    `INSERT INTO editorial_question(id,origin,official_exam_id,official_question_number) VALUES($1,'OFFICIAL',$2,$3)
     ON CONFLICT(id) DO NOTHING RETURNING id`, [questionId, ids.exam, item.number],
  );
  if (!parent.rowCount) return false; // já publicada antes: não duplica
  const images = [];
  for (const box of item.boxes)
    images.push({ box, ...(await storeAsset(client, await renderCrop(sourcePath(batch.exam_sha256), box, work))) });
  const versionId = `${questionId}-v1`;
  const title = batch.modality === "LICENCIATURA"
    ? `ENADE ${batch.year} · Licenciatura · Questão ${item.number}` : `ENADE ${batch.year} · Questão ${item.number}`;
  await client.query(
    `INSERT INTO question_version(id,question_id,version_number,title,topic,subject,prompt,origin,editorial_status,explanation,
       correct_option_id,author_credit,explanation_credit,exam_source_id,key_source_id,source_page,source_question_number,key_page,
       presentation,review_origin,created_by,last_editor_id)
     VALUES($1,$2,1,$3,$4,$5,$6,'OFFICIAL','DRAFT','',$7,'Inep','Sem explicação ainda',$8,$9,$10,$11,1,'IMAGE','IMPORT',$12,$12)`,
    [versionId, questionId, title, item.area, item.subject, item.prompt, item.answer, ids.exam, ids.key,
      item.boxes[0].page, item.number, item.confirmedBy],
  );
  const transcription = new Map(item.options.map((option) => [option.letter, option.text]));
  for (const [position, letter] of [..."ABCDE"].entries())
    await client.query("INSERT INTO question_option(question_id,id,text,position) VALUES($1,$2,$3,$4)",
      [versionId, letter, transcription.get(letter) ?? "", position]);
  for (const [index, image] of images.entries())
    await client.query(
      "INSERT INTO question_version_image(version_id,position,asset_sha256,source_page,box,dpi) VALUES($1,$2,$3,$4,$5,$6)",
      [versionId, index + 1, image.sha256, image.box.page, [image.box.x0, image.box.y0, image.box.x1, image.box.y1], CROP_DPI],
    );
  await client.query(
    "UPDATE question_version SET editorial_status='PUBLISHED',reviewed_by=$2,reviewed_at=clock_timestamp() WHERE id=$1",
    [versionId, item.confirmedBy],
  );
  await client.query("UPDATE editorial_question SET current_version_id=$2 WHERE id=$1", [questionId, versionId]);
  await client.query(
    `INSERT INTO editorial_event(question_id,version_id,actor_id,event_type,note)
     VALUES($1,$2,$3,'PUBLISHED','Importada do PDF oficial e conferida na tela de importação.')`,
    [questionId, versionId, item.confirmedBy],
  );
  return true;
}

export async function publishImport(id: string, admin: string) {
  const client = await db.connect();
  const work = await mkdtemp(path.join(tmpdir(), "enade-import-publish-"));
  try {
    await client.query("BEGIN");
    const batch = (await client.query("SELECT * FROM exam_import WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (batch.state !== "READY") fail("Esta importação não está pronta para publicar.", 409);
    const items = (await client.query<Item>(
      `SELECT question_key AS key,number,answer,boxes,prompt,options,area,subject,confirmed_by AS "confirmedBy"
       FROM exam_import_item WHERE import_id=$1 AND status='CONFIRMED' ORDER BY number`, [id],
    )).rows;
    if (!items.length) fail("Confirme pelo menos uma questão antes de publicar.", 409);
    const ids = { exam: await source(client, batch, "EXAM", admin), key: await source(client, batch, "ANSWER_KEY", admin) };
    let published = 0;
    for (const item of items) if (await publishItem(client, batch, item, ids, work)) published++;
    const open = await client.query("SELECT 1 FROM exam_import_item WHERE import_id=$1 AND status='PENDING' LIMIT 1", [id]);
    if (!open.rowCount) await client.query("UPDATE exam_import SET state='PUBLISHED',updated_at=now() WHERE id=$1", [id]);
    await client.query("COMMIT");
    return { published, alreadyPublished: items.length - published };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await rm(work, { recursive: true, force: true });
  }
}
