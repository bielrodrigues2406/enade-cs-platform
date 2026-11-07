import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createApp, db } from "../apps/api/src/main.js";
import { loadCore, matches, officialItems, parseConceptLinks, parseCoreArea, FORMACAO_GERAL } from "../apps/api/src/core-concepts.js";
import { confidence } from "../apps/api/src/core-progress.js";
import { loadDecks } from "../apps/api/src/study-content.js";

// Núcleo por área (NUC-1): conteúdo versionado, ligação às questões oficiais,
// confiança e autoavaliação. Só visitantes TEST ONLY criados aqui.

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
const call = (path: string, cookie: string, method = "GET", body?: unknown) => fetch(`${base}/api/${path}`, {
  method, headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test("every official question has a verified link to a concept of its own area", async () => {
  const [core, items] = await Promise.all([loadCore(), officialItems()]);
  assert.equal(core.areas.length, 17, "16 áreas específicas e a Formação Geral");
  const linkedTo = (id: string) => core.areas.flatMap((a) => a.concepts).filter((c) => core.links.get(c.id)!.some((q) => q.id === id));
  for (const area of core.areas) {
    const ofArea = items.filter((i) => i.area === area.area);
    const own = new Set(area.concepts.map((c) => c.id));
    const orphans = ofArea.filter((i) => !linkedTo(i.id).some((c) => own.has(c.id)));
    assert.deepEqual(orphans.map((o) => o.subject), [], `${area.area}: questões sem conceito conferido`);
    assert.equal(core.history.get(area.slug)!.total, ofArea.length);
  }
  const specific = items.filter((i) => i.area !== FORMACAO_GERAL);
  assert.ok(specific.length >= 150, "o inventário tem as objetivas específicas de 2005 a 2021");
  assert.ok(items.every((i) => /^official-[0-9a-f]{12}-q\d+$/.test(i.id)), "ids no formato da publicação assistida");
});

test("decks and sheets referenced by the core exist", async () => {
  const [core, decks] = await Promise.all([loadCore(), loadDecks()]);
  const deckIds = new Set(decks.map((d) => d.deck));
  for (const area of core.areas) if (area.deck) assert.ok(deckIds.has(area.deck), `${area.slug}: baralho ${area.deck}`);
});

test("keywords match at the start of a word, ignoring accents and case", () => {
  const concept = { id: "x-iv", name: "IV", definition: "d", example: "e", match: ["iv", "relacoes de equivalencia"] };
  assert.ok(matches(concept, "Criptografia, assinatura, IV e hash"));
  assert.ok(matches(concept, "Relações de equivalência"));
  assert.ok(!matches(concept, "Inclusiva e ativa"), "não casa no meio da palavra");
});

test("an area file with a cue pointing to an unknown concept is rejected", () => {
  const valid = {
    slug: "teste", area: "Teste", title: "T", summary: "S",
    concepts: [{ id: "tt-um", name: "Um", definition: "d", example: "e", match: ["um"] }],
    facts: ["f"], pairs: [{ a: "a", b: "b", difference: "d" }],
    cues: [{ cue: "c", concept: "tt-um" }], traps: [{ pattern: "PAR", text: "t" }], references: ["r"],
  };
  assert.equal(parseCoreArea(valid, "teste").concepts.length, 1);
  assert.throws(() => parseCoreArea({ ...valid, cues: [{ cue: "c", concept: "tt-dois" }] }, "teste"), /conceito inexistente/);
  assert.throws(() => parseCoreArea({ ...valid, traps: [{ pattern: "OUTRO", text: "t" }] }, "teste"), /pegadinha/);
});

test("confidence weighs self-assessment, answers and cards, and scales answers until five", async () => {
  const area = (await loadCore()).areas.find((a) => a.slug === "sistemas-operacionais")!;
  const all = new Map(area.concepts.map((c) => [c.id, 2]));
  const progress = (attempts: number, correct: number) => ({ area: area.area, published: 13, firstAttempts: attempts, firstCorrect: correct });
  assert.deepEqual(confidence(area, new Map(), undefined, null), { value: 0, self: 0, rated: 0, answers: null, observed: null, attempts: 0, cards: null });
  // Sem baralho: autoavaliação e acerto valem metade cada.
  assert.equal(confidence(area, all, progress(10, 10), null).value, 100);
  assert.equal(confidence(area, all, undefined, null).value, 50);
  // Uma resposta certa só conta 1/5 até haver cinco respostas.
  assert.equal(confidence(area, new Map(), progress(1, 1), null).answers, 20);
  // A tela mostra a taxa observada: 1 de 1 é 100%, com a amostra ao lado (revisão do Codex, R5).
  assert.deepEqual([confidence(area, new Map(), progress(1, 1), null).observed, confidence(area, new Map(), progress(4, 3), null).observed], [100, 75]);
  assert.equal(confidence(area, all, progress(5, 5), 0.5).value, 90);
});

test("a visitor reads the confidence map and an area, and rates concepts", async () => {
  const cookie = await guest();
  const map = await (await call("core", cookie)).json();
  assert.equal(map.areas.length, 17);
  const so = map.areas.find((a: any) => a.slug === "sistemas-operacionais");
  assert.ok(so.share > 0 && so.priority === so.share, "sem confiança, a prioridade é o peso inteiro");
  assert.equal(map.areas.find((a: any) => a.slug === "formacao-geral").priority, null);

  const area = await (await call("core/sistemas-operacionais", cookie)).json();
  assert.equal(area.concepts[0].level, null);
  assert.ok(Array.isArray(area.concepts[0].questions) && !("match" in area.concepts[0]));
  assert.ok(area.facts.length && area.pairs.length && area.cues.length && area.traps.length);

  const rated = await (await call("core/concepts/so-deadlock", cookie, "PUT", { level: 2 })).json();
  assert.equal(rated.slug, "sistemas-operacionais");
  assert.equal(rated.confidence.rated, 1);
  assert.ok(rated.confidence.self > 0);
  assert.equal((await (await call("core/sistemas-operacionais", cookie)).json())
    .concepts.find((c: any) => c.id === "so-deadlock").level, 2);
  const cleared = await (await call("core/concepts/so-deadlock", cookie, "PUT", { level: null })).json();
  assert.equal(cleared.confidence.rated, 0);

  assert.equal((await call("core/concepts/so-deadlock", cookie, "PUT", { level: 3 })).status, 400);
  assert.equal((await call("core/concepts/nao-existe", cookie, "PUT", { level: 1 })).status, 404);
  assert.equal((await call("core/nao-existe", cookie)).status, 404);
});

// Revisão do Codex (R4): a ligação vale pelo que foi conferido, não pela palavra do assunto.
test("verified links fix the keyword mistakes the review found", async () => {
  const core = await loadCore();
  const ids = (concept: string) => core.links.get(concept)!.map((q) => q.subject);
  assert.ok(!ids("alg-ordenacao").some((s) => /AVL/.test(s)), "rotação de AVL não é ordenação");
  assert.ok(!ids("alg-grafos").some((s) => /Dijkstra/.test(s)), "Dijkstra fica em caminho mínimo");
  assert.ok(!ids("alg-lineares").some((s) => /Heaps/.test(s)), "heap não é pilha nem fila");
  assert.ok(ids("et-impactos").includes("Inclusão digital e exclusão social"), "FG de 2005 conta para impactos sociais");
  assert.ok(ids("alg-heap").includes("Heaps (filas de prioridade) e custos de operações"));
});

test("the verified links file rejects unknown questions and concepts", () => {
  const items = new Set(["official-aaaaaaaaaaaa-q1"]);
  const concepts = new Set(["alg-busca"]);
  assert.equal(parseConceptLinks({ links: { "official-aaaaaaaaaaaa-q1": { concepts: ["alg-busca"] } } }, items, concepts).size, 1);
  assert.throws(() => parseConceptLinks({ links: { "official-bbbbbbbbbbbb-q1": { concepts: ["alg-busca"] } } }, items, concepts), /desconhecida/);
  assert.throws(() => parseConceptLinks({ links: { "official-aaaaaaaaaaaa-q1": { concepts: ["alg-nada"] } } }, items, concepts), /conceito desconhecido/);
  assert.throws(() => parseConceptLinks({ links: { "official-aaaaaaaaaaaa-q1": { concepts: [] } } }, items, concepts), /sem conceito/);
});
