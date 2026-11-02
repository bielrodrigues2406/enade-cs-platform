import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Discursivas conferidas por agente (DISC-2) no PostgreSQL real. Fontes e
// imagens sintéticas, marcadas TEST ONLY; nada aqui é conteúdo do Inep.
const assetDir = await mkdtemp(path.join(tmpdir(), "enade-discursive-img-"));
const archiveDir = await mkdtemp(path.join(tmpdir(), "enade-discursive-src-"));
process.env.QUESTION_ASSET_DIR = assetDir;
process.env.SOURCE_ARCHIVE_DIR = archiveDir;
const { db } = await import("../apps/api/src/database.js");
const { publishDiscursiveReview, validateReview } = await import("../apps/api/src/assisted-discursive.js");
const { sourcePath } = await import("../apps/api/src/source-store.js");
type Review = Parameters<typeof validateReview>[0];

const WHITE = Buffer.from("UklGRh4AAABXRUJQVlA4TBEAAAAvAkAAAAfQ//73v/+BiOh/AAA=", "base64");
const BLACK = Buffer.from("UklGRhoAAABXRUJQVlA4TA4AAAAvAQABAAcQEf0PRET/Aw==", "base64");
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const sources: string[] = [];

async function source(kind: "EXAM" | "RESPONSE_STANDARD") {
  const id = randomUUID(), sha256 = sha(id);
  sources.push(id);
  await db.query(
    `INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,
       status,verification_origin,assisted_verifier,reviewed_at)
     VALUES($1,'TEST ONLY synthetic source',$2,$3,2097,'TEST ONLY course','BACHARELADO',$4,64,1,
       'VERIFIED','ASSISTED','test-only-reviewer',clock_timestamp())`,
    [id, `https://download.inep.gov.br/enade/test-only-${id}.pdf`, kind, sha256],
  );
  return sha256;
}

function review(examSha256: string, standardSha256: string): Review {
  const box = { x0: 10, y0: 10, x1: 100, y1: 50 };
  return {
    document: "test-only-exam", examSha256, standardDocument: "test-only-standard", standardSha256,
    extractor: "test-only-extractor", reviewer: "test-only-reviewer", renderer: { dpi: 200 },
    items: [{
      number: 3, decision: "APPROVED", area: "Algoritmos", subject: "TEST ONLY assunto",
      criteria: [{ label: "a", points: 4 }, { label: "b", points: 6 }], note: null,
      prompt: [{ file: "D3-prompt-1.webp", page: 1, box, sha256: sha(WHITE) }],
      standard: [{ file: "D3-standard-1.webp", page: 2, box, sha256: sha(BLACK) }],
    }],
  };
}
const crops = async (file: string) => (file.includes("prompt") ? WHITE : BLACK);

after(async () => {
  await db.query("DELETE FROM discursive_question WHERE exam_source_id IN (SELECT id FROM source_document WHERE id=ANY($1::uuid[]))", [sources]);
  await db.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])", [sources]);
  await db.end();
  await rm(assetDir, { recursive: true, force: true });
  await rm(archiveDir, { recursive: true, force: true });
});

async function importedStandard() {
  const bytes = Buffer.from(`%PDF-1.7\nTEST ONLY standard ${randomUUID()}\n%%EOF`);
  const hash = sha(bytes);
  const id = randomUUID();
  sources.push(id);
  await db.query(`INSERT INTO source_document(id,title,official_url,kind,year,area,modality,
    sha256,byte_size,page_count,status) VALUES($1,'TEST ONLY imported standard',$2,
    'RESPONSE_STANDARD',2097,'TEST ONLY course','BACHARELADO',$3,$4,2,'IMPORTED')`,
    [id, `https://download.inep.gov.br/enade/test-only-${id}.pdf`, hash, bytes.length]);
  const file = sourcePath(hash);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return { hash, file };
}

test("publishing a reviewed discursive verifies its archived response standard once, including existing questions", async () => {
  const standard = await importedStandard();
  const data = review(await source("EXAM"), standard.hash);
  await publishDiscursiveReview(data, crops);
  const lookup = () => db.query(`SELECT status,verification_origin,assisted_verifier,revision,
    (SELECT count(*)::int FROM source_event e WHERE e.source_id=s.id AND e.event_type='VERIFIED') AS events
    FROM source_document s WHERE sha256=$1`, [standard.hash]);
  const first = (await lookup()).rows[0];
  assert.deepEqual([first.status, first.verification_origin, first.assisted_verifier, first.events],
    ["VERIFIED", "ASSISTED", data.reviewer, 1]);
  await publishDiscursiveReview(data, crops);
  assert.deepEqual((await lookup()).rows[0], first);
  // Upgrade the old bootstrap state without duplicating the existing question.
  const oldStandard = await importedStandard();
  const oldData = review(await source("EXAM"), oldStandard.hash);
  await db.query(`INSERT INTO discursive_question(id,exam_source_id,standard_source_id,year,modality,
    number,area,criteria,review_origin,assisted_extractor,assisted_reviewer)
    SELECT $1,e.id,s.id,e.year,e.modality,3,'Algoritmos',$4,'ASSISTED',$5,$6
    FROM source_document e,source_document s WHERE e.sha256=$2 AND s.sha256=$3`,
    [`discursive-${oldData.examSha256.slice(0,12)}-d3`, oldData.examSha256, oldStandard.hash,
      JSON.stringify(oldData.items[0].criteria),oldData.extractor,oldData.reviewer]);
  assert.equal((await publishDiscursiveReview(oldData, crops)).kept.length, 1);
  assert.equal((await db.query("SELECT status FROM source_document WHERE sha256=$1", [oldStandard.hash])).rows[0].status, "VERIFIED");
});

test("an altered archived standard cannot become verified or publish a question", async () => {
  const standard = await importedStandard();
  const data = review(await source("EXAM"), standard.hash);
  await writeFile(standard.file, "%PDF-1.7\nTEST ONLY altered");
  await assert.rejects(publishDiscursiveReview(data, crops), /arquivo arquivado|integridade/);
  assert.equal((await db.query("SELECT status FROM source_document WHERE sha256=$1", [standard.hash])).rows[0].status, "IMPORTED");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM discursive_question WHERE exam_source_id=(SELECT id FROM source_document WHERE sha256=$1)", [data.examSha256])).rows[0].n, 0);
});

test("an agent-reviewed discursive is published once, with both crops and the assisted origin", async () => {
  const data = review(await source("EXAM"), await source("RESPONSE_STANDARD"));
  assert.deepEqual(await publishDiscursiveReview(data, crops), { document: "test-only-exam", published: [3], kept: [], blocked: [] });
  assert.deepEqual(await publishDiscursiveReview(data, crops), { document: "test-only-exam", published: [], kept: [3], blocked: [] });
  const row = (await db.query(
    `SELECT q.review_origin,q.reviewed_by,q.assisted_reviewer,q.criteria,array_agg(i.part ORDER BY i.part) AS parts
     FROM discursive_question q JOIN discursive_image i ON i.question_id=q.id
     WHERE q.id=$1 GROUP BY q.id`, [`discursive-${data.examSha256.slice(0, 12)}-d3`],
  )).rows[0];
  assert.deepEqual([row.review_origin, row.reviewed_by, row.assisted_reviewer, row.parts],
    ["ASSISTED", null, "test-only-reviewer", ["PROMPT", "STANDARD"]]);
  assert.deepEqual(row.criteria, [{ label: "a", points: 4 }, { label: "b", points: 6 }]);
  // O banco não aceita origem assistida sem quem conferiu.
  await assert.rejects(db.query("UPDATE discursive_question SET assisted_reviewer=NULL WHERE exam_source_id=(SELECT id FROM source_document WHERE sha256=$1)", [data.examSha256]),
    (error: any) => error.code === "23514");
});

test("a review with altered bytes, unknown sources or invalid fields publishes nothing", async () => {
  const data = review(await source("EXAM"), await source("RESPONSE_STANDARD"));
  await assert.rejects(publishDiscursiveReview(data, async () => BLACK), /bytes diferentes/);
  await assert.rejects(publishDiscursiveReview({ ...data, examSha256: sha("TEST ONLY missing") }, crops), /ainda não importada/);
  const item = data.items[0];
  for (const bad of [
    { ...data, reviewer: "Reviewer With Spaces" },
    { ...data, items: [{ ...item, area: "TEST ONLY área" }] },
    { ...data, items: [{ ...item, criteria: [{ label: "a", points: 8 }, { label: "b", points: 8 }] }] },
    { ...data, items: [{ ...item, standard: [] }] },
    { ...data, items: [{ ...item, prompt: [{ ...item.prompt[0], file: "../segredo.webp" }] }] },
  ]) assert.throws(() => validateReview(bad));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM discursive_question WHERE exam_source_id=(SELECT id FROM source_document WHERE sha256=$1)", [data.examSha256])).rows[0].n, 0);
});
