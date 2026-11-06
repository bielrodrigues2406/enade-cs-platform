import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { createApp, db } from "../apps/api/src/main.js";
import {
  generatedFiles, parseGeneratedQuestion, publishGeneratedFile, readGeneratedFile,
} from "../apps/api/src/generated-publication.js";

// Questões geradas por IA (GEN-1): conteúdo versionado válido, publicação
// idempotente, separação do banco oficial e ligação com o núcleo.

let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
const identities: string[] = [];
const ALGORITMOS = path.resolve("data/generated-questions/algoritmos.json");

before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});

after(async () => {
  try {
    await db.query("DELETE FROM answer_event WHERE owner_id=ANY($1::uuid[])", [identities]);
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
  if (id) identities.push(id);
  return cookie;
}
const call = (url: string, cookie: string, method = "GET", body?: unknown) => fetch(`${base}/api/${url}`, {
  method, headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const sample = {
  id: "gen-teste-exemplo", kind: "ESPELHO", format: "SIMPLES", concepts: ["alg-busca"],
  title: "T", subject: "S", prompt: "Enunciado.", options: ["a", "b", "c", "d", "e"], answer: "B",
  explanation: "Resposta: B.\n\nPorque sim.\n\nAs outras alternativas:\nA) x\nC) x\nD) x\nE) x",
  check: "Nova resolução.",
};

test("every generated file is valid, linked to its area's core and comments every wrong option", async () => {
  const files = await generatedFiles();
  let total = 0;
  for (const file of files) total += (await readGeneratedFile(file)).questions.length;
  assert.ok(files.length >= 17, "uma por área do núcleo");
  assert.ok(total >= 100, "pelo menos cem questões geradas");
});

test("quality gates reject explanations without the answer, uncommented options, dashes and fake item formats", () => {
  assert.equal(parseGeneratedQuestion(sample, "q").answer, "B");
  assert.throws(() => parseGeneratedQuestion({ ...sample, explanation: "Porque sim." }, "q"), /Resposta: B/);
  assert.throws(() => parseGeneratedQuestion({ ...sample, explanation: sample.explanation.replace("\nD) x", "") }, "q"), /alternativa D/);
  assert.throws(() => parseGeneratedQuestion({ ...sample, prompt: "Enunciado — com travessão." }, "q"), /travessão/);
  assert.throws(() => parseGeneratedQuestion({ ...sample, format: "ITENS" }, "q"), /itens I\., II\./);
  assert.throws(() => parseGeneratedQuestion({ ...sample, options: ["a", "a", "c", "d", "e"] }, "q"), /repetidas/);
});

test("publishing is idempotent and generated questions stay out of the official bank and progress", async () => {
  await publishGeneratedFile(ALGORITMOS);
  const again = await publishGeneratedFile(ALGORITMOS);
  assert.equal(again.published.length, 0, "republicar sem mudança não cria versão");

  const cookie = await guest();
  const official = await (await call("catalog?limit=50", cookie)).json();
  assert.ok(official.items.every((i: any) => i.origin !== "AI_GENERATED"), "banco padrão sem geradas");
  const generated = await (await call(`catalog?${new URLSearchParams({ origin: "generated", area: "Algoritmos", limit: "50" })}`, cookie)).json();
  assert.ok(generated.total >= 12 && generated.items.every((i: any) => i.origin === "AI_GENERATED"));
  assert.equal((await call("catalog?origin=outra", cookie)).status, 400);

  const item = generated.items.find((i: any) => i.id.startsWith("gen-alg-busca-binaria"));
  const question = await (await call(`questions/${item.id}`, cookie)).json();
  assert.equal(question.origin, "AI_GENERATED");
  assert.match(question.authorCredit, /Gerada por IA/);

  const before = (await (await call("me/progress", cookie)).json()).areas.find((a: any) => a.area === "Algoritmos")?.firstAttempts ?? 0;
  const saved = await call(`questions/${item.id}/answer`, cookie, "PUT", { optionId: "B", baseRevision: 0 });
  assert.equal(saved.status, 200);
  const after = (await (await call("me/progress", cookie)).json()).areas.find((a: any) => a.area === "Algoritmos")?.firstAttempts ?? 0;
  assert.equal(after, before, "o desempenho oficial não conta geradas");

  const area = await (await call("core/algoritmos", cookie)).json();
  assert.ok(area.generatedTotal >= 12);
  const busca = area.concepts.find((c: any) => c.id === "alg-busca");
  assert.ok(busca.generated.some((g: any) => g.id === item.id && g.title === "Comparações da busca binária"));
});
