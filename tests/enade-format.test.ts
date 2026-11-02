import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createApp, db } from "../apps/api/src/main.js";
import { formatFixture } from "./enade-format-fixture.js";

let app:Awaited<ReturnType<typeof createApp>>, base:string;
let fixture:Awaited<ReturnType<typeof formatFixture>>;
const owners:string[]=[];
type Actor={id:string;cookie:string};
before(async()=>{ fixture=await formatFixture(db); app=await createApp(); await app.listen(0,"127.0.0.1"); base=await app.getUrl(); });
after(async()=>{ try { await fixture?.cleanup(owners); } finally { await app?.close(); await db.end(); } });
function request(path:string,user?:Actor,method="GET",body?:unknown) {
  return fetch(`${base}/api/${path}`,{method,headers:{Cookie:user?.cookie??"","Content-Type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
}
async function actor():Promise<Actor> {
  const response=await request("session",undefined,"POST",{});
  assert.equal(response.status,201);
  const cookie=response.headers.get("set-cookie")!.split(";")[0];
  const hash=createHash("sha256").update(cookie.slice(14)).digest("hex");
  const id=(await db.query("SELECT identity_id FROM browser_session WHERE token_hash=$1",[hash])).rows[0].identity_id;
  owners.push(id); return {id,cookie};
}
async function start(user:Actor,requestId=randomUUID()) {
  const response=await request("formats/enade-2026/attempts",user,"POST",{requestId});
  assert.equal(response.status,201,await response.clone().text());
  return response.json();
}

test("format fixes exactly 15 FG, 30 specific and one discursive for four hours; retries keep the same items",async()=>{
  const user=await actor(), requestId=randomUUID();
  assert.equal((await request("formats/enade-2026")).status,401);
  const availability=await (await request("formats/enade-2026",user)).json();
  assert.equal(availability.available,true); assert.deepEqual(availability.missing,{general:0,specific:0,discursive:0});
  const first=await start(user,requestId), again=await start(user,requestId);
  assert.equal(first.kind,"FORMAT"); assert.equal(first.formatYear,2026); assert.equal(first.size,45);
  assert.equal(first.edition,null); assert.equal(first.discursive.length,1);
  assert.equal(first.items.slice(0,15).every((i:any)=>i.question.topic==="Formação Geral"),true);
  assert.equal(first.items.slice(15).every((i:any)=>i.question.topic!=="Formação Geral"),true);
  assert.equal(new Set(first.items.map((i:any)=>i.question.id)).size,45);
  assert.ok(new Date(first.deadlineAt).getTime()-new Date(first.createdAt).getTime()===240*60000);
  assert.ok(first.items.every((i:any)=>!i.result && !("correctOptionId" in i.question) && i.question.origin==="OFFICIAL" && !i.question.demonstration));
  assert.deepEqual(again.items,first.items); assert.deepEqual(again.discursive,first.discursive); assert.equal(again.id,first.id);
  assert.equal((await request("formats/enade-2026/attempts",user,"POST",{requestId:randomUUID()})).status,409);
  assert.equal((await request("formats/enade-2026/attempts",user,"POST",{requestId,ownerId:user.id})).status,400);
});

test("discursive has a private draft, optimistic revisions, pause protection and no standard before completion",async()=>{
  const user=await actor(), other=await actor(), attempt=await start(user), path=`practice/${attempt.id}/discursive`;
  const opened=await (await request(path,user)).json();
  assert.deepEqual(opened.standardImages,[]); assert.equal(opened.standardUrl,null); assert.equal(opened.reviewNote,null); assert.equal(opened.response.body,"");
  const standardHash=(await db.query("SELECT asset_sha256 FROM practice_discursive_image WHERE attempt_id=$1 AND part='STANDARD' LIMIT 1",[attempt.id])).rows[0].asset_sha256;
  assert.equal((await request(`${path}/images/${standardHash}.webp`,user)).status,404);
  assert.equal((await request(path,other)).status,404);
  const body={body:"TEST ONLY: meu raciocínio",baseRevision:0};
  assert.deepEqual(await (await request(`${path}/response`,user,"PUT",body)).json(),{revision:1});
  assert.deepEqual(await (await request(`${path}/response`,user,"PUT",body)).json(),{revision:1});
  const replies=await Promise.all(["primeira","segunda"].map(body=>request(`${path}/response`,user,"PUT",{body,baseRevision:1})));
  assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
  assert.equal((await request(`${path}/response`,other,"PUT",{body:"invasão",baseRevision:2})).status,404);
  assert.equal((await request(`${path}/assessment`,user,"PUT",{levels:[2,2]})).status,409);
  const pause=await request(`practice/${attempt.id}/pause`,user,"POST",{});
  assert.equal(pause.status,200); const paused=await pause.json(); assert.ok(paused.pausedAt);
  assert.equal((await request(`${path}/response`,user,"PUT",{body:"pausada",baseRevision:2})).status,409);
  await new Promise(resolve=>setTimeout(resolve,30));
  const resume=await request(`practice/${attempt.id}/resume`,user,"POST",{});
  assert.equal(resume.status,200); const resumed=await resume.json(); assert.equal(resumed.pausedAt,null);
  assert.ok(new Date(resumed.deadlineAt).getTime()>new Date(attempt.deadlineAt).getTime());
  assert.ok(resumed.remainingMs>=paused.remainingMs-1000);
  const completed=await (await request(`practice/${attempt.id}/finish`,user,"POST",{})).json();
  assert.equal(completed.summary.byBlock.general.total,15); assert.equal(completed.summary.byBlock.specific.total,30);
  const final=await (await request(path,user)).json();
  assert.ok(final.response.submittedAt); assert.ok(final.standardImages.length); assert.ok(["primeira","segunda"].includes(final.response.body));
  assert.equal((await request(`${path}/images/${standardHash}.webp`,user)).status,200);
  assert.equal((await request(`${path}/images/${standardHash}.webp`,other)).status,404);
  assert.equal((await request(`${path}/response`,user,"PUT",{body:"tardio",baseRevision:2})).status,409);
  const assessed=await (await request(`${path}/assessment`,user,"PUT",{levels:final.criteria.map(()=>2)})).json();
  assert.equal(assessed.score,10);
  assert.deepEqual((await (await request(`practice/${attempt.id}/finish`,user,"POST",{})).json()).summary,completed.summary);
});

test("a new attempt does not reuse an old submitted study response and cancellation removes its private images",async()=>{
  const user=await actor(), attempt=await start(user), question=attempt.discursive[0].id;
  await db.query(`INSERT INTO discursive_response(owner_id,question_id,body,revision,submitted_at)
    VALUES($1,$2,'TEST ONLY resposta antiga',1,now())`,[user.id,question]);
  const path=`practice/${attempt.id}/discursive`;
  const current=await (await request(path,user)).json();
  assert.equal(current.response.body,""); assert.deepEqual(current.standardImages,[]);
  const hash=(await db.query("SELECT asset_sha256 FROM practice_discursive_image WHERE attempt_id=$1 AND part='STANDARD' LIMIT 1",[attempt.id])).rows[0].asset_sha256;
  assert.equal((await request(`${path}/images/${hash}.webp`,user)).status,404);
  await request(`practice/${attempt.id}/cancel`,user,"POST",{});
  assert.equal((await request(path,user)).status,404);
  assert.equal((await request(`${path}/images/${hash}.webp`,user)).status,404);
  const next=await start(user);
  assert.equal(next.discursive.length,1); assert.notEqual(next.id,attempt.id);
});

test("database keeps the selected discursive and its crops fixed, and a blank answer freezes at completion",async()=>{
  const user=await actor(), attempt=await start(user), path=`practice/${attempt.id}/discursive`;
  await assert.rejects(db.query("UPDATE practice_discursive SET content=jsonb_set(content,'{title}','\"changed\"') WHERE attempt_id=$1",[attempt.id]),{code:"23514"});
  await assert.rejects(db.query("DELETE FROM practice_discursive WHERE attempt_id=$1",[attempt.id]),{code:"23514"});
  await assert.rejects(db.query("UPDATE practice_discursive_image SET source_page=source_page+1 WHERE attempt_id=$1",[attempt.id]),{code:"23514"});
  await assert.rejects(db.query("UPDATE practice_attempt SET format_year=2025 WHERE id=$1",[attempt.id]),{code:"23514"});
  await request(`practice/${attempt.id}/finish`,user,"POST",{});
  const final=await (await request(path,user)).json();
  assert.equal(final.response.body,""); assert.ok(final.response.submittedAt); assert.ok(final.standardImages.length);
  await assert.rejects(db.query("UPDATE practice_discursive SET body='late',revision=revision+1 WHERE attempt_id=$1",[attempt.id]),{code:"23514"});
});

test("server deadline freezes the last saved discursive and rejects a late write",async()=>{
  const templateOwner=await actor(), template=await start(templateOwner), user=await actor(), id=randomUUID();
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(`WITH instant AS (SELECT clock_timestamp() AS now)
      INSERT INTO practice_attempt(id,owner_id,request_id,size,kind,format_year,created_at,deadline_at)
      SELECT $1,$2,$3,45,'FORMAT',2026,now-interval '4 hours 1 minute',now-interval '1 minute' FROM instant`,[id,user.id,randomUUID()]);
    await client.query(`INSERT INTO practice_item(attempt_id,position,question_id,version_id)
      SELECT $1,position,question_id,version_id FROM practice_item WHERE attempt_id=$2`,[id,template.id]);
    await client.query(`INSERT INTO practice_discursive(attempt_id,question_id,content)
      SELECT $1,question_id,content FROM practice_discursive WHERE attempt_id=$2`,[id,template.id]);
    await client.query(`INSERT INTO practice_discursive_image(attempt_id,part,position,asset_sha256,source_page,box,dpi)
      SELECT $1,part,position,asset_sha256,source_page,box,dpi FROM practice_discursive_image WHERE attempt_id=$2`,[id,template.id]);
    await client.query("UPDATE practice_discursive SET body='TEST ONLY último texto salvo',revision=1 WHERE attempt_id=$1",[id]);
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  const path=`practice/${id}/discursive`;
  assert.equal((await request(`${path}/response`,user,"PUT",{body:"alteração atrasada",baseRevision:1})).status,409);
  const result=await (await request(`practice/${id}`,user)).json(); assert.equal(result.state,"COMPLETED");
  const discursive=await (await request(path,user)).json();
  assert.equal(discursive.response.body,"TEST ONLY último texto salvo"); assert.ok(discursive.standardImages.length);
});

test("database rejects an otherwise complete format when its discursive was not fixed",async()=>{
  const templateOwner=await actor(), template=await start(templateOwner), user=await actor(), id=randomUUID();
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(`WITH instant AS (SELECT clock_timestamp() AS now)
      INSERT INTO practice_attempt(id,owner_id,request_id,size,kind,format_year,created_at,deadline_at)
      SELECT $1,$2,$3,45,'FORMAT',2026,now,now+interval '4 hours' FROM instant`,[id,user.id,randomUUID()]);
    await client.query(`INSERT INTO practice_item(attempt_id,position,question_id,version_id)
      SELECT $1,position,question_id,version_id FROM practice_item WHERE attempt_id=$2`,[id,template.id]);
    await assert.rejects(client.query("COMMIT"),{code:"23514"});
  } finally { await client.query("ROLLBACK"); client.release(); }
  assert.equal((await db.query("SELECT 1 FROM practice_attempt WHERE id=$1",[id])).rowCount,0);
});
