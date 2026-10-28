import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CatalogDocument } from "../apps/api/src/source-catalog.js";

// Fixtures sintéticos (PDFs e imagens mínimos, marcados TEST ONLY): exercitam
// o caminho ASSISTED no PostgreSQL real; nada aqui é conteúdo do Inep.
const archiveDir = await mkdtemp(path.join(tmpdir(), "enade-assisted-src-"));
const assetDir = await mkdtemp(path.join(tmpdir(), "enade-assisted-img-"));
process.env.SOURCE_ARCHIVE_DIR = archiveDir;
process.env.QUESTION_ASSET_DIR = assetDir;
const { createApp, db } = await import("../apps/api/src/main.js");
const { publishAssisted } = await import("../apps/api/src/assisted-publication.js");

const WHITE = Buffer.from("UklGRh4AAABXRUJQVlA4TBEAAAAvAkAAAAfQ//73v/+BiOh/AAA=", "base64");
const BLACK = Buffer.from("UklGRhoAAABXRUJQVlA4TA4AAAAvAQABAAcQEf0PRET/Aw==", "base64");
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
type Fixture = CatalogDocument & { sourceId: string; sha256: string };
const sources: Fixture[] = [];
let app: Awaited<ReturnType<typeof createApp>>, base: string, student: string;

before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  const guest = await fetch(`${base}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  student = guest.headers.get("set-cookie")!.split(";")[0];
});
after(async () => {
  try {
    const ids = sources.map((s) => s.sourceId);
    await db.query(
      "DELETE FROM answer WHERE question_id IN (SELECT v.id FROM question_version v JOIN editorial_question q ON q.id=v.question_id WHERE q.official_exam_id=ANY($1::uuid[]))",
      [ids],
    );
    await db.query("DELETE FROM editorial_question WHERE official_exam_id=ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM question_asset WHERE sha256=ANY($1)", [[sha(WHITE), sha(BLACK)]]);
  } finally {
    await app?.close();
    await db.end();
    await rm(archiveDir, { recursive: true, force: true });
    await rm(assetDir, { recursive: true, force: true });
  }
});

async function source(kind: string): Promise<Fixture> {
  const sourceId = randomUUID();
  const bytes = Buffer.from(`%PDF-1.7\n% TEST ONLY assisted publication fixture ${sourceId}\n%%EOF\n`);
  const fixture: Fixture = {
    id: `test-only-${sourceId}`, sourceId, kind, sha256: sha(bytes), year: 2008,
    area: "TEST ONLY Computação", modality: "COMUM", byteSize: bytes.length, pageCount: 2,
    officialUrl: `https://download.inep.gov.br/enade/test-only/${sourceId}.pdf`,
  };
  await writeFile(path.join(archiveDir, `${fixture.sha256}.pdf`), bytes, { flag: "wx" });
  await db.query(
    "INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [sourceId, `TEST ONLY ${sourceId}`, fixture.officialUrl, kind, fixture.year, fixture.area, fixture.modality, fixture.sha256, bytes.length, 2],
  );
  sources.push(fixture);
  return fixture;
}

async function scenario(definitive = false) {
  const exam = await source("EXAM");
  const key = await source("ANSWER_KEY");
  const crops: Record<string, Buffer> = { "Q1-1.webp": WHITE, "Q1-2.webp": BLACK, "Q2-1.webp": BLACK };
  const fragment = (file: string, page: number) => ({
    file, page, box: { x0: 30, y0: 60, x1: 300, y1: 400 }, width: 3, height: 2, byteSize: crops[file].length, sha256: sha(crops[file]),
  });
  const manifest = {
    document: exam.id, examSha256: exam.sha256, renderer: { dpi: 200 },
    items: [
      { key: "Q1", number: 1, kind: "OBJECTIVE", fragments: [fragment("Q1-1.webp", 1), fragment("Q1-2.webp", 2)] },
      { key: "Q2", number: 2, kind: "OBJECTIVE", fragments: [fragment("Q2-1.webp", 2)] },
    ],
  };
  const item = (n: number, answer: string) => ({
    key: `Q${n}`, kind: "OBJECTIVE", number: n, block: "COMPONENTE_ESPECIFICO", pages: [1], status: "sem-gabarito-definitivo", flags: [],
    answer, prompt: `TEST ONLY: transcrição sintética da questão ${n}.`,
    options: [{ letter: "A", text: "TEST ONLY a" }, { letter: "B", text: "TEST ONLY b" }],
    source: { examId: exam.id, examSha256: exam.sha256, answerKeyId: key.id, answerKeySha256: key.sha256, answerKeyDefinitive: definitive, answerKeyPage: 1 },
  });
  const report = { document: exam.id, completeness: { missing: [], unexpected: [] }, items: [item(1, "C"), item(2, "B")] };
  const manifestSha256 = sha(JSON.stringify(manifest));
  const review = {
    document: exam.id, examSha256: exam.sha256, cropsManifestSha256: manifestSha256,
    reviewer: "codex", extractor: "claude", reviewedAt: "2026-10-29T12:00:00Z",
    items: [
      { key: "Q1", verdict: "APPROVED", fragments: manifest.items[0].fragments.map((f) => f.sha256), answer: "C", optionCount: 5, area: "Redes", notes: "TEST ONLY" },
      { key: "Q2", verdict: "BLOCKED", reason: "TEST ONLY: recorte sem a alternativa E" },
    ],
  };
  const input = {
    report, manifest, manifestSha256, review,
    readCrop: async (file: string) => crops[file],
    finality: { documents: { [key.id]: { finality: "ONLY_PUBLISHED" } } },
    catalog: [exam, key],
  };
  return { exam, key, input };
}

test("approved items are published from their image with agents recorded and no human account", async () => {
  const { exam, key, input } = await scenario();
  const summary = await publishAssisted(input);
  assert.deepEqual(summary.published, ["Q1"]);
  assert.deepEqual(summary.blocked.map((b) => b.key), ["Q2"]);
  assert.deepEqual(summary.rejected, []);

  const version = (await db.query(
    `SELECT v.*,q.current_version_id FROM question_version v JOIN editorial_question q ON q.id=v.question_id WHERE q.official_exam_id=$1`,
    [exam.sourceId],
  )).rows;
  assert.equal(version.length, 1);
  const [v] = version;
  assert.equal(v.editorial_status, "PUBLISHED");
  assert.equal(v.current_version_id, v.id);
  assert.deepEqual([v.presentation, v.review_origin, v.assisted_extractor, v.assisted_reviewer], ["IMAGE", "ASSISTED", "claude", "codex"]);
  assert.equal(v.reviewed_by, null);
  assert.equal(v.created_by, null);
  assert.equal(v.correct_option_id, "C");
  assert.equal(v.topic, "Redes");
  const events = (await db.query("SELECT actor_id,agent,event_type FROM editorial_event WHERE version_id=$1 ORDER BY id", [v.id])).rows;
  assert.deepEqual(events.map((e) => [e.actor_id, e.agent, e.event_type]), [[null, "claude", "CREATED"], [null, "codex", "PUBLISHED"]]);
  const sourcesAfter = (await db.query(
    "SELECT kind,status,verification_origin,assisted_verifier,reviewed_by,is_final,key_finality FROM source_document WHERE id=ANY($1::uuid[]) ORDER BY kind",
    [[exam.sourceId, key.sourceId]],
  )).rows;
  assert.deepEqual(sourcesAfter.map((s) => [s.kind, s.status, s.verification_origin, s.assisted_verifier, s.reviewed_by, s.is_final, s.key_finality]), [
    ["ANSWER_KEY", "VERIFIED", "ASSISTED", "codex", null, true, "ONLY_PUBLISHED"],
    ["EXAM", "VERIFIED", "ASSISTED", "codex", null, false, null],
  ]);

  // O estudante vê as imagens, as alternativas por letra e o aviso do gabarito.
  const detail = await (await fetch(`${base}/api/questions/${v.id}`, { headers: { Cookie: student } })).json();
  assert.equal(detail.presentation, "IMAGE");
  assert.equal(detail.reviewOrigin, "ASSISTED");
  assert.deepEqual(detail.options.map((o: { id: string }) => o.id), ["A", "B", "C", "D", "E"]);
  assert.deepEqual(detail.images.map((i: { page: number }) => i.page), [1, 2]);
  assert.equal(detail.answer, null);
  // Nada sobre o gabarito antes da resposta; depois, o aviso de D10.
  assert.equal("keyFinality" in detail.provenance, false);
  const answered = await fetch(`${base}/api/questions/${v.id}/answer`, {
    method: "PUT", headers: { Cookie: student, "Content-Type": "application/json" },
    body: JSON.stringify({ optionId: "A", baseRevision: 0 }),
  });
  assert.equal(answered.status, 200);
  const feedback = await answered.json();
  assert.equal(feedback.correct, false);
  assert.equal(feedback.answerKey.finality, "ONLY_PUBLISHED");
  assert.equal(feedback.explanation, "");
  const image = await fetch(`${base}${detail.images[0].url}`, { headers: { Cookie: student } });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/webp");
  assert.match(image.headers.get("cache-control") ?? "", /immutable/);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), WHITE);
  assert.equal((await fetch(`${base}${detail.images[0].url}`)).status, 401);

  // Republicar o mesmo conteúdo não cria versão nova.
  const again = await publishAssisted(input);
  assert.deepEqual(again.unchanged, ["Q1"]);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM question_version WHERE exam_source_id=$1", [exam.sourceId])).rows[0].n, 1);
});

test("the same agent cannot extract and review, and stale or divergent reviews are refused", async () => {
  const { input } = await scenario();
  await assert.rejects(
    publishAssisted({ ...input, review: { ...input.review, reviewer: "claude" } }),
    /não pode conferir a própria extração/,
  );
  await assert.rejects(
    publishAssisted({ ...input, manifestSha256: "0".repeat(64) }),
    /outro manifesto/,
  );
  const changed = {
    ...input.review,
    items: [{ ...input.review.items[0], answer: "D" }],
  };
  const summary = await publishAssisted({ ...input, review: changed });
  assert.deepEqual(summary.published, []);
  assert.match(summary.rejected[0].reason, /gabarito conferido \(D\) difere/);
  const swapped = {
    ...input.review,
    items: [{ ...input.review.items[0], fragments: [sha(BLACK), sha(WHITE)] }],
  };
  assert.match((await publishAssisted({ ...input, review: swapped })).rejected[0].reason, /recortes mudaram/);
});

test("a key that does not declare itself definitive needs a recorded decision", async () => {
  const { input } = await scenario();
  await assert.rejects(publishAssisted({ ...input, finality: { documents: {} } }), /não se declara definitivo/);
  const declared = await scenario(true);
  const summary = await publishAssisted({ ...declared.input, finality: { documents: {} } });
  assert.deepEqual(summary.published, ["Q1"]);
  const keyFinality = (await db.query("SELECT key_finality FROM source_document WHERE id=$1", [declared.key.sourceId])).rows[0].key_finality;
  assert.equal(keyFinality, "DECLARED");
});

test("the database refuses assisted publication without two distinct agents", async () => {
  const { exam, input } = await scenario();
  await publishAssisted(input);
  const v = (await db.query("SELECT id,question_id FROM question_version WHERE exam_source_id=$1", [exam.sourceId])).rows[0];
  await assert.rejects(
    db.query(
      `INSERT INTO question_version(id,question_id,version_number,title,topic,prompt,origin,editorial_status,explanation,correct_option_id,author_credit,explanation_credit,
         exam_source_id,key_source_id,source_page,source_question_number,key_page,presentation,review_origin,assisted_extractor,assisted_reviewer,reviewed_at)
       SELECT $2,question_id,99,title,topic,prompt,origin,'PUBLISHED',explanation,correct_option_id,author_credit,explanation_credit,
         exam_source_id,key_source_id,source_page,source_question_number,key_page,'TEXT','ASSISTED','codex','codex',now() FROM question_version WHERE id=$1`,
      [v.id, `${v.question_id}-same-agent`],
    ),
    /question_version_independent_review|correct_option_exists/,
  );
  await assert.rejects(
    db.query("DELETE FROM question_version_image WHERE version_id=$1", [v.id]),
    /immutable/,
  );
});
