import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createApp, db } from "../apps/api/src/main.js";
import { loadCore } from "../apps/api/src/core-concepts.js";
import { loadLessons, parseLessons } from "../apps/api/src/core-lessons.js";

// Lições da Biblioteca (LIB-2): conteúdo versionado e ligado ao núcleo, e a
// rota que entrega uma lição. Só visitantes TEST ONLY criados aqui.

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

test("the pilot areas have one lesson per core concept", async () => {
  const core = await loadCore();
  const lessons = await loadLessons(core.areas);
  for (const slug of ["algoritmos", "sistemas-operacionais"]) {
    const area = core.areas.find((a) => a.slug === slug)!;
    assert.deepEqual([...lessons.get(slug)!.lessons.keys()].sort(), area.concepts.map((c) => c.id).sort(), slug);
    assert.ok(lessons.get(slug)!.cover, `${slug}: capa`);
  }
});

test("a lesson file is rejected when it breaks the format", async () => {
  const area = (await loadCore()).areas.find((a) => a.slug === "algoritmos")!;
  const paragraph = "Um parágrafo de explicação com tamanho suficiente para passar.";
  const lesson = {
    concept: "alg-busca", body: [paragraph, paragraph, paragraph, paragraph],
    example: { title: "Exemplo", steps: ["Primeiro passo.", "Segundo passo."], check: "Executado em Python 3 para conferir." },
    mistake: "Um erro comum descrito com detalhe suficiente para o validador.",
    recall: [{ q: "Pergunta para fixar?", a: "Resposta." }, { q: "Outra pergunta?", a: "Outra." }],
  };
  const file = (l: object) => ({ slug: "algoritmos", lessons: [{ ...lesson, ...l }] });
  assert.equal(parseLessons(file({}), area, "t").lessons.size, 1);
  assert.throws(() => parseLessons(file({ concept: "so-deadlock" }), area, "t"), /conceito inexistente/);
  assert.throws(() => parseLessons(file({ body: [paragraph] }), area, "t"), /de 4 a 8/);
  assert.throws(() => parseLessons(file({ mistake: `${lesson.mistake} — com travessão` }), area, "t"), /travessão/);
  assert.throws(() => parseLessons(file({ figure: { src: "/illustrations/nao-existe.webp", alt: "Uma figura que não existe." } }), area, "t"), /não encontrado/);
  assert.throws(() => parseLessons({ ...file({}), lessons: [lesson, lesson] }, area, "t"), /repetida/);
});

test("the area page flags concepts with a lesson, and the lesson route serves it", async () => {
  const cookie = await guest();
  const area = await (await fetch(`${base}/api/core/sistemas-operacionais`, { headers: { Cookie: cookie } })).json();
  assert.equal(area.cover, "/illustrations/CAPA-SO.webp");
  assert.ok(area.concepts.every((c: any) => c.lesson === true));
  // Deadlock caiu em 2017 (Q35): aparece mesmo quando a questão não está publicada neste banco.
  const deadlock = area.concepts.find((c: any) => c.id === "so-deadlock");
  assert.ok(deadlock.appearances.some((q: any) => q.year === 2017 && /^Deadlock/.test(q.subject)));
  for (const c of area.concepts) assert.ok(c.appearances.length >= c.questions.length, c.id);
  const response = await fetch(`${base}/api/core/sistemas-operacionais/lessons/so-deadlock`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  const lesson = await response.json();
  assert.equal(lesson.concept, "so-deadlock");
  assert.ok(lesson.body.length >= 4 && lesson.recall.length >= 2);
  const missing = await fetch(`${base}/api/core/redes/lessons/red-camadas`, { headers: { Cookie: cookie } });
  assert.equal(missing.status, 404);
});
