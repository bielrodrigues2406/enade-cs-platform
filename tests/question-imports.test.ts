import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CatalogDocument } from "../apps/api/src/question-imports.js";

// Deliberately synthetic fixtures exercise database/authentication contracts;
// these bytes and questions are never represented as real Inep content.
const archiveDir = await mkdtemp(path.join(tmpdir(), "enade-intake-test-"));
process.env.SOURCE_ARCHIVE_DIR = archiveDir;
const { createApp, db } = await import("../apps/api/src/main.js");
const { importQuestionReport } = await import("../apps/api/src/question-imports.js");
type Actor = { cookie: string; id: string };
type Fixture = CatalogDocument & { sourceId: string; sha256: string; file: string };
const sources: Fixture[] = [];
const identities = new Set<string>();
let app: Awaited<ReturnType<typeof createApp>>, base: string;
let author: Actor, reviewer: Actor, student: Actor;
async function request(route: string, cookie = "", method = "GET", body?: unknown) {
  return fetch(`${base}/api/${route}`, { method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000) });
}
async function account(curates = false) {
  const guest = await request("session", "", "POST", {});
  const guestCookie = guest.headers.get("set-cookie")!.split(";")[0];
  const response = await request("auth/register", guestCookie, "POST", { email: `intake-${randomUUID()}@example.invalid`, password: `test-only-${randomUUID()}` });
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const hash = createHash("sha256").update(cookie.slice("enade_session=".length)).digest("hex");
  const id = (await db.query("SELECT identity_id FROM browser_session WHERE token_hash=$1", [hash])).rows[0].identity_id;
  identities.add(id);
  if (curates) await db.query("INSERT INTO curator_role(identity_id) VALUES($1)", [id]);
  return { cookie, id };
}
before(async () => {
  app = await createApp(); await app.listen(0, "127.0.0.1"); base = await app.getUrl();
  author = await account(true); reviewer = await account(true); student = await account();
});
after(async () => {
  try {
    const sourceIds = sources.map((s) => s.sourceId);
    await db.query("DELETE FROM question_intake WHERE exam_source_id=ANY($1::uuid[])", [sourceIds]);
    await db.query("DELETE FROM editorial_question WHERE official_exam_id=ANY($1::uuid[])", [sourceIds]);
    await db.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])", [sourceIds]);
    await db.query("DELETE FROM browser_session WHERE identity_id=ANY($1::uuid[])", [[...identities]]);
    await db.query("DELETE FROM curator_role WHERE identity_id=ANY($1::uuid[])", [[...identities]]);
    await db.query("DELETE FROM account WHERE identity_id=ANY($1::uuid[])", [[...identities]]);
    await db.query("DELETE FROM study_identity WHERE id=ANY($1::uuid[])", [[...identities]]);
  } finally { await app?.close(); await db.end(); await rm(archiveDir, { recursive: true, force: true }); }
});
async function source(kind: string, extra: Partial<CatalogDocument> = {}): Promise<Fixture> {
  const sourceId = randomUUID();
  const bytes = Buffer.from(`%PDF-1.7\n% TEST ONLY synthetic intake fixture ${sourceId}\n%%EOF\n`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const fixture: Fixture = { id: `test-only-${sourceId}`, sourceId, kind, sha256,
    year: 2021, area: "TEST ONLY Computação", modality: "BACHARELADO",
    officialUrl: `https://download.inep.gov.br/enade/test-only/${sourceId}.pdf`,
    byteSize: bytes.length, pageCount: 1, file: path.join(archiveDir, `${sha256}.pdf`), ...extra };
  await writeFile(fixture.file, bytes, { flag: "wx" });
  await db.query("INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,imported_by,last_editor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)",
    [sourceId, `TEST ONLY ${sourceId}`, fixture.officialUrl, kind, fixture.year, fixture.area, fixture.modality, sha256, bytes.length, fixture.pageCount, author.id]);
  sources.push(fixture); return fixture;
}
async function pair() { return { exam: await source("EXAM"), key: await source("ANSWER_KEY") }; }
function item(exam: Fixture, key: Fixture, n = 1) {
  return { key: `Q${n}`, kind: "OBJECTIVE", number: n, block: "TEST_ONLY", pages: [1], status: "rascunho", flags: [], ligatureJoins: [],
    prompt: "TEST ONLY: enunciado sintético para testar o fluxo privado, sem conteúdo oficial.",
    options: [{ letter: "A", text: "Alternativa sintética A." }, { letter: "B", text: "Alternativa sintética B." }], answer: "A",
    source: { examId: exam.id, examSha256: exam.sha256, answerKeyId: key.id, answerKeySha256: key.sha256, answerKeyDefinitive: true } };
}
function report(exam: Fixture, key: Fixture, n = 1) { return { document: exam.id, completeness: { missing: [], unexpected: [] }, items: [item(exam, key, n)] }; }
function review(exam: Fixture, n = 1) {
  return { schemaVersion: 1, origin: "ASSISTED", author: "TEST ONLY assistido", humanReviewed: false,
    items: [{ examId: exam.id, examSha256: exam.sha256, key: `Q${n}`, topic: "TEST ONLY",
      explanation: "Comentário sintético assistido; não é uma explicação do Inep.", notes: ["Teste de persistência."], issues: [], disposition: "CONTENT_CHECKED" }] };
}
async function importOne(exam: Fixture, key: Fixture, n = 1) {
  return importQuestionReport(report(exam, key, n), { catalog: [exam, key], review: review(exam, n) });
}
async function get(id: string) { const r = await request(`curation/imports/${id}`, author.cookie); assert.equal(r.status, 200); return r.json(); }
async function verify(s: Fixture) {
  const r = await request(`curation/sources/${s.sourceId}/review`, reviewer.cookie, "POST", { baseRevision: 1, decision: "VERIFY",
    note: "Fixture sintética conferida apenas para este teste.", checklist: { origin: true, edition: true, integrity: true, ...(s.kind === "ANSWER_KEY" ? { final: true } : {}) } });
  assert.equal(r.status, 200, await r.text());
}
const invalid = (error: unknown) => !!error && typeof error === "object" && "getStatus" in error && (error as { getStatus(): number }).getStatus() === 400;

test("intake routes are private and administrative import does not assert human review", async () => {
  const { exam, key } = await pair();
  const imported = await importQuestionReport(report(exam, key), { catalog: [exam, key] });
  const id = imported.items[0].id;
  for (const cookie of ["", student.cookie]) {
    assert.equal((await request("curation/imports", cookie)).status, cookie ? 403 : 401);
    assert.equal((await request(`curation/imports/${id}`, cookie)).status, cookie ? 403 : 401);
  }
  const view = await get(id);
  assert.equal(view.state, "HOLD"); assert.equal(view.assistedReview.humanReviewed, false);
  assert.equal(view.assistedReview.status, "NOT_REVIEWED");
  assert.ok(view.flags.includes("REVISAO_ASSISTIDA_PENDENTE"));
  const row = (await db.query("SELECT imported_by,last_editor_id FROM question_intake WHERE id=$1", [id])).rows[0];
  assert.equal(row.imported_by, null); assert.equal(row.last_editor_id, null);
  assert.equal(view.events[0].byCurator, false);
  const publicCatalog = await request("questions", student.cookie);
  assert.equal(publicCatalog.status, 200); assert.ok(!(await publicCatalog.text()).includes(view.content.prompt));
});

test("report imports are atomic, check catalog/hash/archive and reject forged human approval", async () => {
  const { exam, key } = await pair();
  const value = report(exam, key);
  value.items.push({ ...item(exam, key, 2), source: { ...item(exam, key, 2).source, examSha256: "0".repeat(64) } });
  await assert.rejects(importQuestionReport(value, { catalog: [exam, key] }), invalid);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM question_intake WHERE exam_source_id=$1", [exam.sourceId])).rows[0].n, 0);
  await assert.rejects(importQuestionReport(report(exam, key), { catalog: [exam, key], review: { ...review(exam), humanReviewed: true } }), invalid);
  await assert.rejects(importQuestionReport(report(exam, key), { catalog: [exam, key], review: { ...review(exam), items: [{ ...review(exam).items[0], examSha256: key.sha256 }] } }), invalid);
  await writeFile(exam.file, "%PDF-corrupt test-only");
  await assert.rejects(importQuestionReport(report(exam, key), { catalog: [exam, key] }));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM question_intake WHERE exam_source_id=$1", [exam.sourceId])).rows[0].n, 0);
});

test("same input is idempotent, new machine output preserves original evidence and human edits", async () => {
  const { exam, key } = await pair();
  const initial = await importOne(exam, key), id = initial.items[0].id;
  assert.equal((await importOne(exam, key)).unchanged, 1);
  const changed = report(exam, key); changed.items[0].prompt += " Texto extraído novamente.";
  assert.equal((await importQuestionReport(changed, { catalog: [exam, key], review: review(exam) })).updated, 1);
  let view = await get(id);
  assert.notEqual(view.raw.prompt, view.content.prompt); assert.equal(view.revision, 2);
  const localPrompt = `${view.content.prompt} Correção do curador.`;
  const r = await request(`curation/imports/${id}`, author.cookie, "PUT", { baseRevision: view.revision, content: { ...view.content, prompt: localPrompt }, resolvedFlags: view.flags, note: "Conferência sintética registrada no teste." });
  assert.equal(r.status, 200);
  const protectedInput = report(exam, key); protectedInput.items[0].prompt += " Outro resultado automático.";
  assert.equal((await importQuestionReport(protectedInput, { catalog: [exam, key], review: review(exam) })).protected, 1);
  view = await get(id); assert.equal(view.content.prompt, localPrompt); assert.equal(view.revision, 3);
});

test("edits use compare-and-swap and retain original flags with an audited resolution", async () => {
  const { exam, key } = await pair();
  const raw = report(exam, key); raw.items[0].flags = ["conferir-figura"] as never[];
  const imported = await importQuestionReport(raw, { catalog: [exam, key], review: review(exam) });
  const id = imported.items[0].id, view = await get(id);
  const body = { baseRevision: view.revision, content: view.content, resolvedFlags: view.flags, note: "Figura conferida na fixture sintética." };
  const responses = await Promise.all([request(`curation/imports/${id}`, author.cookie, "PUT", body), request(`curation/imports/${id}`, author.cookie, "PUT", body)]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const updated = await get(id); assert.equal(updated.state, "PENDING");
  assert.ok(updated.flags.includes("conferir-figura")); assert.ok(updated.resolvedFlags.includes("conferir-figura"));
  assert.equal(updated.events.at(-1).type, "EDITED");
  const forged = await request(`curation/imports/${id}`, author.cookie, "PUT", { ...body, baseRevision: updated.revision, resolvedFlags: ["invented"] });
  assert.equal(forged.status, 400);
});

test("promotion requires real source verification, explicit fidelity and creates only one editorial draft", async () => {
  const { exam, key } = await pair();
  const id = (await importOne(exam, key)).items[0].id;
  const body = { baseRevision: 1, fidelityConfirmed: true };
  assert.equal((await request(`curation/imports/${id}/draft`, author.cookie, "POST", body)).status, 400);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM editorial_question WHERE official_exam_id=$1", [exam.sourceId])).rows[0].n, 0);
  await verify(exam); await verify(key);
  assert.equal((await request(`curation/imports/${id}/draft`, author.cookie, "POST", { baseRevision: 1, fidelityConfirmed: false })).status, 400);
  const responses = await Promise.all([request(`curation/imports/${id}/draft`, author.cookie, "POST", body), request(`curation/imports/${id}/draft`, author.cookie, "POST", body)]);
  assert.deepEqual(responses.map((r) => r.status), [200, 200]);
  const versions = await Promise.all(responses.map((r) => r.json()));
  assert.equal(versions[0].versionId, versions[1].versionId);
  const version = (await db.query("SELECT editorial_status,reviewed_by,created_by FROM question_version WHERE id=$1", [versions[0].versionId])).rows[0];
  assert.equal(version.editorial_status, "DRAFT"); assert.equal(version.reviewed_by, null); assert.equal(version.created_by, author.id);
  assert.equal((await get(id)).state, "DRAFTED");
  assert.equal((await request(`curation/imports/${id}`, author.cookie, "PUT", { baseRevision: 2, content: (await get(id)).content, resolvedFlags: [], note: "Não alterar rascunho já encaminhado." })).status, 409);
});

test("annulled and out-of-scope items remain archived even after their holds are acknowledged", async () => {
  const { exam, key } = await pair();
  for (const [n, status, flags] of [[1, "anulada", []], [2, "rascunho", ["fora-escopo-ciencia-computacao"]]] as const) {
    const raw = report(exam, key, n); raw.items[0].status = status; raw.items[0].flags = [...flags] as never[];
    const imported = await importQuestionReport(raw, { catalog: [exam, key], review: review(exam, n) });
    const id = imported.items[0].id, view = await get(id);
    assert.equal((await request(`curation/imports/${id}`, author.cookie, "PUT", { baseRevision: 1, content: view.content, resolvedFlags: view.flags, note: "Pendências reconhecidas na fixture sintética." })).status, 200);
    assert.equal((await request(`curation/imports/${id}/draft`, author.cookie, "POST", { baseRevision: 2, fidelityConfirmed: true })).status, 400);
  }
});

test("database protects intake evidence and rejects missing assisted-review invariants", async () => {
  const { exam, key } = await pair(); const id = (await importOne(exam, key)).items[0].id;
  for (const statement of [
    "UPDATE question_intake SET original_raw='{}',revision=revision+1 WHERE id=$1",
    "UPDATE question_intake SET assisted_review='{}',revision=revision+1 WHERE id=$1",
    "UPDATE question_intake SET assisted_review='{\"origin\":\"ASSISTED\",\"humanReviewed\":true}',revision=revision+1 WHERE id=$1",
    "UPDATE question_intake SET resolved_flags=ARRAY['invented'],revision=revision+1 WHERE id=$1",
  ]) await assert.rejects(db.query(statement, [id]), (e: unknown) => !!e && typeof e === "object" && "code" in e && e.code === "23514");
});

test("PND imports bind the answer key to the same booklet type", async () => {
  const exam = await source("EXAM", { id: `pnd-2025-computacao-pv-4`, family: "PND", year: 2025, modality: "LICENCIATURA" });
  const key = await source("ANSWER_KEY", { id: `pnd-2025-computacao-gb-3`, family: "PND", year: 2025, modality: "LICENCIATURA" });
  await assert.rejects(importQuestionReport(report(exam, key), { catalog: [exam, key] }), invalid);
});

test("shared-booklet course scope is enforced even when extraction omitted its hold", async () => {
  const exam = await source("EXAM", { modality: "COMUM" });
  const key = await source("ANSWER_KEY", { modality: "COMUM" });
  const raw = report(exam, key);
  const scoped = { ...raw, items: [{ ...raw.items[0], courseScope: ["Sistemas de Informação"] }] };
  const imported = await importQuestionReport(scoped, { catalog: [exam, key], review: review(exam) });
  assert.ok((await get(imported.items[0].id)).flags.includes("fora-escopo-ciencia-computacao"));
});

test("derived auxiliary sources remain held and cannot become official drafts after acknowledgments", async () => {
  const derivation = { upstreamUrl: "https://github.com/test-only/compilation", upstreamSha256: "a".repeat(64), pages: [1, 1] };
  const exam = await source("EXAM", { auxiliary: true, originalBytesAvailable: false, derivation });
  const key = await source("ANSWER_KEY", { auxiliary: true, originalBytesAvailable: false, derivation });
  const imported = await importOne(exam, key), id = imported.items[0].id;
  let view = await get(id);
  assert.equal(view.state, "HOLD"); assert.ok(view.flags.includes("FONTE_AUXILIAR_DERIVADA"));
  assert.ok(view.content.title.startsWith("Fonte auxiliar · "));
  assert.deepEqual(view.extraction.sourceEvidence.exam.derivation, derivation);
  assert.equal(view.extraction.sourceEvidence.originalBytesAvailable, false);
  assert.equal((await request(`curation/imports/${id}`, author.cookie, "PUT", { baseRevision: view.revision, content: view.content, resolvedFlags: view.flags, note: "Recebimento do trecho auxiliar reconhecido, sem afirmar originalidade." })).status, 200);
  view = await get(id); assert.equal(view.state, "HOLD");
  await verify(exam); await verify(key);
  // Each test file runs in its own Node process. Use a temporary catalog to
  // exercise the central manual-creation guard without changing repository data.
  const previousDirectory = process.cwd();
  const temporaryCatalog = await mkdtemp(path.join(tmpdir(), "enade-aux-catalog-"));
  const manualContent = { ...view.content, origin: "OFFICIAL", authorCredit: "Inep",
    provenance: { examSourceId: exam.sourceId, keySourceId: key.sourceId, page: 1, questionNumber: 1, keyPage: 1 } };
  try {
    await mkdir(path.join(temporaryCatalog, "data"));
    await writeFile(path.join(temporaryCatalog, "data/official-sources.json"), JSON.stringify({ documents: [] }));
    await writeFile(path.join(temporaryCatalog, "data/auxiliary-sources.json"), JSON.stringify({ documents: [exam, key] }));
    process.chdir(temporaryCatalog);
    const manual = await request("curation/questions", author.cookie, "POST", manualContent);
    assert.equal(manual.status, 400);
    assert.match((await manual.json()).message, /Trechos derivados de compilações/);
    await rm(path.join(temporaryCatalog, "data/auxiliary-sources.json"));
    const unavailable = await request("curation/questions", author.cookie, "POST", manualContent);
    assert.equal(unavailable.status, 409);
    assert.match((await unavailable.json()).message, /Catálogo de procedência indisponível/);
    await writeFile(path.join(temporaryCatalog, "data/auxiliary-sources.json"), JSON.stringify({ documents: {} }));
    const malformed = await request("curation/questions", author.cookie, "POST", manualContent);
    assert.equal(malformed.status, 409);
    assert.match((await malformed.json()).message, /Catálogo de procedência inválido/);
  } finally {
    process.chdir(previousDirectory);
    await rm(temporaryCatalog, { recursive: true, force: true });
  }
  const response = await request(`curation/imports/${id}/draft`, author.cookie, "POST", { baseRevision: view.revision, fidelityConfirmed: true });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /trecho derivado/);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM editorial_question WHERE official_exam_id=$1", [exam.sourceId])).rows[0].n, 0);
});

test("repeated option-letter diagnostics preserve incomplete extraction without inventing choices", async () => {
  const { exam, key } = await pair();
  const raw = report(exam, key);
  const extracted = { ...raw, items: [{ ...raw.items[0], status: "revisao-manual", options: [], optionLetters: "AABACABDCDEE" }] };
  const result = await importQuestionReport(extracted, { catalog: [exam, key] });
  const view = await get(result.items[0].id);
  assert.equal(view.raw.optionLetters, "AABACABDCDEE");
  assert.deepEqual(view.content.options, []);
  assert.equal(view.state, "HOLD");
  assert.ok(view.flags.includes("ALTERNATIVAS_INCOMPLETAS"));
  await assert.rejects(importQuestionReport({ ...extracted, items: [{ ...extracted.items[0], optionLetters: "A<script>" }] }, { catalog: [exam, key] }), invalid);
});
