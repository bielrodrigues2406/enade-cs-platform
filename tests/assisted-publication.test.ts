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
const { webpSize } = await import("../apps/api/src/question-images.js");

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
    await db.query("DELETE FROM question_intake WHERE exam_source_id=ANY($1::uuid[])", [ids]);
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

async function source(kind: string, extra: Partial<CatalogDocument> = {}): Promise<Fixture> {
  const sourceId = randomUUID();
  const bytes = Buffer.from(`%PDF-1.7\n% TEST ONLY assisted publication fixture ${sourceId}\n%%EOF\n`);
  const fixture: Fixture = {
    id: `test-only-${sourceId}`, sourceId, kind, sha256: sha(bytes), year: 2008,
    area: "TEST ONLY Computação", modality: "COMUM", byteSize: bytes.length, pageCount: 2,
    officialUrl: `https://download.inep.gov.br/enade/test-only/${sourceId}.pdf`, ...extra,
  };
  await writeFile(path.join(archiveDir, `${fixture.sha256}.pdf`), bytes, { flag: "wx" });
  await db.query(
    "INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [sourceId, `TEST ONLY ${sourceId}`, fixture.officialUrl, kind, fixture.year, fixture.area, fixture.modality, fixture.sha256, bytes.length, 2],
  );
  sources.push(fixture);
  return fixture;
}

async function scenario(definitive = false, examExtra: Partial<CatalogDocument> = {}, keyExtra: Partial<CatalogDocument> = {}) {
  const exam = await source("EXAM", examExtra);
  const key = await source("ANSWER_KEY", keyExtra);
  const crops: Record<string, Buffer> = { "Q1-1.webp": WHITE, "Q1-2.webp": BLACK, "Q2-1.webp": BLACK };
  const fragment = (file: string, page: number) => {
    const { width, height } = webpSize(crops[file]);
    return { file, page, box: { x0: 30, y0: 60, x1: 30 + width * 72 / 200, y1: 60 + height * 72 / 200 },
      width, height, byteSize: crops[file].length, sha256: sha(crops[file]) };
  };
  const manifest = {
    document: exam.id, examSha256: exam.sha256, renderer: { dpi: 200, format: "image/webp", lossless: true,
      pages: [{ page: 1, width: 400, height: 600 }, { page: 2, width: 400, height: 600 }] },
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


function changedManifest(input: Awaited<ReturnType<typeof scenario>>["input"], manifest: unknown) {
  const manifestSha256 = sha(JSON.stringify(manifest));
  return { ...input, manifest, manifestSha256,
    review: { ...input.review, cropsManifestSha256: manifestSha256 } };
}
async function noPublication(exam: Fixture) {
  assert.equal((await db.query("SELECT count(*)::int AS n FROM question_version WHERE exam_source_id=$1", [exam.sourceId])).rows[0].n, 0);
}

test("auxiliary and unavailable originals never enter assisted source verification or publication", async () => {
  for (const [examExtra, keyExtra] of [
    [{ auxiliary: true }, {}], [{ originalBytesAvailable: false }, {}],
    [{}, { auxiliary: true }], [{}, { originalBytesAvailable: false }],
  ] as [Partial<CatalogDocument>, Partial<CatalogDocument>][]) {
    const { exam, key, input } = await scenario(true, examExtra, keyExtra);
    await assert.rejects(publishAssisted(input), /auxiliares|bytes originais/);
    await noPublication(exam);
    const rows = (await db.query("SELECT status FROM source_document WHERE id=ANY($1::uuid[])", [[exam.sourceId, key.sourceId]])).rows;
    assert.ok(rows.every((row) => row.status === "IMPORTED"));
  }
});

test("each published item is bound to its exam and the corresponding key family, type and variant", async () => {
  for (const field of ["examId", "examSha256"]) {
    const { exam, input } = await scenario(true);
    const report = structuredClone(input.report);
    report.items[0].source[field] = field === "examId" ? "other-exam" : "0".repeat(64);
    const summary = await publishAssisted({ ...input, report });
    assert.match(summary.rejected[0].reason, /outra prova/); await noPublication(exam);
  }
  const mismatch = await scenario(true, { family: "PND", id: "test-only-pnd-pv-4" },
    { family: "PND", id: "test-only-pnd-gb-1" });
  assert.match((await publishAssisted(mismatch.input)).rejected[0].reason, /tipo do gabarito PND/);
  await noPublication(mismatch.exam);
  const family = await scenario(true, { family: "PND" }, { family: "ENADE" });
  assert.match((await publishAssisted(family.input)).rejected[0].reason, /catálogo/);
  await noPublication(family.exam);
  const variant = await scenario(true, { family: "ENADE_LICENCIATURAS", variant: "Prova 4" },
    { family: "ENADE_LICENCIATURAS", variant: "Gabarito" });
  assert.match((await publishAssisted(variant.input)).rejected[0].reason, /variante/);
  await noPublication(variant.exam);
});

test("manifest geometry validates every continuation and matches the reviewed image bytes", async () => {
  const { exam, input } = await scenario(true);
  const original = input.manifest;
  const cases = [
    { ...original, renderer: { ...original.renderer, pages: original.renderer.pages.slice(0, 1) } },
    { ...original, renderer: { ...original.renderer, dpi: 150 } },
    { ...original, renderer: { ...original.renderer, lossless: false } },
    { ...original, renderer: { ...original.renderer, pages: [...original.renderer.pages].reverse() } },
  ];
  for (const manifest of cases) await assert.rejects(publishAssisted(changedManifest(input, manifest)), /geometria|Geometria/);
  for (const change of [
    { page: 3 }, { page: 0 }, { file: "../Q1-2.webp" }, { width: 0 },
    { width: 500 }, { byteSize: 0 }, { box: { x0: 30, y0: 60, x1: 401, y1: 61 } },
    { box: { x0: -1, y0: 60, x1: 31, y1: 61 } },
  ]) {
    const manifest = structuredClone(original);
    Object.assign(manifest.items[0].fragments[1], change);
    await assert.rejects(publishAssisted(changedManifest(input, manifest)), /fragmento|caixa|pixels|página/);
  }
  for (const change of [{ byteSize: original.items[0].fragments[1].byteSize + 1 }, { height: original.items[0].fragments[1].height + 1 }]) {
    const manifest = structuredClone(original);
    Object.assign(manifest.items[0].fragments[1], change);
    await assert.rejects(publishAssisted(changedManifest(input, manifest)), /difere do manifesto|dimensões/);
  }
  await noPublication(exam);
});

test("duplicate or inconsistent question numbers cannot overwrite entries before publication", async () => {
  const { exam, input } = await scenario(true);
  const duplicate = { ...input.report, items: [input.report.items[0], input.report.items[0]] };
  await assert.rejects(publishAssisted({ ...input, report: duplicate }), /inválida\/repetida/);
  const mismatch = structuredClone(input.report); mismatch.items[0].number = 2;
  await assert.rejects(publishAssisted({ ...input, report: mismatch }), /inválida\/repetida/);
  const manifest = structuredClone(input.manifest); manifest.items[0].number = 2;
  await assert.rejects(publishAssisted(changedManifest(input, manifest)), /inválida\/repetida/);
  await noPublication(exam);
});

test("APPROVED does not waive material findings in analysis or in the persisted intake", async () => {
  const { exam, key, input } = await scenario(true);
  const raw = input.report.items[0];
  for (const code of ["DEFEITO_NO_CODIGO_ORIGINAL", "DADOS_E_UNIDADES_NA_FONTE", "AMBIGUIDADE_INTERPRETATIVA", "ANULADA_OFICIAL", "ANULACAO_PRESERVADA", "CONFERIR_CONTEXTO_LEGAL", "UNCLASSIFIED_PENDING_ISSUE"]) {
    const analysis = { author: "TEST ONLY", items: [{ examId: exam.id, examSha256: exam.sha256,
      key: "Q1", issues: [{ code, note: "TEST ONLY unresolved material issue" }] }] };
    assert.match((await publishAssisted({ ...input, analysis })).rejected[0].reason, /pendência material/);
  }
  await db.query(`INSERT INTO question_intake(id,exam_source_id,key_source_id,source_key,question_number,kind,pages,
    original_raw,extraction,machine_digest,content,assisted_review,flags,state)
    VALUES($1,$2,$3,'Q1',1,'OBJECTIVE','{1}',$4,'{}',$5,'{}',$6,$7,'HOLD')`,
    [randomUUID(), exam.sourceId, key.sourceId, raw, sha("TEST ONLY digest"),
      { origin: "ASSISTED", humanReviewed: false, issues: [{ code: "DEFEITO_NO_CODIGO_ORIGINAL" }] }, ["DEFEITO_NO_CODIGO_ORIGINAL"]]);
  assert.match((await publishAssisted(input)).rejected[0].reason, /DEFEITO_NO_CODIGO_ORIGINAL/);
  await noPublication(exam);
});

test("omitting analysis cannot hide material findings stored with the repository review", async () => {
  const { exam, input } = await scenario(true, { year: 2099 }, { year: 2099 });
  const file = path.resolve("data/question-reviews/2099-review.json");
  await writeFile(file, JSON.stringify({ author: "TEST ONLY", items: [{ examId: exam.id, examSha256: exam.sha256,
    key: "Q1", issues: [{ code: "AMBIGUIDADE_CONCEITUAL" }] }] }), { flag: "wx" });
  try {
    assert.match((await publishAssisted(input)).rejected[0].reason, /AMBIGUIDADE_CONCEITUAL/);
    await noPublication(exam);
  } finally { await rm(file); }
});

test("visual and OCR-only warnings can be satisfied by complete approved image evidence", async () => {
  const { input } = await scenario(true);
  const report = structuredClone(input.report);
  report.items[0].flags = ["revisao-ocr", "texto-derivado-calibri", "figura"];
  const analysis = { author: "TEST ONLY", items: [{ examId: input.report.document,
    examSha256: input.manifest.examSha256, key: "Q1", issues: [
      { code: "FORMULAS_DE_INFERENCIA_NAO_PRESERVADAS" }, { code: "CORRIGIR_VERSALETE" },
    ] }] };
  const summary = await publishAssisted({ ...input, report, analysis });
  assert.deepEqual(summary.published, ["Q1"]);
  assert.deepEqual(summary.blocked.map((item) => item.key), ["Q2"]);
});


test("the recorded finality decision cannot be overridden by a report claiming definitive", async () => {
  const { key, input } = await scenario(true);
  await publishAssisted(input); // The server registry says ONLY_PUBLISHED.
  const row = (await db.query("SELECT key_finality FROM source_document WHERE id=$1", [key.sourceId])).rows[0];
  assert.equal(row.key_finality, "ONLY_PUBLISHED");
  await assert.rejects(publishAssisted({ ...input,
    finality: { documents: { [key.id]: { finality: "DECLARED" } } } }), /finalidade conferida diverge/);
  assert.equal((await db.query("SELECT key_finality FROM source_document WHERE id=$1", [key.sourceId])).rows[0].key_finality, "ONLY_PUBLISHED");
});

test("a fully blocked or rejected batch leaves sources unverified", async () => {
  const blocked = await scenario(true);
  await publishAssisted({ ...blocked.input, review: { ...blocked.input.review,
    items: [{ key: "Q1", verdict: "BLOCKED", reason: "TEST ONLY pending crop" }] } });
  const rejected = await scenario(true);
  const report = structuredClone(rejected.input.report);
  report.items[0].source.examSha256 = "0".repeat(64);
  const result = await publishAssisted({ ...rejected.input, report });
  assert.equal(result.published.length, 0);
  for (const s of [blocked, rejected]) {
    const rows = (await db.query("SELECT status FROM source_document WHERE id=ANY($1::uuid[])", [[s.exam.sourceId, s.key.sourceId]])).rows;
    assert.ok(rows.every((row) => row.status === "IMPORTED"));
    await noPublication(s.exam);
  }
});

test("matching PND and licensing variants retain their actual option format", async () => {
  const pnd = await scenario(true, { family: "PND", id: "test-only-pnd-pv-4" }, { family: "PND", id: "test-only-pnd-gb-4" });
  pnd.input.review.items[0].optionCount = 4;
  assert.deepEqual((await publishAssisted(pnd.input)).published, ["Q1"]);
  const count = (await db.query("SELECT count(*)::int AS n FROM question_option o JOIN question_version v ON v.id=o.question_id WHERE v.exam_source_id=$1", [pnd.exam.sourceId])).rows[0].n;
  assert.equal(count, 4);
  const lic = await scenario(true, { family: "ENADE_LICENCIATURAS", variant: "Prova 4" }, { family: "ENADE_LICENCIATURAS", variant: "Gabarito" });
  const report = structuredClone(lic.input.report);
  Object.assign(report.items[0].source, { answerKeyVariant: "Prova 4" });
  assert.deepEqual((await publishAssisted({ ...lic.input, report })).published, ["Q1"]);
});
