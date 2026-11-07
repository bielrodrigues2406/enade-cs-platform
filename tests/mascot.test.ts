import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createApp, db } from "../apps/api/src/main.js";

let app: Awaited<ReturnType<typeof createApp>>, base: string;
const owners: string[] = [];
type Actor = { cookie: string; id: string };
before(async () => { app = await createApp(); await app.listen(0, "127.0.0.1"); base = await app.getUrl(); });
after(async () => {
  try { for (const id of owners) {
    await db.query("DELETE FROM answer WHERE owner_id=$1", [id]);
    await db.query("DELETE FROM browser_session WHERE identity_id=$1", [id]);
    await db.query("DELETE FROM account WHERE identity_id=$1", [id]);
    await db.query("DELETE FROM study_identity WHERE id=$1", [id]);
  } }
  finally { await app.close(); await db.end(); }
});
function request(path: string, actor?: Actor, method = "GET", body?: unknown) {
  return fetch(`${base}/api/${path}`, {
    method, headers: { "Content-Type": "application/json", Cookie: actor?.cookie ?? "" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
}
async function actor(account = false): Promise<Actor> {
  const response = await request("session", undefined, "POST", {});
  assert.ok(response.ok);
  let cookie = response.headers.get("set-cookie")!.split(";")[0];
  const digest = createHash("sha256").update(cookie.slice(14)).digest("hex");
  const { id } = (await db.query<{ id: string }>("SELECT identity_id AS id FROM browser_session WHERE token_hash=$1", [digest])).rows[0];
  owners.push(id);
  if (account) {
    const registered = await request("auth/register", { cookie, id }, "POST", {
      name: "Pessoa TEST ONLY", email: `mascot-${randomUUID()}@example.invalid`, password: `Pato ${randomUUID()}`,
    });
    assert.equal(registered.status, 201, await registered.text());
    cookie = registered.headers.get("set-cookie")!.split(";")[0];
  }
  return { cookie, id };
}
async function question() {
  return (await db.query<{ id: string; correct: string; wrong: string }>(
    `SELECT v.id,v.correct_option_id AS correct,
      (SELECT o.id FROM question_option o WHERE o.question_id=v.id AND o.id<>v.correct_option_id LIMIT 1) AS wrong
     FROM editorial_question q JOIN question_version v ON v.id=q.current_version_id
     WHERE v.demonstration=true AND v.origin='AUTHOR_CREATED' ORDER BY v.id LIMIT 1`,
  )).rows[0];
}
async function wrongAnswer(owner: Actor) {
  const q = await question();
  const saved = await request(`questions/${q.id}/answer`, owner, "PUT", { optionId: q.wrong, baseRevision: 0 });
  assert.equal(saved.status, 200); return q;
}

test("mascot preference belongs to the account and rejects guest or owner input", async () => {
  const a = await actor(true), b = await actor(true), guest = await actor();
  assert.equal((await request("me/preferences", guest)).status, 401);
  assert.deepEqual(await (await request("me/preferences", a)).json(), { mascotEnabled: true });
  assert.equal((await request("me/preferences", a, "PUT", { mascotEnabled: false, ownerId: b.id })).status, 400);
  assert.deepEqual(await (await request("me/preferences", a, "PUT", { mascotEnabled: false })).json(), { mascotEnabled: false });
  assert.deepEqual(await (await request("me/preferences", a)).json(), { mascotEnabled: false });
  assert.deepEqual(await (await request("me/preferences", b)).json(), { mascotEnabled: true });
  assert.equal((await request("me/preferences", a, "PUT", { mascotEnabled: "false" })).status, 400);
});

test("reflection requires the owner's incorrect answer and never exposes another person's note", async () => {
  const a = await actor(), b = await actor(), q = await question();
  const path = `review/${q.id}/reflection`;
  assert.equal((await request(path, a)).status, 404);
  assert.equal((await request(path, a, "PUT", { text: "TEST ONLY", revision: 0 })).status, 404);
  await wrongAnswer(a);
  assert.deepEqual(await (await request(path, a)).json(), { text: "", revision: 0 });
  assert.deepEqual(await (await request(path, a, "PUT", { text: "Confundi o conceito. TEST ONLY", revision: 0 })).json(),
    { text: "Confundi o conceito. TEST ONLY", revision: 1 });
  assert.equal((await request(path, b)).status, 404);
  assert.equal((await request(path, b, "PUT", { text: "TEST ONLY", revision: 0 })).status, 404);
});

test("reflection retries are idempotent and stale changes conflict", async () => {
  const a = await actor(), q = await wrongAnswer(a), path = `review/${q.id}/reflection`;
  const body = { text: "TEST ONLY <script>não executar</script>", revision: 0 };
  const first = await (await request(path, a, "PUT", body)).json();
  assert.deepEqual(await (await request(path, a, "PUT", body)).json(), first);
  assert.equal((await request(path, a, "PUT", { text: "outro texto", revision: 0 })).status, 409);
  assert.equal((await request(path, a, "PUT", { text: "x".repeat(601), revision: 1 })).status, 400);
  assert.deepEqual(await (await request(path, a, "PUT", { text: "", revision: 1 })).json(), { text: "", revision: 2 });
});

test("concurrent reflection changes preserve one acknowledged revision", async () => {
  const a = await actor(), q = await wrongAnswer(a), path = `review/${q.id}/reflection`;
  const replies = await Promise.all(["um", "dois"].map(text => request(path, a, "PUT", { text, revision: 0 })));
  assert.deepEqual(replies.map(r => r.status).sort(), [200, 409]);
  const saved = await (await request(path, a)).json(); assert.equal(saved.revision, 1);
  assert.ok(["um", "dois"].includes(saved.text));
});

test("the error notebook retains the personal reflection; a corrected answer cannot edit it", async () => {
  const a = await actor(), q = await wrongAnswer(a), path = `review/${q.id}/reflection`;
  await request(path, a, "PUT", { text: "TEST ONLY: revisar este conceito", revision: 0 });
  const notebook = await (await request("review", a)).json();
  assert.equal(notebook.items.find((item: { id: string }) => item.id === q.id).reflection, "TEST ONLY: revisar este conceito");
  assert.equal((await request(`questions/${q.id}/answer`, a, "PUT", { optionId: q.correct, baseRevision: 1 })).status, 200);
  assert.equal((await request(path, a, "PUT", { text: "novo", revision: 1 })).status, 409);
});
