import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { storeAsset } from "../apps/api/src/question-images.js";
import { createApp, db } from "../apps/api/src/main.js";
import { issueSession } from "../apps/api/src/session.js";
import { AREAS } from "../apps/api/src/question-areas.js";

// Synthetic TEST ONLY fixtures, removed with their own owners. No real question,
// source or human editorial approval is changed by this suite.
const area = "Compiladores", noContentArea = "Computação gráfica";
const prefix = `practice-test-${randomUUID()}`;
const owners = new Set<string>(), parents = new Set<string>(), sources = new Set<string>();
const initial: { parent: string; id: string }[] = [];
let app: Awaited<ReturnType<typeof createApp>>, base: string, assetDir: string;
type Actor = { id: string; cookie: string };
before(async () => {
  assetDir = await mkdtemp(path.join(tmpdir(), "practice-api-assets-"));
  process.env.QUESTION_ASSET_DIR = assetDir;
  app = await createApp(); await app.listen(0, "127.0.0.1"); base = await app.getUrl();
  for (let n = 0; n < 30; n++) initial.push(await fixture(n));
  await fixture(100, { published: false, topic: noContentArea });
  await fixture(101, { count: 1, topic: noContentArea });
});
after(async () => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM answer WHERE owner_id=ANY($1::uuid[])", [[...owners]]);
    await client.query("DELETE FROM practice_attempt WHERE owner_id=ANY($1::uuid[])", [[...owners]]);
    await client.query("DELETE FROM discursive_question WHERE exam_source_id=ANY($1::uuid[])", [[...sources]]);
    await client.query("DELETE FROM account WHERE identity_id=ANY($1::uuid[])", [[...owners]]);
    await client.query("DELETE FROM editorial_question WHERE id=ANY($1::text[])", [[...parents]]);
    await client.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])", [[...sources]]);
    await client.query("DELETE FROM browser_session WHERE identity_id=ANY($1::uuid[])", [[...owners]]);
    await client.query("DELETE FROM study_identity WHERE id=ANY($1::uuid[])", [[...owners]]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await app?.close(); await db.end(); if (assetDir) await rm(assetDir, {recursive:true,force:true}); }
});
function request(path: string, actor?: Actor, method = "GET", body?: unknown) {
  return fetch(`${base}/api/${path}`, {
    method, headers: { Cookie: actor?.cookie ?? "", "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000),
  });
}
async function json(path: string, user: Actor, method = "GET", body?: unknown, status = 200) {
  const response = await request(path, user, method, body);
  assert.equal(response.status, status, `${method} ${path}: ${response.status}`);
  return response.json();
}
async function actor(): Promise<Actor> {
  const response = await request("session", undefined, "POST", {});
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const tokenHash = createHash("sha256").update(cookie.slice(14)).digest("hex");
  const id = (await db.query("SELECT identity_id FROM browser_session WHERE token_hash=$1", [tokenHash])).rows[0].identity_id;
  owners.add(id); return { id, cookie };
}
async function anotherCredential(user: Actor): Promise<Actor> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const token = await issueSession(client, user.id);
    await client.query("COMMIT");
    return { id: user.id, cookie: `enade_session=${token}` };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
async function fixture(n: number, opts: { parent?: string; version?: number; published?: boolean; topic?: string; count?: number; exam?: string; key?: string; image?: boolean; number?: number } = {}) {
  const number = opts.number ?? n;
  const parent = opts.parent ?? `${prefix}-${n}`;
  const id = `${parent}-v${opts.version ?? 1}`;
  parents.add(parent);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (!opts.parent) await client.query(
      "INSERT INTO editorial_question(id,origin,official_exam_id,official_question_number) VALUES($1,$2,$3,$4)",
      [parent, opts.exam ? "OFFICIAL" : "AUTHOR_CREATED", opts.exam ?? null, opts.exam ? number : null],
    );
    const a = `${id}-A`, correct = opts.version === 2 ? `${id}-B` : a;
    await client.query(
      `INSERT INTO question_version(id,question_id,version_number,title,topic,prompt,origin,
        editorial_status,explanation,correct_option_id,demonstration,author_credit,
        exam_source_id,key_source_id,source_page,source_question_number,key_page,explanation_credit,
        review_origin,assisted_extractor,assisted_reviewer,reviewed_at)
      VALUES($1,$2,$3,$4,$5,'TEST ONLY synthetic prompt',$6,'DRAFT','TEST ONLY private explanation',$7,$8,$9,
        $10,$11,$12,$13,$12,$14,$15,$16,$17,$18)`,
      [id, parent, opts.version ?? 1, `TEST ONLY practice ${n}`, opts.topic ?? area,
        opts.exam ? "OFFICIAL" : "AUTHOR_CREATED", correct, !opts.exam,
        opts.exam ? "Inep" : "TEST ONLY demonstration", opts.exam ?? null, opts.key ?? null,
        opts.exam ? 1 : null, opts.exam ? number : null, opts.exam ? "TEST ONLY synthetic editorial comment" : null,
        opts.exam ? "ASSISTED" : "HUMAN", opts.exam ? "test-only-extractor" : null,
        opts.exam ? "test-only-reviewer" : null, opts.exam ? new Date() : null],
    );
    const order = opts.version === 2 ? ["B", "A", "C"] : ["A", "B", "C"];
    for (const [position, letter] of order.slice(0, opts.count ?? 3).entries()) await client.query(
      "INSERT INTO question_option(question_id,id,text,position) VALUES($1,$2,$3,$4)",
      [id, `${id}-${letter}`, `TEST ONLY ${letter}`, position],
    );
    if (opts.image) {
      const bytes = await readFile("tests/fixtures/test-only-question.webp");
      const asset = await storeAsset(client, bytes);
      await client.query("INSERT INTO question_version_image(version_id,position,asset_sha256,source_page,box,dpi) VALUES($1,1,$2,1,ARRAY[0,0,100,100]::numeric[],200)", [id, asset.sha256]);
      await client.query("UPDATE question_version SET presentation='IMAGE' WHERE id=$1", [id]);
    }
    if (opts.published !== false) {
      await client.query("UPDATE question_version SET editorial_status='PUBLISHED' WHERE id=$1", [id]);
      await client.query("UPDATE editorial_question SET current_version_id=$2 WHERE id=$1", [parent, id]);
    }
    await client.query("COMMIT"); return { id, parent };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
function start(user: Actor, size = 10, selectedArea: string | null = area, requestId = randomUUID()) {
  return json("practice", user, "POST", { size, area: selectedArea, requestId }, 201);
}
function save(user: Actor, id: string, position: number, optionId: string | null, baseRevision = 0, marked = false) {
  return json(`practice/${id}/items/${position}`, user, "PUT", { optionId, marked, baseRevision });
}
function secretFree(dto: any) {
  assert.equal(dto.summary, null);
  for (const item of dto.items) {
    assert.equal("result" in item, false);
    for (const key of ["correct", "correctOptionId", "explanation", "answerKey", "answer"])
      assert.equal(key in item.question, false, key);
  }
  assert.equal(dto.answered, dto.items.filter((i: any) => i.answer.optionId !== null).length);
}

test("practice validates all boundaries and excludes pending or incomplete content", async () => {
  assert.equal((await request("practice")).status, 401);
  const user = await actor();
  const available = await json("practice", user);
  assert.deepEqual(available.sizes, [10,20,30]); assert.equal(available.defaultSize, 20);
  assert.deepEqual(available.areas.map((a: any) => a.name), [...AREAS]);
  assert.equal(available.areas.find((a: any) => a.name === noContentArea).count, 0);
  assert.equal(available.active, null); assert.deepEqual(available.recent, []);
  for (const body of [null, [], {}, {requestId:randomUUID(),size:5,area},
    {requestId:randomUUID(),size:"10",area}, {requestId:randomUUID(),size:10,area:"unknown"},
    {requestId:"invalid",size:10,area}, {requestId:randomUUID(),size:10},
    {requestId:randomUUID(),size:10,area,ownerId:user.id}])
    assert.equal((await request("practice", user, "POST", body)).status, 400);
  for (const query of ["ownerId=x", "area=Compiladores", "area[]=Compiladores"])
    assert.equal((await request("practice?"+query, user)).status, 400);
  const insufficient = await request("practice", user, "POST", {requestId:randomUUID(),size:10,area:noContentArea});
  assert.equal(insufficient.status, 409);
  assert.equal((await db.query("SELECT count(*)::integer AS n FROM practice_attempt WHERE owner_id=$1", [user.id])).rows[0].n, 0);
});

test("practice creates exact 10/20/30 distinct current versions and idempotent retries", async () => {
  for (const size of [10,20,30]) {
    const user = await actor(), key = randomUUID();
    const attempt = await start(user, size, area, key);
    assert.equal(attempt.size, size); assert.equal(attempt.items.length, size); assert.equal(attempt.state, "IN_PROGRESS");
    assert.deepEqual(attempt.items.map((i: any) => i.position), Array.from({length:size},(_,i)=>i+1));
    assert.equal(new Set(attempt.items.map((i: any) => i.question.id)).size, size);
    assert.ok(attempt.items.every((i: any) => initial.some((q) => q.id === i.question.id)));
    secretFree(attempt);
    assert.deepEqual(await start(user, size, area, key), attempt);
    assert.equal((await request("practice", user, "POST", {requestId:key,size:size===10?20:10,area})).status, 409);
    assert.equal((await request("practice", user, "POST", {requestId:randomUUID(),size,area})).status, 409);
    assert.equal((await json("practice", user)).active.id, attempt.id);
  }
});

test("practice ownership, expired credentials and field injection never reveal a result", async () => {
  const user = await actor(), stranger = await actor(), attempt = await start(user);
  for (const [path, method, body] of [
    [`practice/${attempt.id}`, "GET", undefined],
    [`practice/${attempt.id}/items/1`, "PUT", {optionId:null,marked:true,baseRevision:0}],
    [`practice/${attempt.id}/finish`, "POST", {}],
  ] as const) assert.equal((await request(path, stranger, method, body)).status, 404);
  assert.equal((await request("practice/not-a-uuid", user)).status, 404);
  assert.equal((await request(`practice/${randomUUID()}`, user)).status, 404);
  assert.equal((await request(`practice/${attempt.id}?ownerId=${stranger.id}`, user)).status, 400);
  for (const body of [[], null, {optionId:null,marked:true,baseRevision:0,ownerId:stranger.id},
    {optionId:null,marked:"true",baseRevision:0}, {optionId:"",marked:false,baseRevision:0},
    {optionId:null,marked:false,baseRevision:-1}, {optionId:null,marked:false,baseRevision:0.1}])
    assert.equal((await request(`practice/${attempt.id}/items/1`, user, "PUT", body)).status, 400);
  assert.equal((await request(`practice/${attempt.id}/items/01`, user, "PUT", {optionId:null,marked:false,baseRevision:0})).status, 400);
  assert.equal((await request(`practice/${attempt.id}/items/11`, user, "PUT", {optionId:null,marked:false,baseRevision:0})).status, 404);
  assert.equal((await request(`practice/${attempt.id}/finish`, user, "POST", {correct:10})).status, 400);
  await db.query("UPDATE browser_session SET expires_at=clock_timestamp()-interval '1 second' WHERE identity_id=$1", [user.id]);
  assert.equal((await request(`practice/${attempt.id}`, user)).status, 401);
  assert.equal((await request(`practice/${attempt.id}/finish`, user, "POST", {})).status, 401);
  assert.equal((await request(`practice/${attempt.id}/items/1`, user, "PUT", {optionId:null,marked:false,baseRevision:0})).status, 401);
});

test("practice saves by alternative identity, rejects foreign options and keeps free study separate", async () => {
  const user = await actor(), attempt = await start(user), item = attempt.items[0], other = attempt.items[1];
  const correct = `${item.question.id}-A`;
  await json(`questions/${item.question.id}/answer`, user, "PUT", {optionId:correct,baseRevision:0});
  secretFree(await json(`practice/${attempt.id}`, user));
  assert.equal((await request(`practice/${attempt.id}/items/1`, user, "PUT", {optionId:other.question.options[0].id,marked:false,baseRevision:0})).status, 400);
  const saved = await save(user, attempt.id, 1, correct, 0, true);
  assert.deepEqual(saved, {position:1,optionId:correct,marked:true,revision:1});
  assert.deepEqual(await save(user, attempt.id, 1, correct, 0, true), saved);
  assert.equal((await request(`practice/${attempt.id}/items/1`, user, "PUT", {optionId:other.question.options[0].id,marked:true,baseRevision:1})).status, 400);
  assert.equal((await request(`practice/${attempt.id}/items/1`, user, "PUT", {optionId:null,marked:false,baseRevision:0})).status, 409);
  const cleared = await save(user, attempt.id, 1, null, 1);
  assert.equal(cleared.revision, 2); assert.equal(cleared.optionId, null);
  const view = await json(`practice/${attempt.id}`, user); secretFree(view);
  assert.equal(view.answered, 0); assert.equal(view.items[0].answer.revision, 2);
  const study = await json(`questions/${item.question.id}`, user);
  assert.equal(study.answer.revision, 1); assert.equal(study.answer.optionId, correct);
});

test("practice finalization produces one persisted result with independently chosen correct/wrong/blank outcomes", async () => {
  const user = await actor(), attempt = await start(user), id = attempt.id;
  for (let i=0;i<3;i++) await save(user, id, i+1, `${attempt.items[i].question.id}-A`);
  await save(user, id, 4, `${attempt.items[3].question.id}-B`, 0, true);
  const active = await json(`practice/${id}`, user); secretFree(active); assert.equal(active.answered, 4);
  const finished = await json(`practice/${id}/finish`, user, "POST", {});
  assert.equal(finished.state, "COMPLETED"); assert.ok(finished.finishedAt);
  assert.deepEqual(finished.summary, {
    total:10,correct:3,incorrect:1,unanswered:6,official:0,author:0,demonstration:10,
    byTopic:[{topic:area,total:10,correct:3,incorrect:1,unanswered:6}],
    byBlock:{general:{total:0,correct:0,incorrect:0,unanswered:0},specific:{total:10,correct:3,incorrect:1,unanswered:6}},
  });
  assert.deepEqual(finished.items.map((i: any) => i.result.correct), [true,true,true,false,null,null,null,null,null,null]);
  assert.ok(finished.items.every((i: any) => i.result.correctOptionId === `${i.question.id}-A`));
  assert.deepEqual(await json(`practice/${id}/finish`, user, "POST", {}), finished);
  assert.deepEqual(await json(`practice/${id}`, user), finished);
  assert.equal((await request(`practice/${id}/items/1`, user, "PUT", {optionId:null,marked:false,baseRevision:1})).status, 409);
  const availability = await json("practice", user);
  assert.equal(availability.active, null); assert.equal(availability.recent[0].id, id);
  assert.equal((await db.query("SELECT count(*)::integer AS n FROM answer WHERE owner_id=$1", [user.id])).rows[0].n, 0);
  await assert.rejects(db.query("UPDATE practice_item SET option_id=NULL,revision=revision+1 WHERE attempt_id=$1 AND position=1", [id]), (e:any)=>e.code==="23514");
  await assert.rejects(db.query("UPDATE practice_attempt SET summary='{}'::jsonb WHERE id=$1", [id]), (e:any)=>e.code==="23514");
  const replay = await request("practice", user, "POST", {requestId:(await db.query("SELECT request_id FROM practice_attempt WHERE id=$1",[id])).rows[0].request_id,size:10,area});
  assert.equal(replay.status, 201); assert.deepEqual(await replay.json(), finished);
});

test("practice fixes old versions and option identity after a new version is published", async () => {
  const user = await actor(), attempt = await start(user), item = attempt.items[0];
  const old = initial.find((q)=>q.id===item.question.id)!;
  await save(user, attempt.id, 1, `${old.id}-A`);
  const newer = await fixture(200, {parent:old.parent,version:2});
  const resumed = await json(`practice/${attempt.id}`, user);
  assert.equal(resumed.items[0].question.id, old.id); assert.equal(resumed.items[0].question.versionNumber, 1);
  const finished = await json(`practice/${attempt.id}/finish`, user, "POST", {});
  assert.equal(finished.items[0].result.correct, true); assert.equal(finished.items[0].result.correctOptionId, `${old.id}-A`);
  const fresh = await start(user, 30);
  assert.equal(fresh.items.some((i:any)=>i.question.id===old.id), false);
  const replacement = fresh.items.find((i:any)=>i.question.id===newer.id);
  assert.ok(replacement); assert.equal(replacement.question.options[0].id, `${newer.id}-B`);
  await save(user, fresh.id, replacement.position, `${newer.id}-A`);
  const result = await json(`practice/${fresh.id}/finish`, user, "POST", {});
  assert.equal(result.items[replacement.position-1].result.correct, false);
  assert.equal(result.items[replacement.position-1].result.correctOptionId, `${newer.id}-B`);
});

test("practice concurrent starts serialize across credentials without duplicate attempts", async () => {
  const user = await actor(), alias = await anotherCredential(user), requestId = randomUUID();
  const results = await Promise.all([user,alias].map((who)=>start(who,10,area,requestId)));
  assert.equal(results[0].id, results[1].id);
  const other = await actor(), otherAlias = await anotherCredential(other);
  const responses = await Promise.all([other,otherAlias].map((who)=>request("practice",who,"POST",{requestId:randomUUID(),size:10,area})));
  assert.deepEqual(responses.map((r)=>r.status).sort(),[201,409]);
  assert.equal((await db.query("SELECT count(*)::integer AS n FROM practice_attempt WHERE owner_id=$1",[other.id])).rows[0].n,1);
});

test("practice concurrent saves and finishes preserve revisions and one final result across credentials", async () => {
  const user = await actor(), alias = await anotherCredential(user), attempt = await start(user), id = attempt.id;
  const answers = [0,1].map((n)=>attempt.items[0].question.options[n].id);
  const responses = await Promise.all([user,alias].map((who,n)=>request(`practice/${id}/items/1`,who,"PUT",{optionId:answers[n],marked:false,baseRevision:0})));
  assert.deepEqual(responses.map((r)=>r.status).sort(),[200,409]);
  const resumed = await json(`practice/${id}`,user); assert.equal(resumed.items[0].answer.revision,1);
  const finals = await Promise.all([user,alias].map((who)=>json(`practice/${id}/finish`,who,"POST",{})));
  assert.deepEqual(finals[0],finals[1]);
  assert.equal(finals[0].answered,1); assert.equal(finals[0].summary.unanswered,9);
  assert.equal((await request(`practice/${id}/items/1`,alias,"PUT",{optionId:answers[0],marked:false,baseRevision:1})).status,409);
});

test("practice save versus finish and creation retry always return a coherent snapshot", async () => {
  const user = await actor(), alias = await anotherCredential(user), requestId = randomUUID();
  const attempt = await start(user,10,area,requestId), id = attempt.id;
  const response = await Promise.all([
    request(`practice/${id}/items/1`,user,"PUT",{optionId:attempt.items[0].question.options[0].id,marked:true,baseRevision:0}),
    request(`practice/${id}/finish`,alias,"POST",{}),
    request("practice",user,"POST",{requestId,size:10,area}),
  ]);
  assert.ok([200,409].includes(response[0].status)); assert.equal(response[1].status,200); assert.equal(response[2].status,201);
  const retried = await response[2].json();
  assert.equal(retried.answered,retried.items.filter((i:any)=>i.answer.optionId!==null).length);
  if(retried.state==="IN_PROGRESS") secretFree(retried);
  else assert.equal(retried.summary.total,10);
  const finished = await json(`practice/${id}`,user);
  const answered = response[0].status===200 ? 1 : 0;
  assert.equal(finished.state,"COMPLETED"); assert.equal(finished.answered,answered);
  assert.equal(finished.summary.unanswered,10-answered);
});

test("practice database constraints preserve the fixed selection, exact size and owner cleanup", async () => {
  const user = await actor(), attempt = await start(user), id = attempt.id;
  await assert.rejects(db.query("DELETE FROM practice_item WHERE attempt_id=$1 AND position=1",[id]),(e:any)=>e.code==="23514");
  await assert.rejects(db.query("UPDATE practice_item SET option_id=$2,revision=revision+1 WHERE attempt_id=$1 AND position=1",[id,attempt.items[1].question.options[0].id]),(e:any)=>e.code==="23503");
  await assert.rejects(db.query("UPDATE practice_item SET version_id=$2,revision=revision+1 WHERE attempt_id=$1 AND position=1",[id,attempt.items[1].question.id]),(e:any)=>e.code==="23514");
  const other = await actor(), client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO practice_attempt(id,owner_id,request_id,size) VALUES($1,$2,$3,10)",[randomUUID(),other.id,randomUUID()]);
    await assert.rejects(client.query("COMMIT"),(e:any)=>e.code==="23514");
  } finally { await client.query("ROLLBACK"); client.release(); }
  await db.query("DELETE FROM browser_session WHERE identity_id=$1",[user.id]);
  await db.query("DELETE FROM study_identity WHERE id=$1",[user.id]);
  assert.equal((await db.query("SELECT count(*)::integer AS n FROM practice_attempt WHERE owner_id=$1",[user.id])).rows[0].n,0);
  assert.equal((await db.query("SELECT count(*)::integer AS n FROM practice_item WHERE attempt_id=$1",[id])).rows[0].n,0);
});

async function source(kind: "EXAM" | "ANSWER_KEY" | "RESPONSE_STANDARD") {
  const id = randomUUID(); sources.add(id);
  await db.query(
    `INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,
      status,is_final,key_finality,verification_origin,assisted_verifier,reviewed_at)
     VALUES($1,'TEST ONLY synthetic source',$2,$3,2098,'TEST ONLY course','BACHARELADO',$4,64,1,
      'VERIFIED',$5,$6,'ASSISTED','test-only-reviewer',clock_timestamp())`,
    [id, `https://download.inep.gov.br/enade/test-only-${id}.pdf`, kind,
      createHash("sha256").update(id).digest("hex"), kind === "ANSWER_KEY", kind === "ANSWER_KEY" ? "ONLY_PUBLISHED" : null],
  );
  return id;
}

test("practice reuses image/source presentation and reveals D10 key provenance only after finishing", async () => {
  const topic = "Sistemas distribuídos";
  for(let i=0;i<9;i++) await fixture(300+i,{topic});
  const exam=await source("EXAM"), key=await source("ANSWER_KEY");
  const official=await fixture(400,{topic,exam,key,image:true});
  const user=await actor(), attempt=await start(user,10,topic);
  const item=attempt.items.find((i:any)=>i.question.id===official.id);
  assert.ok(item); secretFree(attempt);
  assert.equal(item.question.presentation,"IMAGE"); assert.equal(item.question.images.length,1);
  assert.equal(item.question.provenance.exam.id,exam);
  assert.equal(item.question.provenance.exam.year,2098);
  assert.equal(item.question.provenance.questionNumber,400);
  assert.equal(item.question.reviewOrigin,"ASSISTED");
  assert.equal("importedBy" in item.question.provenance.exam,false);
  const image = await request(item.question.images[0].url.slice(5),user);
  assert.equal(image.status,200); assert.equal(image.headers.get("content-type"),"image/webp");
  await save(user,attempt.id,item.position,`${official.id}-A`);
  const finished=await json(`practice/${attempt.id}/finish`,user,"POST",{});
  assert.equal(finished.summary.official,1); assert.equal(finished.summary.demonstration,9);
  assert.equal(finished.summary.correct,1); assert.equal(finished.summary.unanswered,9);
  const result=finished.items[item.position-1].result;
  assert.equal(result.correct,true); assert.equal(result.answerKey.id,key);
  assert.equal(result.answerKey.finality,"ONLY_PUBLISHED");
  assert.equal(result.answerKey.page,1);
});

test("practice offers only the five most recent completed results and preserves historical attempts", async () => {
  const user=await actor(), ids=[];
  for(let i=0;i<6;i++) {
    const attempt=await start(user);
    ids.push(attempt.id);
    const finished=await json(`practice/${attempt.id}/finish`,user,"POST",{});
    assert.equal(finished.summary.unanswered,10);
  }
  const available=await json("practice",user);
  assert.equal(available.active,null); assert.equal(available.recent.length,5);
  assert.deepEqual(available.recent.map((a:any)=>a.id),ids.slice(1).reverse());
  assert.equal((await json(`practice/${ids[0]}`,user)).state,"COMPLETED");
});

test("an edition exam applies the published objectives in order, pauses, expires on the server and submits discursive drafts", async () => {
  const exam = await source("EXAM"), key = await source("ANSWER_KEY"), standard = await source("RESPONSE_STANDARD");
  // Prova TEST ONLY com as questões 1 a 23, sem a 7; as quatro primeiras são de Formação Geral.
  const numbers = Array.from({ length: 23 }, (_, i) => i + 1).filter((n) => n !== 7);
  // Ordem de criação embaralhada: a prova segue o número, não a inserção.
  for (const n of [...numbers].reverse()) await fixture(500 + n, { exam, key, number: n, topic: n <= 4 ? "Formação Geral" : area });
  const user = await actor();
  const listed = (await json("editions", user)).editions.find((e: any) => e.id === exam);
  assert.deepEqual([listed.objectives, listed.general, listed.missing, listed.discursive], [22, 4, [7], 0]);

  // Discursiva da mesma prova, para conferir o envio do rascunho ao finalizar.
  const reviewer = await actor();
  await db.query("INSERT INTO account(identity_id,email,password_hash) VALUES($1,$2,$3)",
    [reviewer.id, `edition-${reviewer.id}@example.invalid`, `scrypt$131072$8$1$${"0".repeat(32)}$${"0".repeat(64)}`]);
  const discursiveId = `discursive-${exam.replace(/-/g, "").slice(0, 12)}-d1`;
  await db.query(
    `INSERT INTO discursive_question(id,exam_source_id,standard_source_id,year,modality,number,area,criteria,reviewed_by)
     VALUES($1,$2,$3,2098,'BACHARELADO',1,'Formação Geral','[{"label":null,"points":10}]',$4)`,
    [discursiveId, exam, standard, reviewer.id]);
  await json(`discursive/${discursiveId}/response`, user, "PUT", { body: "TEST ONLY rascunho da prova", baseRevision: 0 });

  const requestId = randomUUID();
  const started = await json(`editions/${exam}/attempts`, user, "POST", { requestId }, 201);
  secretFree(started);
  assert.equal(started.kind, "EDITION");
  assert.equal(started.size, 22);
  assert.deepEqual(started.discursive.map((d: any) => d.id), [discursiveId]);
  assert.deepEqual(started.items.map((i: any) => i.question.provenance?.questionNumber), numbers);
  const minutes = (new Date(started.deadlineAt).getTime() - Date.now()) / 60000;
  assert.ok(minutes > 239 && minutes <= 240, `prazo ${minutes}`);
  assert.equal((await json(`editions/${exam}/attempts`, user, "POST", { requestId }, 201)).id, started.id); // repetição
  assert.equal((await request(`editions/${exam}/attempts`, user, "POST", { requestId: randomUUID() })).status, 409); // já há uma ativa
  // Pausada: não aceita resposta e o tempo restante não corre.
  const paused = await json(`editions/attempts/${started.id}/pause`, user, "POST", {});
  assert.ok(paused.pausedAt);
  assert.equal((await request(`practice/${started.id}/items/1`, user, "PUT", { optionId: null, marked: true, baseRevision: 0 })).status, 409);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal((await json(`practice/${started.id}`, user)).remainingMs, paused.remainingMs);
  const resumed = await json(`editions/attempts/${started.id}/resume`, user, "POST", {});
  assert.equal(resumed.pausedAt, null);
  assert.ok(new Date(resumed.deadlineAt).getTime() - new Date(started.deadlineAt).getTime() >= 1000, "o prazo anda com a pausa");
  await save(user, started.id, 1, `${started.items[0].question.id}-A`);
  const finished = await json(`practice/${started.id}/finish`, user, "POST", {});
  assert.deepEqual(finished.summary.byBlock.general, { total: 4, correct: 1, incorrect: 0, unanswered: 3 });
  const draft = (await db.query("SELECT submitted_at FROM discursive_response WHERE owner_id=$1 AND question_id=$2", [user.id, discursiveId])).rows[0];
  assert.ok(draft.submitted_at, "o rascunho da discursiva é enviado com a prova");

  // Prazo vencido: a próxima gravação finaliza com o que estava salvo.
  const late = await actor();
  const lateExam = await json(`editions/${exam}/attempts`, late, "POST", { requestId: randomUUID() }, 201);
  const expired = randomUUID();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM practice_attempt WHERE id=$1", [lateExam.id]);
    await client.query(
      `INSERT INTO practice_attempt(id,owner_id,request_id,size,kind,exam_source_id,deadline_at)
       VALUES($1,$2,$3,22,'EDITION',$4,clock_timestamp() - interval '1 minute')`, [expired, late.id, randomUUID(), exam]);
    for (const [index, item] of lateExam.items.entries())
      await client.query("INSERT INTO practice_item(attempt_id,position,question_id,version_id) SELECT $1,$2,question_id,id FROM question_version WHERE id=$3",
        [expired, index + 1, item.question.id]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  const refused = await request(`practice/${expired}/items/1`, late, "PUT", { optionId: null, marked: true, baseRevision: 0 });
  assert.equal(refused.status, 409);
  assert.match((await refused.json()).message, /tempo da prova acabou/);
  const after = await json(`practice/${expired}`, late);
  assert.equal(after.state, "COMPLETED");
  assert.equal(after.summary.unanswered, 22);
});
