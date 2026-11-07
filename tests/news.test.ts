import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createApp, db } from "../apps/api/src/main.js";
import { loadNews, parseNews } from "../apps/api/src/news.js";

// Novidades (NEWS-1): conteúdo versionado, o que cada identidade já viu e o
// aviso automático só para quem já estudou. Só visitantes TEST ONLY criados aqui.

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
    await db.query("DELETE FROM answer WHERE owner_id=ANY($1::uuid[])", [identities]);
    await db.query("DELETE FROM browser_session WHERE identity_id=ANY($1::uuid[])", [identities]);
    await db.query("DELETE FROM study_identity WHERE id=ANY($1::uuid[])", [identities]);
  } finally {
    await app.close();
    await db.end();
  }
});

async function guest() {
  const response = await fetch(`${base}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const id = (await db.query("SELECT identity_id FROM browser_session WHERE token_hash=$1",
    [createHash("sha256").update(cookie.split("=")[1]).digest("hex")])).rows[0]?.identity_id;
  identities.push(id);
  return { cookie, id };
}
const call = (path: string, cookie: string, body?: unknown) => fetch(`${base}/api/${path}`, {
  method: body === undefined ? "GET" : "POST", headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test("the news file is valid, newest first, and bad entries are rejected", async () => {
  const news = await loadNews();
  assert.ok(news.length >= 3);
  assert.deepEqual(news.map((n) => n.date), [...news.map((n) => n.date)].sort().reverse());
  const item = { id: "teste-um", date: "2026-11-07", title: "T", summary: "S", action: { label: "Abrir", destination: "biblioteca" } };
  assert.equal(parseNews({ news: [item] }).length, 1);
  assert.throws(() => parseNews({ news: [item, item] }), /repetido/);
  assert.throws(() => parseNews({ news: [{ ...item, date: "07/11/2026" }] }), /data/);
  assert.throws(() => parseNews({ news: [{ ...item, action: { label: "x", destination: "em-lugar-nenhum" } }] }), /destino/);
});

test("a visitor sees unseen news, marks them as seen once, and the popup waits for some study", async () => {
  const { cookie, id } = await guest();
  const first = await (await call("news", cookie)).json();
  assert.ok(first.unseen >= 3 && first.items.every((n: any) => n.seen === false));
  assert.equal(first.autoOpen, false, "quem nunca respondeu não recebe o aviso automático");

  const option = (await db.query("SELECT question_id, id FROM question_option LIMIT 1")).rows[0];
  await db.query("INSERT INTO answer(owner_id,question_id,option_id,revision) VALUES($1,$2,$3,1)", [id, option.question_id, option.id]);
  assert.equal((await (await call("news", cookie)).json()).autoOpen, true);

  const target = first.items[0].id;
  const marked = await (await call("news/seen", cookie, { ids: [target, target] })).json();
  assert.equal(marked.unseen, first.unseen - 1);
  assert.equal(marked.items.find((n: any) => n.id === target).seen, true);
  assert.equal((await (await call("news/seen", cookie, { ids: [target] })).json()).unseen, first.unseen - 1, "repetir não muda nada");

  assert.equal((await call("news/seen", cookie, { ids: ["nao-existe"] })).status, 400);
  assert.equal((await call("news/seen", cookie, { ids: [] })).status, 400);
  const all = await (await call("news/seen", cookie, { ids: first.items.map((n: any) => n.id) })).json();
  assert.deepEqual([all.unseen, all.autoOpen], [0, false]);
});
