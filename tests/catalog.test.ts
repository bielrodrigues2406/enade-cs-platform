import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createApp, db } from "../apps/api/src/main.js";
import { AREAS } from "../apps/api/src/question-areas.js";

// Only TEST ONLY synthetic content is inserted; no real review or publication.
let app: Awaited<ReturnType<typeof createApp>>, base: string;
const owners = new Set<string>(), questions = new Set<string>(), sources = new Set<string>();
const batch = `TEST ONLY catalog ${randomUUID()}`;
type Actor = { id: string; cookie: string };
before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});
after(async () => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM answer WHERE owner_id=ANY($1::uuid[])", [[...owners]]);
    await client.query("DELETE FROM editorial_question WHERE id=ANY($1::text[])", [[...questions]]);
    await client.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])", [[...sources]]);
    await client.query("DELETE FROM browser_session WHERE identity_id=ANY($1::uuid[])", [[...owners]]);
    await client.query("DELETE FROM study_identity WHERE id=ANY($1::uuid[])", [[...owners]]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await app?.close();
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
async function actor(): Promise<Actor> {
  const response = await request("session", "", "POST", {});
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const hash = createHash("sha256").update(cookie.slice("enade_session=".length)).digest("hex");
  const id = (await db.query("SELECT identity_id FROM browser_session WHERE token_hash=$1", [hash])).rows[0].identity_id;
  owners.add(id);
  return { id, cookie };
}
async function catalog(user: Actor, params: Record<string, string> = {}) {
  const response = await request("catalog?" + new URLSearchParams(params), user.cookie);
  assert.equal(response.status, 200);
  return response.json();
}
async function fixture(topic: string, n: number, options: { parent?: string; sequence?: number; published?: boolean; exam?: string; key?: string; prompt?: string } = {}) {
  const parent = options.parent ?? `catalog-fixture-${randomUUID()}`;
  const id = `${parent}-v${options.sequence ?? 1}`;
  questions.add(parent);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (!options.parent) {
      await client.query(
        "INSERT INTO editorial_question(id,origin,official_exam_id,official_question_number) VALUES($1,$2,$3,$4)",
        [parent, options.exam ? "OFFICIAL" : "AUTHOR_CREATED", options.exam ?? null, options.exam ? n : null],
      );
    }
    await client.query(
      `INSERT INTO question_version(id,question_id,version_number,title,topic,prompt,origin,
        editorial_status,explanation,correct_option_id,demonstration,author_credit,
        exam_source_id,key_source_id,source_page,source_question_number,key_page,explanation_credit,
        review_origin,assisted_extractor,assisted_reviewer,reviewed_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,'DRAFT','TEST ONLY private explanation','a',$8,$9,
        $10,$11,$12,$13,$12,$14,$15,$16,$17,$18)`,
      [id, parent, options.sequence ?? 1, `${batch} ${String(n).padStart(3,"0")}`,
        topic, options.prompt ?? "TEST ONLY synthetic prompt", options.exam ? "OFFICIAL" : "AUTHOR_CREATED",
        !options.exam, options.exam ? "Inep" : "TEST ONLY fixture",
        options.exam ?? null, options.key ?? null, options.exam ? 1 : null, options.exam ? n : null,
        options.exam ? "TEST ONLY synthetic comment" : null,
        options.exam ? "ASSISTED" : "HUMAN", options.exam ? "test-only-extractor" : null,
        options.exam ? "test-only-reviewer" : null, options.exam ? new Date() : null],
    );
    await client.query("INSERT INTO question_option(question_id,id,text,position) VALUES($1,'a','TEST ONLY alternative',0)", [id]);
    if (options.published !== false) {
      await client.query("UPDATE question_version SET editorial_status='PUBLISHED' WHERE id=$1", [id]);
      await client.query("UPDATE editorial_question SET current_version_id=$2 WHERE id=$1", [parent, id]);
    }
    await client.query("COMMIT");
    return { id, parent };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
async function source(kind: "EXAM" | "ANSWER_KEY", year: number) {
  const id = randomUUID(); sources.add(id);
  await db.query(
    `INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,
      status,is_final,verification_origin,assisted_verifier,reviewed_at)
    VALUES($1,'TEST ONLY synthetic source',$2,$3,$4,'TEST ONLY course','BACHARELADO',$5,5,1,
      'VERIFIED',$6,'ASSISTED','test-only-reviewer',now())`,
    [id, `https://download.inep.gov.br/enade/test-only-${id}.pdf`, kind, year, createHash("sha256").update(id).digest("hex"), kind === "ANSWER_KEY"],
  );
  return id;
}

test("catalog requires a live session and rejects ambiguous filters and pagination", async () => {
  assert.equal((await request("catalog")).status, 401);
  const user = await actor();
  for (const query of [
    "q=a&q=b", "topic=a&topic=b", "area=Algoritmos&area=Redes", "area[]=Redes",
    "q[x]=y", "year=2021&year=2024", "year=1999", "year=2101", "year=2e3", "year=2021.0",
    "year=202", "area=uncatalogued", "limit=0", "limit=51", "limit=01", "limit=1.0",
    "limit=", "offset=-1", "offset=1000001", "offset=1e2", "offset=01", "offset=",
    "limit=10&limit=20", "offset=0&offset=20", "unexpected=value",
    "q=" + "a".repeat(121), "topic=" + "a".repeat(81),
  ]) assert.equal((await request("catalog?" + query, user.cookie)).status, 400, query);
  const data = await catalog(user);
  assert.equal(data.limit, 20); assert.equal(data.offset, 0);
  assert.deepEqual(data.facets.areas.map((area: any) => area.name), [...AREAS]);
  await db.query("UPDATE browser_session SET expires_at=now()-interval '1 second' WHERE identity_id=$1", [user.id]);
  assert.equal((await request("catalog", user.cookie)).status, 401);
});

test("catalog reaches past 50 current versions with global facets, real counts and stable pages", async () => {
  const user = await actor();
  const custom = `TEST ONLY detail ${randomUUID()}`;
  const expected: string[] = [];
  for (let n = 0; n < 57; n++) expected.push((await fixture(n === 56 ? custom : "Algoritmos", n)).id);
  expected.sort();
  const params = { q: batch, limit: "20" };
  const pages = [];
  for (const offset of [0, 20, 40]) {
    const data = await catalog(user, { ...params, offset: String(offset) });
    assert.equal(data.total, 57); assert.equal(data.answeredTotal, 0); assert.equal(data.offset, offset);
    assert.equal(data.items.length, offset === 40 ? 17 : 20);
    assert.ok(data.facets.topics.includes(custom), "facet from beyond the first page remains available");
    assert.ok(data.facets.areas.find((a: any) => a.name === "Algoritmos").count >= 56);
    assert.ok(data.facets.unclassified >= 1);
    assert.equal(JSON.stringify(data).includes("private explanation"), false);
    assert.equal(data.items.some((i: any) => "prompt" in i || "correctOptionId" in i || "explanation" in i), false);
    pages.push(...data.items.map((i: any) => i.id));
  }
  assert.deepEqual(pages, expected);
  assert.equal(new Set(pages).size, 57);
  const last = await catalog(user, { ...params, offset: "1000000" });
  assert.equal(last.offset, 40); assert.equal(last.items.length, 17);
  const empty = await catalog(user, { q: randomUUID(), offset: "1000000" });
  assert.equal(empty.total, 0); assert.equal(empty.offset, 0); assert.deepEqual(empty.items, []);
  assert.ok(empty.facets.topics.includes(custom));
  const classified = await catalog(user, { q: batch, area: "Algoritmos", limit: "50" });
  assert.equal(classified.total, 56); assert.ok(classified.items.every((q: any) => q.area === "Algoritmos"));
  const detail = await catalog(user, { topic: custom });
  assert.equal(detail.total, 1); assert.equal(detail.items[0].area, null);
  assert.equal(detail.items[0].year, null); assert.equal(detail.items[0].questionNumber, null);
  const unclassified = await catalog(user, { q: batch, area: "unclassified" });
  assert.equal(unclassified.total, 1); assert.equal(unclassified.items[0].topic, custom);
});

test("catalog search is literal and case insensitive and private or historical facets stay private", async () => {
  const user = await actor();
  const marker = `TEST ONLY literal ${randomUUID()}`;
  const literal = await fixture("Redes", 80, { prompt: `${marker} 100%_literal ' quotation` });
  assert.equal((await catalog(user, { q: "100%_LITERAL '" })).items.some((i: any) => i.id === literal.id), true);
  assert.equal((await catalog(user, { q: marker.replace("literal", "LITERAL") })).total, 1);
  assert.equal((await catalog(user, { q: "%not-a-wildcard" })).total, 0);
  const draftTopic = `TEST ONLY private ${randomUUID()}`, oldTopic = `TEST ONLY historical ${randomUUID()}`;
  const draft = await fixture(draftTopic, 81, { published: false });
  const old = await fixture(oldTopic, 82);
  const current = await fixture("Programação", 82, { parent: old.parent, sequence: 2 });
  const data = await catalog(user, { q: batch, limit: "50" });
  assert.equal(data.items.some((i: any) => i.id === draft.id || i.id === old.id), false);
  assert.equal(data.facets.topics.includes(draftTopic), false); assert.equal(data.facets.topics.includes(oldTopic), false);
  const selected = await catalog(user, { q: batch, area: "Programação" });
  assert.equal(selected.items.some((i: any) => i.id === current.id), true);
});

test("catalog answer totals cover the selection beyond a page and isolate identities", async () => {
  const user = await actor(), other = await actor();
  const topic = `TEST ONLY answers ${randomUUID()}`;
  const ids = [];
  for (let n = 90; n < 94; n++) ids.push((await fixture(topic, n)).id);
  for (const id of ids.slice(0,3)) {
    const response = await request(`questions/${id}/answer`, user.cookie, "PUT", { optionId: "a", baseRevision: 0 });
    assert.equal(response.status, 200);
  }
  const page = await catalog(user, { topic, limit: "1" });
  assert.equal(page.items.length, 1); assert.equal(page.total, 4); assert.equal(page.answeredTotal, 3);
  const isolated = await catalog(other, { topic, limit: "1" });
  assert.equal(isolated.answeredTotal, 0); assert.equal(isolated.items[0].answered, false);
});

test("catalog year and provenance come only from current public exam versions", async () => {
  const user = await actor();
  const exam = await source("EXAM", 2098), key = await source("ANSWER_KEY", 2098);
  const oldExam = await source("EXAM", 2097), oldKey = await source("ANSWER_KEY", 2097);
  const one = await fixture("Formação Geral", 97, { exam, key });
  await fixture("Segurança", 98, { exam: oldExam, key: oldKey, published: false });
  const data = await catalog(user, { year: "2098", area: "Formação Geral", q: batch });
  assert.equal(data.total, 1); assert.equal(data.items[0].id, one.id);
  assert.equal(data.items[0].year, 2098); assert.equal(data.items[0].modality, "BACHARELADO");
  assert.equal(data.items[0].questionNumber, 97);
  assert.ok(data.facets.years.includes(2098)); assert.equal(data.facets.years.includes(2097), false);
  assert.deepEqual((await catalog(user, { year: "2097", q: batch })).items, []);
});
