import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as pollDelay } from "node:timers/promises";
import { createApp, db } from "../apps/api/src/main.js";

let app: Awaited<ReturnType<typeof createApp>>, base: string;
const owners = new Set<string>(),
  questions = new Set<string>();
type Actor = { cookie: string; id: string };
before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});
after(async () => {
  try {
    for (const id of owners)
      await db.query("DELETE FROM answer WHERE owner_id=$1", [id]);
    for (const id of questions)
      await db.query("DELETE FROM editorial_question WHERE id=$1", [id]);
    for (const id of owners) {
      await db.query("DELETE FROM browser_session WHERE identity_id=$1", [id]);
      await db.query("DELETE FROM account WHERE identity_id=$1", [id]);
      await db.query("DELETE FROM study_identity WHERE id=$1", [id]);
    }
  } finally {
    await app.close();
    await db.end();
  }
});
function request(path: string, cookie = "", method = "GET", body?: unknown) {
  return fetch(`${base}/api/${path}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
}
async function actor(response?: Response): Promise<Actor> {
  const res = response ?? (await request("session", "", "POST", {}));
  const cookie = res.headers.get("set-cookie")!.split(";")[0];
  const hash = createHash("sha256").update(cookie.slice(14)).digest("hex");
  const id = (
    await db.query(
      "SELECT identity_id FROM browser_session WHERE token_hash=$1",
      [hash],
    )
  ).rows[0].identity_id;
  owners.add(id);
  return { cookie, id };
}
async function fixture(
  topic = "Revisão sintética",
  parent?: string,
  sequence = 1,
  published = true,
) {
  const question = parent ?? `review-fixture-${randomUUID()}`,
    id = randomUUID();
  questions.add(question);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (!parent)
      await client.query(
        "INSERT INTO editorial_question(id,origin) VALUES($1,'AUTHOR_CREATED')",
        [question],
      );
    await client.query(
      "INSERT INTO question_version(id,question_id,version_number,title,topic,prompt,origin,editorial_status,explanation,correct_option_id,demonstration,author_credit) VALUES($1,$2,$3,$4,$5,'Enunciado sintético','AUTHOR_CREATED','DRAFT','Comentário privado da fixture','a',true,'Fixture sintética de teste')",
      [id, question, sequence, `Fixture revisão ${id}`, topic],
    );
    await client.query(
      "INSERT INTO question_option(question_id,id,text,position) VALUES($1,'a','Correta sintética',0),($1,'b','Incorreta sintética',1)",
      [id],
    );
    if (published) {
      await client.query(
        "UPDATE question_version SET editorial_status='PUBLISHED' WHERE id=$1",
        [id],
      );
      await client.query(
        "UPDATE editorial_question SET current_version_id=$2 WHERE id=$1",
        [question, id],
      );
    }
    await client.query("COMMIT");
    return { id, question };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
async function save(user: Actor, id: string, optionId = "b", baseRevision = 0) {
  const response = await request(`questions/${id}/answer`, user.cookie, "PUT", {
    optionId,
    baseRevision,
  });
  assert.equal(response.status, 200);
  return response.json();
}
async function notebook(user: Actor, query = "") {
  const response = await request("review" + query, user.cookie);
  assert.equal(response.status, 200);
  return response.json();
}

test("review requires a valid session and returns an honest empty notebook", async () => {
  assert.equal((await request("review")).status, 401);
  const user = await actor();
  assert.deepEqual(await notebook(user), {
    summary: { answered: 0, correct: 0, incorrect: 0, demonstration: 0 },
    topics: [],
    total: 0,
    items: [],
    offset: 0,
    pageSize: 20,
  });
  await db.query(
    "UPDATE browser_session SET expires_at=now()-interval '1 second' WHERE identity_id=$1",
    [user.id],
  );
  assert.equal((await request("review", user.cookie)).status, 401);
});

test("review isolates owners, counts distinct questions and removes corrected errors only after saving", async () => {
  const user = await actor(),
    other = await actor(),
    q = await fixture();
  await save(user, q.id);
  let data = await notebook(user);
  assert.deepEqual(data.summary, {
    answered: 1,
    correct: 0,
    incorrect: 1,
    demonstration: 1,
  });
  assert.equal(data.items[0].id, q.id);
  assert.equal(data.items[0].questionId, q.question);
  assert.equal(data.items[0].versionNumber, 1);
  assert.equal(data.items[0].correctOptionId, undefined);
  assert.equal(JSON.stringify(data).includes("Comentário privado"), false);
  assert.equal((await notebook(other, `?ownerId=${user.id}`)).total, 0);
  // Retry is idempotent and never counts as a new attempt/question.
  await save(user, q.id);
  assert.equal((await notebook(user)).summary.answered, 1);
  assert.equal(
    (
      await request(`questions/${q.id}/answer`, user.cookie, "PUT", {
        optionId: "a",
        baseRevision: 0,
      })
    ).status,
    409,
  );
  assert.equal((await notebook(user)).total, 1);
  await save(user, q.id, "a", 1);
  data = await notebook(user);
  assert.deepEqual(data.summary, {
    answered: 1,
    correct: 1,
    incorrect: 0,
    demonstration: 1,
  });
  assert.equal(data.total, 0);
  assert.deepEqual(data.topics, [
    { topic: "Revisão sintética", answered: 1, incorrect: 0 },
  ]);
});

test("the latest saved answer across published versions determines one logical review item", async () => {
  const user = await actor(),
    v1 = await fixture("Assunto antigo");
  await save(user, v1.id);
  const v2 = await fixture("Assunto atual", v1.question, 2);
  let data = await notebook(user);
  assert.equal(data.total, 1);
  assert.equal(data.items[0].id, v1.id);
  assert.equal(data.items[0].currentVersionId, v2.id);
  await save(user, v2.id, "a");
  // Explicit timestamps make historical-answer selection deterministic.
  await db.query(
    "UPDATE answer SET updated_at='2026-01-01' WHERE owner_id=$1 AND question_id=$2",
    [user.id, v1.id],
  );
  await db.query(
    "UPDATE answer SET updated_at='2026-02-01' WHERE owner_id=$1 AND question_id=$2",
    [user.id, v2.id],
  );
  data = await notebook(user);
  assert.equal(data.summary.answered, 1);
  assert.equal(data.summary.correct, 1);
  assert.equal(data.total, 0);
  assert.deepEqual(data.topics, [
    { topic: "Assunto atual", answered: 1, incorrect: 0 },
  ]);
  // A later deliberate review of v1 is still judged against v1's key/topic.
  await db.query(
    "UPDATE answer SET updated_at='2026-03-01' WHERE owner_id=$1 AND question_id=$2",
    [user.id, v1.id],
  );
  data = await notebook(user);
  assert.equal(data.summary.answered, 1);
  assert.equal(data.items[0].id, v1.id);
  assert.equal(data.items[0].topic, "Assunto antigo");
  // Equal save times prefer the newest version, then stable version ID.
  await db.query(
    "UPDATE answer SET updated_at='2026-04-01' WHERE owner_id=$1",
    [user.id],
  );
  assert.equal((await notebook(user)).summary.correct, 1);
});

test("topic filtering and pagination use the complete notebook rather than the public catalog limit", async () => {
  const user = await actor(),
    topic = "SQL %_Á";
  const ids = [];
  for (let i = 0; i < 22; i++) {
    const q = await fixture(topic);
    ids.push(q.id);
    await save(user, q.id);
  }
  const another = await fixture("Outro assunto");
  await save(user, another.id);
  const query = "?topic=" + encodeURIComponent(topic);
  const first = await notebook(user, query),
    second = await notebook(user, query + "&offset=20");
  assert.equal(first.summary.answered, 23);
  assert.equal(first.total, 22);
  assert.equal(first.items.length, 20);
  assert.equal(second.items.length, 2);
  assert.deepEqual(
    new Set([...first.items, ...second.items].map((row) => row.id)),
    new Set(ids),
  );
  assert.equal((await notebook(user, "?topic=SQL")).total, 0);
  assert.equal((await notebook(user, "?offset=1000000")).items.length, 0);
});

test(
  "a save delayed by a credential lock is ordered by its actual write time across account sessions",
  { timeout: 15000 },
  async () => {
    const guest = await actor();
    const email = `review-clock-${randomUUID()}@example.invalid`,
      password = `test-only-${randomUUID()}`;
    const registered = await request("auth/register", guest.cookie, "POST", {
      email,
      password,
    });
    assert.equal(registered.status, 201);
    const first = await actor(registered),
      anotherGuest = await actor();
    const loggedIn = await request("auth/login", anotherGuest.cookie, "POST", {
      email,
      password,
    });
    assert.equal(loggedIn.status, 200);
    const second = await actor(loggedIn),
      v1 = await fixture(),
      v2 = await fixture("Atual", v1.question, 2);
    const locker = await db.connect();
    let delayed: Promise<unknown> | undefined;
    try {
      await locker.query("BEGIN");
      const pid = (await locker.query("SELECT pg_backend_pid() AS pid")).rows[0]
        .pid;
      const hash = createHash("sha256")
        .update(first.cookie.slice(14))
        .digest("hex");
      await locker.query(
        "SELECT token_hash FROM browser_session WHERE token_hash=$1 FOR UPDATE",
        [hash],
      );
      delayed = save(first, v1.id);
      let blocked = false;
      const deadline = Date.now() + 5000;
      while (!blocked && Date.now() < deadline) {
        blocked = (
          await db.query(
            "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS blocked",
            [pid],
          )
        ).rows[0].blocked;
        if (!blocked) await pollDelay(10);
      }
      assert.equal(
        blocked,
        true,
        "the first transaction must start before the second write",
      );
      await save(second, v2.id, "a");
      await locker.query("COMMIT");
      await delayed;
      const data = await notebook(first);
      assert.equal(data.summary.answered, 1);
      assert.equal(data.total, 1);
      assert.equal(data.items[0].id, v1.id);
    } finally {
      await locker.query("ROLLBACK");
      locker.release();
      await delayed;
    }
  },
);

test("unpublished versions and invalid review filters cannot enter or expose the notebook", async () => {
  const user = await actor(),
    q = await fixture("Oculto", undefined, 1, false);
  // A direct database fixture tests the read boundary independently of the save API.
  await db.query(
    "INSERT INTO answer(owner_id,question_id,option_id,revision) VALUES($1,$2,'b',1)",
    [user.id, q.id],
  );
  const data = await notebook(user);
  assert.equal(data.summary.answered, 0);
  assert.equal(data.total, 0);
  for (const query of [
    "?offset=-1",
    "?offset=1.5",
    "?offset=1000001",
    "?offset=0&offset=20",
    "?topic=a&topic=b",
    "?topic=" + "x".repeat(81),
  ])
    assert.equal((await request("review" + query, user.cookie)).status, 400);
});

test("guest signup preserves review history and logout/login enforce the account boundary", async () => {
  let user = await actor();
  const q = await fixture();
  await save(user, q.id);
  const email = `review-${randomUUID()}@example.invalid`,
    password = `test-only-${randomUUID()}`;
  const registered = await request("auth/register", user.cookie, "POST", {
    email,
    password,
  });
  assert.equal(registered.status, 201);
  user = await actor(registered);
  assert.equal((await notebook(user)).total, 1);
  const signedOut = await actor(
    await request("auth/logout", user.cookie, "POST", {}),
  );
  assert.equal((await notebook(signedOut)).total, 0);
  assert.equal((await request("review", user.cookie)).status, 401);
  const loggedIn = await request("auth/login", signedOut.cookie, "POST", {
    email,
    password,
  });
  assert.equal(loggedIn.status, 200);
  assert.equal((await notebook(await actor(loggedIn))).items[0].id, q.id);
});
