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
      "SELECT s.id FROM source_document s JOIN exam_import i ON s.sha256 IN (i.exam_sha256,i.key_sha256) WHERE i.id=ANY($1::uuid[])",
      [imports],
    )).rows.map((r) => r.id);
    await db.query("DELETE FROM editorial_question WHERE official_exam_id=ANY($1::uuid[])", [sources]);
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
    `INSERT INTO exam_import_item(import_id,question_key,number,kind,answer,boxes,prompt,options) VALUES
     ($1,'Q1',1,'OBJECTIVE','B','[{"page":1,"x0":40,"y0":40,"x1":400,"y1":120}]','TEST ONLY','[{"letter":"A","text":"TEST ONLY a"}]'),
     ($1,'D1',1,'DISCURSIVE',NULL,'[]','',  '[]')`,
    [id],
  );
  const page = await fetch(`${base}/api/imports/${id}/pages/1`, { headers: { Cookie: admin } });
  assert.equal(page.headers.get("content-type"), "image/png");

  const edit = (key: string, body: unknown) => fetch(`${base}/api/imports/${id}/items/${key}`, json(admin, "PUT", body));
  const boxes = [{ page: 1, x0: 50, y0: 60, x1: 420, y1: 140 }];
  assert.equal((await edit("Q1", { boxes, status: "CONFIRMED", revision: 1 })).status, 400); // sem área
  assert.equal((await edit("Q1", { boxes: [{ page: 1, x0: 0, y0: 0, x1: 900, y1: 100 }], status: "PENDING", revision: 1 })).status, 400);
  const saved = await edit("Q1", { boxes, status: "CONFIRMED", area: "Redes", subject: "TEST ONLY roteamento", revision: 1 });
  assert.deepEqual(await saved.json(), { revision: 2 });
  assert.equal((await edit("Q1", { boxes, status: "CONFIRMED", area: "Redes", revision: 1 })).status, 409); // revisão antiga
  assert.equal((await edit("D1", { boxes, status: "CONFIRMED", area: "Redes", revision: 1 })).status, 409); // discursiva

  const published = await fetch(`${base}/api/imports/${id}/publish`, json(admin, "POST", {}));
  assert.deepEqual(await published.json(), { published: 1, alreadyPublished: 0 });
  const version = (await db.query(
    "SELECT * FROM question_version WHERE question_id=$1", [`official-${sha(exam).slice(0, 12)}-q1`],
  )).rows[0];
  assert.deepEqual([version.review_origin, version.presentation, version.correct_option_id, version.subject, version.editorial_status],
    ["IMPORT", "IMAGE", "B", "TEST ONLY roteamento", "PUBLISHED"]);
  assert.equal(version.reviewed_by, adminId);
  const detail = await (await fetch(`${base}/api/questions/${version.id}`, { headers: { Cookie: admin } })).json();
  assert.equal(detail.images.length, 1);
  assert.equal(detail.images[0].width, Math.round((420 * 200) / 72) - Math.round((50 * 200) / 72));

  // A pendência da discursiva mantém o lote aberto; republicar não duplica.
  const again = await fetch(`${base}/api/imports/${id}/publish`, json(admin, "POST", {}));
  assert.deepEqual(await again.json(), { published: 0, alreadyPublished: 1 });
});
