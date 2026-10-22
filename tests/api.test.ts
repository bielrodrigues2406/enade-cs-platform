import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp, db } from "../apps/api/src/main.js";
let app: Awaited<ReturnType<typeof createApp>>, base: string;
const cookies: string[] = [];
before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});
after(async () => {
  // Only visitors created by this test run are removed; seeded content is untouched.
  const { createHash } = await import("node:crypto");
  for (const cookie of cookies) {
    const tokenHash = createHash("sha256")
      .update(cookie.slice(14))
      .digest("hex");
    const visitor = (
      await db.query("SELECT id FROM visitor WHERE token_hash=$1", [tokenHash])
    ).rows[0];
    if (visitor) {
      await db.query("DELETE FROM answer WHERE visitor_id=$1", [visitor.id]);
      await db.query("DELETE FROM visitor WHERE id=$1", [visitor.id]);
    }
  }
  await app.close();
  await db.end();
});
async function session() {
  const r = await fetch(base + "/api/session", { method: "POST" });
  assert.equal(r.status, 201);
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  cookies.push(cookie);
  return cookie;
}
function request(path: string, cookie = "", method = "GET", body?: unknown) {
  return fetch(base + "/api/" + path, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test("database health and session required", async () => {
  assert.deepEqual(await (await request("health")).json(), {
    status: "ok",
    database: "ok",
  });
  assert.equal((await request("questions")).status, 401);
});
test("catalog, answer, retry, resume and visitor isolation", async () => {
  const a = await session(),
    b = await session();
  const list = await (await request("questions", a)).json();
  assert.ok(list.length >= 3);
  const first = await (await request("questions/demo-sql-v1", a)).json();
  assert.equal(first.answer, null);
  assert.equal(first.correctOptionId, undefined);
  assert.equal(first.explanation, undefined);
  const saved = await request("questions/demo-sql-v1/answer", a, "PUT", {
    optionId: "demo-sql-v1-1",
    baseRevision: 0,
  });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).correct, true);
  const retry = await request("questions/demo-sql-v1/answer", a, "PUT", {
    optionId: "demo-sql-v1-1",
    baseRevision: 0,
  });
  assert.equal((await retry.json()).revision, 1);
  assert.equal(
    (await (await request("questions/demo-sql-v1", a)).json()).answer.optionId,
    "demo-sql-v1-1",
  );
  assert.equal(
    (await (await request("questions/demo-sql-v1", b)).json()).answer,
    null,
  );
  assert.equal(
    (
      await request("questions/demo-sql-v1/answer", a, "PUT", {
        optionId: "demo-network-v1-1",
        baseRevision: 1,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("questions/demo-sql-v1/answer", a, "PUT", {
        optionId: "demo-sql-v1-0",
        baseRevision: 0,
      })
    ).status,
    409,
  );
  assert.equal((await request("questions?q=not-a-question", a)).status, 200);
  assert.deepEqual(
    await (await request("questions?q=not-a-question", a)).json(),
    [],
  );
});
test("concurrent writes cannot overwrite the same revision", async () => {
  const cookie = await session();
  await request("questions/demo-search-v1/answer", cookie, "PUT", {
    optionId: "demo-search-v1-0",
    baseRevision: 0,
  });
  const results = await Promise.all(
    [1, 2].map((i) =>
      request("questions/demo-search-v1/answer", cookie, "PUT", {
        optionId: `demo-search-v1-${i}`,
        baseRevision: 1,
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await (await request("questions/demo-search-v1", cookie)).json()).answer
      .revision,
    2,
  );
});
test("unpublished content is inaccessible, even when its ID is known", async () => {
  const cookie = await session();
  const id = "test-draft-" + crypto.randomUUID();
  const client = await db.connect();
  await client.query("BEGIN");
  await client.query(
    "INSERT INTO question_version(id,title,topic,prompt,origin,editorial_status,explanation,correct_option_id) VALUES($1,'Pending','test','<script>untrusted</script>','AUTHOR_CREATED','DRAFT','private','a')",
    [id],
  );
  await client.query(
    "INSERT INTO question_option(question_id,id,text,position) VALUES($1,'a','private',0)",
    [id],
  );
  await client.query("COMMIT");
  client.release();
  try {
    assert.equal((await request("questions/" + id, cookie)).status, 404);
    assert.equal(
      (
        await request("questions/" + id + "/answer", cookie, "PUT", {
          optionId: "a",
          baseRevision: 0,
        })
      ).status,
      404,
    );
    const catalog = await (await request("questions", cookie)).json();
    assert.equal(
      catalog.some((q: any) => q.id === id),
      false,
    );
  } finally {
    const cleanup = await db.connect();
    try {
      await cleanup.query("BEGIN");
      await cleanup.query("DELETE FROM question_option WHERE question_id=$1", [
        id,
      ]);
      await cleanup.query("DELETE FROM question_version WHERE id=$1", [id]);
      await cleanup.query("COMMIT");
    } finally {
      cleanup.release();
    }
  }
});
test("foreign browser origins are rejected", async () => {
  const response = await fetch(base + "/api/session", {
    method: "POST",
    headers: { Origin: "https://foreign.example" },
  });
  assert.equal(response.status, 403);
});
