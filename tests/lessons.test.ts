import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp, db } from "../apps/api/src/main.js";
import { authorize } from "../apps/api/src/roles.js";
import { parseRoster } from "../apps/api/src/lessons.js";

// Turmas, pessoas e contas TEST ONLY; a limpeza remove só o que este arquivo criou.
let app: Awaited<ReturnType<typeof createApp>>, base: string;
const emails: string[] = [];
const classes: string[] = [];
const enrollment = () => `PE${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});
after(async () => {
  try {
    await db.query("DELETE FROM study_class WHERE id=ANY($1::uuid[])", [classes]);
    const ids = (await db.query("SELECT identity_id FROM account WHERE email=ANY($1)", [emails])).rows.map((r) => r.identity_id);
    await db.query("DELETE FROM role_event WHERE email=ANY($1)", [emails]);
    await db.query("DELETE FROM account_role WHERE identity_id=ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM browser_session WHERE identity_id=ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM account WHERE identity_id=ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM study_identity WHERE id=ANY($1::uuid[])", [ids]);
  } finally {
    await app.close();
    await db.end();
  }
});

async function account(role?: "PROFESSOR", profile: Record<string, string> = {}) {
  const guest = await fetch(`${base}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  let cookie = guest.headers.get("set-cookie")!.split(";")[0];
  const email = `aula-${randomUUID()}@example.invalid`;
  emails.push(email);
  const created = await fetch(`${base}/api/auth/register`, {
    method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Aula teste 2026!", ...profile }),
  });
  cookie = created.headers.get("set-cookie")!.split(";")[0];
  const id = (await db.query("SELECT identity_id FROM account WHERE email=$1", [email])).rows[0].identity_id;
  if (role) {
    const client = await db.connect();
    try { await authorize(client, email, role, null); } finally { client.release(); }
  }
  return { cookie, id };
}
const call = (cookie: string, path: string, method = "GET", body?: unknown) => fetch(`${base}/api/${path}`, {
  method, headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test("the roster parser reads pasted spreadsheet rows in any column order and skips headers", () => {
  const { rows, skipped } = parseRoster("Nome\tProntuário\tE-mail\nAna Souza\tpe3012345\tana@ifsp.edu.br\nPE3099999;Bruno Lima\nsem prontuário\n");
  assert.deepEqual(rows, [
    { name: "Ana Souza", enrollment: "PE3012345", email: "ana@ifsp.edu.br" },
    { name: "Bruno Lima", enrollment: "PE3099999", email: null },
  ]);
  assert.equal(skipped, 2);
});

test("professors run classes, roll calls and exports; students see only their own lessons", async () => {
  const student = await account();
  assert.equal((await call(student.cookie, "classes")).status, 403);
  const professor = await account("PROFESSOR", { name: "Prof TEST ONLY" });

  const created = await call(professor.cookie, "classes", "POST", { name: "TEST ONLY Preparação 2026", editionYear: 2026 });
  const { id } = await created.json();
  classes.push(id);
  const linked = enrollment(), other = enrollment();
  const imported = await (await call(professor.cookie, `classes/${id}/members`, "POST", {
    text: `Nome;Prontuário\nAluna TEST ONLY;${linked}\nAluno TEST ONLY;${other}\n`,
  })).json();
  assert.deepEqual(imported, { added: 2, updated: 0, skipped: 1 });
  const again = await (await call(professor.cookie, `classes/${id}/members`, "POST", { text: `Aluna Renomeada;${linked}` })).json();
  assert.deepEqual(again, { added: 0, updated: 1, skipped: 0 });

  const lesson = await (await call(professor.cookie, `classes/${id}/lessons`, "POST", {
    startsAt: "2026-11-03T22:00:00Z", endsAt: "2026-11-04T00:00:00Z", room: "Lab 3", subject: "Redes", topic: "TCP", teacherId: professor.id,
  })).json();
  assert.equal((await call(professor.cookie, `classes/${id}/lessons`, "POST", {
    startsAt: "2026-11-04T00:00:00Z", endsAt: "2026-11-03T22:00:00Z", room: "Lab 3", subject: "Redes", teacherId: professor.id,
  })).status, 400);

  const roll = await (await call(professor.cookie, `lessons/${lesson.id}`)).json();
  assert.equal(roll.roll.length, 2);
  const [first, second] = roll.roll;
  const marked = await call(professor.cookie, `lessons/${lesson.id}/attendance`, "PUT", {
    entries: [{ memberId: first.id, status: "PRESENT" }, { memberId: second.id, status: "EXCUSED", note: "TEST ONLY atestado" }],
  });
  assert.equal(marked.status, 200);
  // Pessoa de outra turma não entra na chamada.
  const otherClass = await (await call(professor.cookie, "classes", "POST", { name: "TEST ONLY outra", editionYear: 2026 })).json();
  classes.push(otherClass.id);
  await call(professor.cookie, `classes/${otherClass.id}/members`, "POST", { text: `Outra Pessoa;${enrollment()}` });
  const stranger = (await (await call(professor.cookie, `classes/${otherClass.id}`)).json()).members[0];
  assert.equal((await call(professor.cookie, `lessons/${lesson.id}/attendance`, "PUT", {
    entries: [{ memberId: stranger.id, status: "PRESENT" }],
  })).status, 400);

  const csv = await (await call(professor.cookie, `classes/${id}/attendance.csv`)).text();
  assert.match(csv, /Nome;Prontuário;\d{2}\/\d{2}\/\d{4};Presenças;%/);
  assert.match(csv, new RegExp(`${linked};(P|J);`));

  // O aluno que cria conta com o prontuário da lista vê a aula e a presença.
  const enrolled = await account(undefined, { enrollment: linked });
  const mine = await (await call(enrolled.cookie, "my/lessons")).json();
  assert.equal(mine.lessons.length, 1);
  assert.equal(mine.lessons[0].room, "Lab 3");
  assert.ok(["PRESENT", "EXCUSED"].includes(mine.lessons[0].status));
  assert.deepEqual(await (await call(student.cookie, "my/lessons")).json(), { lessons: [] });
  const detail = await (await call(professor.cookie, `classes/${id}`)).json();
  assert.equal(detail.members.find((m: any) => m.enrollment === linked).hasAccount, true);
});
