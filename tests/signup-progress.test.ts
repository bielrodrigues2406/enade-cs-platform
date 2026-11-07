import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createApp, db } from "../apps/api/src/main.js";
import { formatFixture } from "./enade-format-fixture.js";

// Conteúdo sintético isolado: cadastro promove a identidade visitante,
// sem copiar, apagar ou misturar o histórico de outras contas.
let app: Awaited<ReturnType<typeof createApp>>, base: string;
let fixture: Awaited<ReturnType<typeof formatFixture>>;
const owners: string[] = [];
type Actor = { id: string; cookie: string };

before(async () => {
  fixture = await formatFixture(db);
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});
after(async () => {
  try {
    await db.query("DELETE FROM answer WHERE owner_id=ANY($1::uuid[])", [owners]);
    await fixture?.cleanup(owners);
  } finally { await app?.close(); await db.end(); }
});

function request(path: string, user?: Actor, method = "GET", body?: unknown) {
  return fetch(`${base}/api/${path}`, {
    method, headers: { Cookie: user?.cookie ?? "", "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20_000),
  });
}
async function json(path: string, user: Actor, method = "GET", body?: unknown, status = 200) {
  const response = await request(path, user, method, body);
  assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`);
  return response.json();
}
async function actorFrom(response: Response): Promise<Actor> {
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const hash = createHash("sha256").update(cookie.slice(14)).digest("hex");
  const { identity_id: id } = (await db.query(
    "SELECT identity_id FROM browser_session WHERE token_hash=$1", [hash],
  )).rows[0];
  if (!owners.includes(id)) owners.push(id);
  return { id, cookie };
}
async function guest(): Promise<Actor> {
  const response = await request("session", undefined, "POST", {});
  assert.equal(response.status, 201);
  return actorFrom(response);
}
async function snapshot(user: Actor, attemptId: string) {
  const [answer, progress, engagement, cards, attempt, essay, freeEssay] = await Promise.all([
    json("questions/demo-sql-v1", user), json("me/progress", user),
    json("me/engagement", user), json("flashcards", user),
    json(`practice/${attemptId}`, user), json(`practice/${attemptId}/discursive`, user),
    json(`discursive/${fixture.discursive}`, user),
  ]);
  return {
    answer: answer.answer,
    progress,
    engagement,
    cards,
    attempt: { id: attempt.id, state: attempt.state, items: attempt.items, discursive: attempt.discursive },
    essay: essay.response,
    freeEssay: freeEssay.response,
  };
}

test("signup preserves guest study, goal, achievements, flashcards, practice and both essay drafts across a new login", async () => {
  const visitor = await guest();
  await json("me/goal", visitor, "PUT", { dailyTarget: 1 });
  await json("questions/demo-sql-v1/answer", visitor, "PUT", { optionId: "demo-sql-v1-1", baseRevision: 0 });
  const deck = (await json("flashcards", visitor)).decks[0];
  const card = (await json(`flashcards/session?deck=${encodeURIComponent(deck.deck)}`, visitor)).cards[0];
  await json(`flashcards/${card.id}/review`, visitor, "POST", { grade: 3 });
  const attempt = await json("formats/enade-2026/attempts", visitor, "POST", { requestId: randomUUID() }, 201);
  await json(`practice/${attempt.id}/items/1`, visitor, "PUT", {
    optionId: attempt.items[0].question.options[0].id, marked: true, baseRevision: 0,
  });
  await json(`practice/${attempt.id}/discursive/response`, visitor, "PUT", {
    body: "TEST ONLY private essay draft before signup", baseRevision: 0,
  });
  await json(`discursive/${fixture.discursive}/response`, visitor, "PUT", {
    body: "TEST ONLY free-study essay draft before signup", baseRevision: 0,
  });
  const before = await snapshot(visitor, attempt.id);
  assert.equal(before.answer.optionId, "demo-sql-v1-1");
  assert.equal(before.progress.active.id, attempt.id);
  assert.equal(before.engagement.goal, 1);
  assert.ok(before.engagement.today > 0);
  assert.ok(before.engagement.achievements.some((row: any) => row.unlockedAt));
  assert.equal(before.cards.reviewedToday, 1);

  const credentials = { email: `signup-progress-${randomUUID()}@example.invalid`, password: `Pato ${randomUUID()}`, name: "TEST ONLY visitor" };
  const registered = await request("auth/register", visitor, "POST", credentials);
  assert.equal(registered.status, 201, await registered.clone().text());
  const account = await actorFrom(registered);
  assert.equal(account.id, visitor.id, "cadastro conserva a mesma identidade, sem migrar ou apagar dados");
  assert.notEqual(account.cookie, visitor.cookie);
  assert.equal((await request("me/progress", visitor)).status, 401, "cookie visitante antigo é revogado");
  assert.deepEqual(await snapshot(account, attempt.id), before);

  const otherBrowser = await guest();
  const loggedIn = await request("auth/login", otherBrowser, "POST", credentials);
  assert.equal(loggedIn.status, 200);
  const resumed = await actorFrom(loggedIn);
  assert.equal(resumed.id, visitor.id);
  assert.deepEqual(await snapshot(resumed, attempt.id), before);
});
