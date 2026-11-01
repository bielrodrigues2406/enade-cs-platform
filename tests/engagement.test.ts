import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createApp, db } from "../apps/api/src/main.js";
import { addDays, currentStreak, rankingName } from "../apps/api/src/engagement.js";
import { nextInterval, preview, retrievability, review } from "../apps/api/src/fsrs.js";
import { parseDeck } from "../apps/api/src/study-content.js";

// Meta diária, conquistas, ranking e flashcards (ENG-1, FLASH-1). Usa a
// questão demonstrativa da base e contas TEST ONLY criadas aqui.

let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
const identities: string[] = [];

before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});

after(async () => {
  try {
    // Sessões, respostas e contas não apagam em cascata: limpa na ordem das chaves.
    for (const table of ["browser_session", "answer", "account"])
      await db.query(`DELETE FROM ${table} WHERE ${table === "answer" ? "owner_id" : "identity_id"}=ANY($1::uuid[])`, [identities]);
    await db.query("DELETE FROM study_identity WHERE id=ANY($1::uuid[])", [identities]);
  } finally {
    await app.close();
    await db.end();
  }
});

async function call(path: string, cookie: string, method = "GET", body?: unknown) {
  return fetch(`${base}/api/${path}`, {
    method, headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function json(path: string, cookie: string, method = "GET", body?: unknown) {
  const response = await call(path, cookie, method, body);
  assert.equal(response.status, method === "POST" && path.endsWith("register") ? 201 : 200, `${method} ${path}`);
  return response.json();
}
/** Visitante novo; guarda a identidade pelo hash do token, para a limpeza. */
async function guest() {
  const response = await fetch(`${base}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const token = cookie.split("=")[1];
  const id = (await db.query("SELECT identity_id FROM browser_session WHERE token_hash=$1",
    [createHash("sha256").update(token).digest("hex")])).rows[0]?.identity_id;
  if (id) identities.push(id);
  return cookie;
}

test("streak counts days with the goal met and forgives one missed day per week", () => {
  const today = "2026-11-05"; // quinta-feira
  const counts = new Map([[today, 5], [addDays(today, -1), 5], [addDays(today, -3), 6], [addDays(today, -4), 5]]);
  // Falta na terça (−2): uma folga na semana; segunda (−3) e domingo (−4) continuam a sequência.
  assert.deepEqual(currentStreak(counts, 5, today), { streak: 4, forgiven: [addDays(today, -2)] });
  // Duas faltas na mesma semana quebram.
  counts.delete(addDays(today, -3));
  assert.equal(currentStreak(counts, 5, today).streak, 2);
  // Hoje ainda não bateu: a sequência vem de ontem.
  assert.equal(currentStreak(new Map([[addDays(today, -1), 5]]), 5, today).streak, 1);
  assert.equal(rankingName("Maria da Silva Souza"), "Maria S.");
  assert.equal(rankingName(null), "Estudante");
});

test("FSRS-5 grows intervals on recall, shrinks them on lapse and follows its retrievability curve", () => {
  assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 1e-9, "R(S,S) = 90%");
  assert.equal(nextInterval(10), 10, "com 90% de retenção, o intervalo é a própria estabilidade");
  let memory = review(null, null, 3);
  const intervals = [memory.dueInMinutes];
  for (let i = 0; i < 3; i++) {
    memory = review(memory, memory.dueInMinutes / 1440, 3);
    intervals.push(memory.dueInMinutes);
  }
  assert.ok(intervals.every((v, i) => i === 0 || v > intervals[i - 1]), `intervalos crescem: ${intervals}`);
  const lapse = review(memory, memory.dueInMinutes / 1440, 1);
  assert.equal(lapse.dueInMinutes, 10);
  assert.ok(lapse.stability < memory.stability && lapse.difficulty > memory.difficulty);
  const options = preview(memory, memory.dueInMinutes / 1440);
  assert.ok(options[0] < options[1] && options[1] <= options[2] && options[2] < options[3], `prévia ordenada: ${options}`);
  assert.throws(() => parseDeck({ deck: "x", cards: [] }, "TEST ONLY"));
});

test("answering updates today's goal, unlocks achievements once and reports them as new until seen", async () => {
  const cookie = await guest();
  let state = await json("me/engagement", cookie);
  assert.deepEqual([state.goal, state.today, state.streak], [5, 0, 0]);
  await json("me/goal", cookie, "PUT", { dailyTarget: 1 });
  assert.equal((await call("me/goal", cookie, "PUT", { dailyTarget: 0 })).status, 400);
  await json("questions/demo-sql-v1/answer", cookie, "PUT", { optionId: "demo-sql-v1-1", baseRevision: 0 });
  state = await json("me/engagement", cookie);
  assert.deepEqual([state.goal, state.today, state.streak], [1, 1, 1]);
  const codes = (list: any[]) => list.filter((a) => a.isNew).map((a) => a.code).sort();
  assert.deepEqual(codes(state.achievements), ["meta-batida", "primeira-resposta"]);
  await json("me/achievements/seen", cookie, "POST", {});
  assert.deepEqual(codes((await json("me/engagement", cookie)).achievements), []);
  const streak = state.achievements.find((a: any) => a.code === "sequencia-3");
  assert.deepEqual(streak.progress, { value: 1, target: 3 });
});

test("flashcards schedule each card per person and only accept known cards and grades", async () => {
  const cookie = await guest();
  const decks = await json("flashcards", cookie);
  assert.ok(decks.decks.length >= 10, "baralhos do repositório");
  const deck = decks.decks[0];
  const session = await json(`flashcards/session?deck=${deck.deck}`, cookie);
  assert.ok(session.cards.length > 0 && session.cards.every((c: any) => c.isNew && c.preview.length === 4));
  const card = session.cards[0];
  const good = await json(`flashcards/${card.id}/review`, cookie, "POST", { grade: 3 });
  assert.ok(good.dueInMinutes >= 1440, "acertou: volta em dias");
  const again = await json(`flashcards/${card.id}/review`, cookie, "POST", { grade: 1 });
  assert.equal(again.dueInMinutes, 10);
  assert.equal((await call(`flashcards/${card.id}/review`, cookie, "POST", { grade: 5 })).status, 400);
  assert.equal((await call("flashcards/nao-existe-000/review", cookie, "POST", { grade: 3 })).status, 404);
  const after = (await json("flashcards", cookie)).decks.find((d: any) => d.deck === deck.deck);
  assert.equal(after.fresh, deck.fresh - 1);
  assert.equal((await json("flashcards", cookie)).reviewedToday, 2);
  // Outra pessoa não vê o progresso desta.
  assert.equal((await json("flashcards", await guest())).decks.find((d: any) => d.deck === deck.deck).fresh, deck.fresh);
  const sheets = await json("sheets", cookie);
  assert.ok(sheets.length >= 10);
  const sheet = await json(`sheets/${sheets[0].slug}`, cookie);
  assert.ok(sheet.sections.length > 0);
  assert.equal((await call("sheets/nao-existe", cookie)).status, 404);
});

test("the constancy ranking lists only accounts that stay visible, by days studied", async () => {
  const cookie = await guest();
  const email = `ranking-${randomUUID()}@example.invalid`;
  const registered = await call("auth/register", cookie, "POST", { email, password: `test-only-${randomUUID()}`, name: "Ranqueada Teste" });
  assert.equal(registered.status, 201);
  const account = registered.headers.get("set-cookie")!.split(";")[0];
  await json("questions/demo-sql-v1/answer", account, "PUT", { optionId: "demo-sql-v1-1", baseRevision: 0 });
  let ranking = await json("ranking", account);
  // O banco de teste tem outras contas: confere pela posição da própria pessoa.
  assert.ok(ranking.me.position >= 1 && ranking.me.days7 === 1);
  const mine = ranking.top.find((row: any) => row.me);
  if (mine) assert.equal(mine.name, "Ranqueada T.");
  assert.equal(ranking.canJoin, true);
  await json("me/ranking", account, "PUT", { visible: false });
  ranking = await json("ranking", account);
  assert.ok(!ranking.top.some((row: any) => row.me));
  assert.deepEqual([ranking.visible, ranking.me.position], [false, null]);
  // Visitante sem conta vê o ranking, mas não entra nele.
  const visitor = await guest();
  assert.equal((await json("ranking", visitor)).canJoin, false);
  assert.equal((await call("me/ranking", visitor, "PUT", { visible: true })).status, 403);
});
