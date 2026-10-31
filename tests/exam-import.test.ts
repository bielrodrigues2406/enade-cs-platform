import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";

// PDFs, contas e questões TEST ONLY; nada aqui reproduz conteúdo do Inep.
const archiveDir = await mkdtemp(path.join(tmpdir(), "enade-import-src-"));
const assetDir = await mkdtemp(path.join(tmpdir(), "enade-import-img-"));
process.env.SOURCE_ARCHIVE_DIR = archiveDir;
process.env.QUESTION_ASSET_DIR = assetDir;
const { createApp, db } = await import("../apps/api/src/main.js");
const { authorize } = await import("../apps/api/src/roles.js");

let app: Awaited<ReturnType<typeof createApp>>, base: string;
const emails: string[] = [];
const imports: string[] = [];
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

function pdf(label: string) {
  const stream = `BT /F1 14 Tf 60 720 Td (TEST ONLY ${label}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}

before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});
after(async () => {
  try {
    const versions = (await db.query(
      "SELECT v.id FROM question_version v JOIN exam_import i ON v.question_id LIKE 'official-' || substr(i.exam_sha256,1,12) || '-%' WHERE i.id=ANY($1::uuid[])",
      [imports],
    )).rows.map((r) => r.id);
    await db.query("DELETE FROM answer WHERE question_id=ANY($1)", [versions]);
    const sources = (await db.query(
      "SELECT s.id FROM source_document s JOIN exam_import i ON s.sha256 IN (i.exam_sha256,i.key_sha256,i.standard_sha256) WHERE i.id=ANY($1::uuid[])",
      [imports],
    )).rows.map((r) => r.id);
    await db.query("DELETE FROM editorial_question WHERE official_exam_id=ANY($1::uuid[])", [sources]);
    await db.query("DELETE FROM discursive_question WHERE exam_source_id=ANY($1::uuid[])", [sources]);
    await db.query("DELETE FROM exam_import WHERE id=ANY($1::uuid[])", [imports]);
    await db.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])", [sources]);
    const ids = (await db.query("SELECT identity_id FROM account WHERE email=ANY($1)", [emails])).rows.map((r) => r.identity_id);
    await db.query("DELETE FROM role_event WHERE email=ANY($1)", [emails]);
    await db.query("DELETE FROM account_role WHERE identity_id=ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM browser_session WHERE identity_id=ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM account WHERE identity_id=ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM study_identity WHERE id=ANY($1::uuid[])", [ids]);
  } finally {
    await app.close();
    await db.end();
    await rm(archiveDir, { recursive: true, force: true });
    await rm(assetDir, { recursive: true, force: true });
  }
});

async function session(admin: boolean) {
  const guest = await fetch(`${base}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  let cookie = guest.headers.get("set-cookie")!.split(";")[0];
  const email = `import-${randomUUID()}@example.invalid`;
  emails.push(email);
  const created = await fetch(`${base}/api/auth/register`, {
    method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Importar teste 2026!" }),
  });
  cookie = created.headers.get("set-cookie")!.split(";")[0];
  if (admin) {
    const client = await db.connect();
    try { await authorize(client, email, "ADMIN", null); } finally { client.release(); }
  }
  return cookie;
}
const json = (cookie: string, method: string, body: unknown) => ({
  method, headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
function form(exam: Buffer, key: Buffer) {
  const data = new FormData();
  data.set("year", "2099");
  data.set("modality", "BACHARELADO");
  data.set("examUrl", "https://download.inep.gov.br/enade/test-only/prova.pdf");
  data.set("keyUrl", "https://download.inep.gov.br/enade/test-only/gabarito.pdf");
  data.set("exam", new Blob([exam], { type: "application/pdf" }), "prova.pdf");
  data.set("key", new Blob([key], { type: "application/pdf" }), "gabarito.pdf");
  return data;
}

test("only admins import; an upload is processed outside the request and reports failures", async () => {
  const student = await session(false);
  assert.equal((await fetch(`${base}/api/imports`, { headers: { Cookie: student } })).status, 403);
  const admin = await session(true);
  const created = await fetch(`${base}/api/imports`, { method: "POST", headers: { Cookie: admin }, body: form(pdf(randomUUID()), pdf(randomUUID())) });
  assert.equal(created.status, 201);
  const { id, state } = await created.json();
  imports.push(id);
  assert.equal(state, "PROCESSING");
  let current = state;
  for (let i = 0; i < 60 && current === "PROCESSING"; i++) {
    await wait(250);
    current = (await (await fetch(`${base}/api/imports/${id}`, { headers: { Cookie: admin } })).json()).state;
  }
  // O PDF sintético não tem questões: o processo termina com falha explicada.
  assert.equal(current, "FAILED");
  const bad = await fetch(`${base}/api/imports`, { method: "POST", headers: { Cookie: admin }, body: form(Buffer.from("not a pdf"), pdf("k")) });
  assert.equal(bad.status, 400);
});

test("confirmed boxes are cropped, published as image questions and never duplicated", async () => {
  const admin = await session(true);
  const exam = pdf(randomUUID()), key = pdf(randomUUID());
  await writeFile(path.join(archiveDir, `${sha(exam)}.pdf`), exam);
  await writeFile(path.join(archiveDir, `${sha(key)}.pdf`), key);
  const id = randomUUID();
  imports.push(id);
  const adminId = (await db.query("SELECT identity_id FROM account WHERE email=$1", [emails.at(-1)])).rows[0].identity_id;
  await db.query(
    `INSERT INTO exam_import(id,year,modality,exam_url,key_url,exam_sha256,key_sha256,page_count,page_sizes,state,created_by)
     VALUES($1,2099,'BACHARELADO','https://download.inep.gov.br/enade/test-only/p.pdf','https://download.inep.gov.br/enade/test-only/g.pdf',$2,$3,1,$4,'READY',$5)`,
    [id, sha(exam), sha(key), JSON.stringify([{ width: 612, height: 792 }]), adminId],
  );
  await db.query(
    `INSERT INTO exam_import_item(import_id,question_key,number,kind,answer,key_answer,boxes,prompt,options) VALUES
     ($1,'Q1',1,'OBJECTIVE','B','B','[{"page":1,"x0":40,"y0":40,"x1":400,"y1":120}]','TEST ONLY','[{"letter":"A","text":"TEST ONLY a"}]'),
     ($1,'Q2',2,'OBJECTIVE','ANULADA','ANULADA','[{"page":1,"x0":40,"y0":200,"x1":400,"y1":300}]','',  '[]'),
     ($1,'D1',1,'DISCURSIVE',NULL,NULL,'[]','',  '[]')`,
    [id],
  );
  const page = await fetch(`${base}/api/imports/${id}/pages/1`, { headers: { Cookie: admin } });
  assert.equal(page.headers.get("content-type"), "image/png");

  const edit = (key: string, body: unknown) => fetch(`${base}/api/imports/${id}/items/${key}`, json(admin, "PUT", body));
  const boxes = [{ page: 1, x0: 50, y0: 60, x1: 420, y1: 140 }];
  assert.equal((await edit("Q1", { boxes, status: "CONFIRMED", revision: 1 })).status, 400); // sem área
  assert.equal((await edit("Q1", { boxes: [{ page: 1, x0: 0, y0: 0, x1: 900, y1: 100 }], status: "PENDING", revision: 1 })).status, 400);
  // Trocar a letra lida no gabarito exige justificativa.
  assert.equal((await edit("Q1", { boxes, status: "PENDING", answer: "C", revision: 1 })).status, 409);
  assert.equal((await edit("Q1", { boxes, status: "PENDING", answer: "C", answerNote: "ok", revision: 1 })).status, 400);
  const saved = await edit("Q1", { boxes, status: "CONFIRMED", area: "Redes", subject: "TEST ONLY roteamento",
    answer: "C", answerNote: "TEST ONLY gabarito republicado", revision: 1 });
  assert.deepEqual(await saved.json(), { revision: 2 });
  assert.equal((await edit("Q1", { boxes, status: "CONFIRMED", area: "Redes", answer: "C", answerNote: "TEST ONLY x", revision: 1 })).status, 409); // revisão antiga
  // Anulada não é confirmada, nem mesmo com área e caixa.
  assert.equal((await edit("Q2", { boxes, status: "CONFIRMED", area: "Redes", answer: "ANULADA", revision: 1 })).status, 409);
  // Discursiva sem a caixa do padrão de resposta não é confirmada.
  assert.equal((await edit("D1", { boxes, status: "CONFIRMED", area: "Redes", revision: 1 })).status, 400);

  const published = await fetch(`${base}/api/imports/${id}/publish`, json(admin, "POST", {}));
  assert.deepEqual(await published.json(), { published: 1, alreadyPublished: 0 });
  const version = (await db.query(
    "SELECT * FROM question_version WHERE question_id=$1", [`official-${sha(exam).slice(0, 12)}-q1`],
  )).rows[0];
  assert.deepEqual([version.review_origin, version.presentation, version.correct_option_id, version.subject, version.editorial_status],
    ["IMPORT", "IMAGE", "C", "TEST ONLY roteamento", "PUBLISHED"]);
  const event = (await db.query("SELECT note FROM editorial_event WHERE version_id=$1 AND event_type='PUBLISHED'", [version.id])).rows[0];
  assert.match(event.note, /gabarito lido B, publicado C: TEST ONLY gabarito republicado/);
  assert.equal(version.reviewed_by, adminId);
  const detail = await (await fetch(`${base}/api/questions/${version.id}`, { headers: { Cookie: admin } })).json();
  assert.equal(detail.images.length, 1);
  assert.equal(detail.images[0].width, Math.round((420 * 200) / 72) - Math.round((50 * 200) / 72));

  // Depois de publicada, a questão aparece como "já publicada" no lote.
  const items = (await (await fetch(`${base}/api/imports/${id}`, { headers: { Cookie: admin } })).json()).items;
  assert.deepEqual(items.filter((i: any) => i.alreadyPublished).map((i: any) => i.key), ["Q1"]);
  // A pendência da discursiva mantém o lote aberto; republicar não duplica.
  const again = await fetch(`${base}/api/imports/${id}/publish`, json(admin, "POST", {}));
  assert.deepEqual(await again.json(), { published: 0, alreadyPublished: 1 });
});

test("the batch check lists gaps, repeats, annulled items and a non-definitive key without guessing", async () => {
  const { checkBatch } = await import("../scripts/import-exam.mjs");
  const items = [
    { key: "Q1", number: 1, kind: "OBJECTIVE", answer: "A" },
    { key: "Q1", number: 1, kind: "OBJECTIVE", answer: "A" },
    { key: "Q3", number: 3, kind: "OBJECTIVE", answer: null },
  ];
  const answers = new Map([["Q1", "A"], ["Q2", "C"], ["Q4", "ANULADA"], ["D1", "DISCURSIVA"]]);
  const { issues, placeholders } = checkBatch(items, answers, false);
  assert.deepEqual(placeholders.map((p: any) => [p.key, p.answer, p.boxes.length]), [["Q2", "C", 0], ["Q4", "ANULADA", 0]]);
  assert.ok(issues.some((i: string) => i.includes("número 1 aparece 2 vezes")));
  assert.ok(issues.some((i: string) => i.includes("questão 2 está no gabarito mas não foi encontrada")));
  assert.ok(issues.some((i: string) => i.includes("questão 3 não tem letra")));
  assert.ok(issues.some((i: string) => i.includes("1 questão(ões) anulada(s)")));
  assert.ok(issues.some((i: string) => i.includes("não se declara definitivo")));
});

test("a confirmed discursive item publishes prompt and response standard; students write, submit and self-assess", async () => {
  const admin = await session(true);
  const exam = pdf(randomUUID()), key = pdf(randomUUID()), standard = pdf(randomUUID());
  for (const file of [exam, key, standard]) await writeFile(path.join(archiveDir, `${sha(file)}.pdf`), file);
  const id = randomUUID();
  imports.push(id);
  const adminId = (await db.query("SELECT identity_id FROM account WHERE email=$1", [emails.at(-1)])).rows[0].identity_id;
  const sizes = JSON.stringify([{ width: 612, height: 792 }]);
  await db.query(
    `INSERT INTO exam_import(id,year,modality,exam_url,key_url,standard_url,exam_sha256,key_sha256,standard_sha256,
       page_count,page_sizes,standard_page_sizes,state,created_by)
     VALUES($1,2099,'BACHARELADO','https://download.inep.gov.br/enade/test-only/p.pdf','https://download.inep.gov.br/enade/test-only/g.pdf',
       'https://download.inep.gov.br/enade/test-only/pr.pdf',$2,$3,$4,1,$5,$5,'READY',$6)`,
    [id, sha(exam), sha(key), sha(standard), sizes, adminId],
  );
  await db.query(
    `INSERT INTO exam_import_item(import_id,question_key,number,kind,boxes,criteria)
     VALUES($1,'D3',3,'DISCURSIVE','[{"page":1,"x0":40,"y0":40,"x1":400,"y1":200}]','[{"label":"a","points":5},{"label":"b","points":5}]')`,
    [id],
  );
  assert.equal((await fetch(`${base}/api/imports/${id}/pages/1?doc=standard`, { headers: { Cookie: admin } })).headers.get("content-type"), "image/png");
  const edit = (body: unknown) => fetch(`${base}/api/imports/${id}/items/D3`, json(admin, "PUT", body));
  const boxes = [{ page: 1, x0: 40, y0: 40, x1: 400, y1: 200 }];
  const standardBoxes = [{ page: 1, x0: 40, y0: 300, x1: 500, y1: 420 }];
  assert.equal((await edit({ boxes, standardBoxes, criteria: [{ label: "a", points: 5 }, { label: "a", points: 5 }],
    status: "CONFIRMED", area: "Teoria da computação", revision: 1 })).status, 400); // rótulo repetido
  const criteria = [{ label: "a", points: 4 }, { label: "b", points: 6 }];
  assert.deepEqual(await (await edit({ boxes, standardBoxes, criteria, status: "CONFIRMED", area: "Teoria da computação",
    subject: "TEST ONLY lógica", revision: 1 })).json(), { revision: 2 });
  assert.deepEqual(await (await fetch(`${base}/api/imports/${id}/publish`, json(admin, "POST", {}))).json(),
    { published: 1, alreadyPublished: 0 });

  const questionId = `discursive-${sha(exam).slice(0, 12)}-d3`;
  const student = await session(false);
  const call = (path: string, method = "GET", body?: unknown) =>
    fetch(`${base}/api/discursive${path}`, body === undefined ? { method, headers: { Cookie: student } } : json(student, method, body));
  const listed = (await (await call("")).json()).find((q: any) => q.id === questionId);
  assert.deepEqual([listed.title, listed.status, listed.area], ["ENADE 2099 · Discursiva 3", "NEW", "Teoria da computação"]);
  const before = await (await call(`/${questionId}`)).json();
  assert.equal(before.promptImages.length, 1);
  assert.deepEqual(before.standardImages, []); // o padrão só aparece depois do envio
  assert.deepEqual(before.criteria, criteria);
  const standardAsset = (await db.query("SELECT asset_sha256 FROM discursive_image WHERE question_id=$1 AND part='STANDARD'", [questionId])).rows[0].asset_sha256;
  const standardUrl = `${base}/api/question-images/${standardAsset}.webp`;
  assert.equal((await fetch(standardUrl, { headers: { Cookie: student } })).status, 404);
  assert.equal((await fetch(`${base}${before.promptImages[0].url}`, { headers: { Cookie: student } })).status, 200);

  assert.equal((await call(`/${questionId}/assessment`, "PUT", { levels: [2, 2] })).status, 409); // ainda não enviou
  assert.deepEqual(await (await call(`/${questionId}/response`, "PUT", { body: "TEST ONLY rascunho", baseRevision: 0 })).json(), { revision: 1 });
  assert.equal((await call(`/${questionId}/response`, "PUT", { body: "TEST ONLY outra aba", baseRevision: 0 })).status, 409);
  const submitted = await (await call(`/${questionId}/submit`, "POST", { body: "TEST ONLY resposta final", baseRevision: 1 })).json();
  assert.equal(submitted.standardImages.length, 1);
  assert.ok(submitted.response.submittedAt);
  assert.equal((await fetch(standardUrl, { headers: { Cookie: student } })).status, 200);
  assert.equal((await call(`/${questionId}/response`, "PUT", { body: "TEST ONLY mudar", baseRevision: 2 })).status, 409);
  await assert.rejects(db.query("UPDATE discursive_response SET body='x' WHERE question_id=$1", [questionId]), /immutable/);

  assert.equal((await call(`/${questionId}/assessment`, "PUT", { levels: [2] })).status, 400);
  // a vale 4: contemplado (4); b vale 6: em parte (3) → 7.
  assert.deepEqual(await (await call(`/${questionId}/assessment`, "PUT", { levels: [2, 1] })).json(), { levels: [2, 1], score: 7 });
  const after = (await (await call("")).json()).find((q: any) => q.id === questionId);
  assert.deepEqual([after.status, after.score], ["ASSESSED", 7]);
  // Sem pendências, o lote fecha como publicado.
  assert.equal((await fetch(`${base}/api/imports/${id}/publish`, json(admin, "POST", {}))).status, 409);
});
