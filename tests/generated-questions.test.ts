import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { createApp, db } from "../apps/api/src/main.js";
import { auditGenerated } from "../apps/api/src/generated-audit.js";
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
  assert.throws(() => parseGeneratedQuestion({ ...sample, format: "ITENS" }, "q"), /formato inválido/);
  assert.throws(() => parseGeneratedQuestion({ ...sample, options: ["a", "a", "c", "d", "e"] }, "q"), /repetidas/);
});

const items = (format: string, prompt: string, extra: Record<string, unknown>, answer: string) => ({
  ...sample, format, prompt, options: undefined, answer: undefined,
  explanation: `Resposta: ${answer}.\n\n${"ABCDE".split("").filter((l) => l !== answer).map((l) => `${l}) x`).join("\n")}`,
  ...extra,
});
const three = "Avalie.\n\nI. Um.\nII. Dois.\nIII. Três.\n\nÉ correto o que se afirma em";

test("item and assertion questions use the ENADE template and the letter is computed, not written", () => {
  const q = parseGeneratedQuestion(items("ITENS3", three, { truth: ["III", "II"] }, "D"), "q");
  assert.deepEqual(q.options, ["I, apenas.", "II, apenas.", "I e III, apenas.", "II e III, apenas.", "I, II e III."]);
  assert.equal(q.answer, "D");
  // Combinações em qualquer ordem saem na ordem da prova; "todas" sem "apenas".
  const four = three.replace("III. Três.", "III. Três.\nIV. Quatro.");
  const custom = parseGeneratedQuestion(items("ITENS4", four, {
    truth: ["I", "IV"], combos: [["I", "II", "III", "IV"], ["II", "III"], ["IV", "I"], ["I"], ["III"]],
  }, "C"), "q");
  assert.deepEqual(custom.options, ["I, apenas.", "III, apenas.", "I e IV, apenas.", "II e III, apenas.", "I, II, III e IV."]);
  assert.throws(() => parseGeneratedQuestion(items("ITENS3", three, { truth: ["I", "II"] }, "A"), "q"), /não está entre/);
  assert.throws(() => parseGeneratedQuestion(items("ITENS4", four, { truth: ["I"] }, "A"), "q"), /precisa de "combos"/);
  assert.throws(() => parseGeneratedQuestion(items("ITENS3", four, { truth: ["I"] }, "A"), "q"), /exatamente/);
  assert.throws(() => parseGeneratedQuestion({ ...items("ITENS3", three, { truth: ["I"] }, "A"), options: sample.options }, "q"), /molde/);
  // A explicação precisa citar a letra calculada.
  assert.throws(() => parseGeneratedQuestion(items("ITENS3", three, { truth: ["I"] }, "B"), "q"), /Resposta: A/);

  const assertion = "Caso.\n\nI. Primeira.\n\nPORQUE\n\nII. Segunda.\n\nA respeito dessas asserções, assinale a opção correta.";
  const cases: [Record<string, boolean>, string][] = [
    [{ first: true, second: true, justifies: true }, "A"], [{ first: true, second: true, justifies: false }, "B"],
    [{ first: true, second: false }, "C"], [{ first: false, second: true }, "D"], [{ first: false, second: false }, "E"],
  ];
  for (const [truth, letter] of cases)
    assert.equal(parseGeneratedQuestion(items("ASSERCAO", assertion, { assertion: truth }, letter), "q").answer, letter);
  assert.throws(() => parseGeneratedQuestion(items("ASSERCAO", assertion, { assertion: { first: true, second: true } }, "A"), "q"), /justifica/);
});

test("sequence options reuse the same steps and figures need a file, alt text and at most one marker", () => {
  const order = { ...sample, format: "ORDEM", options: ["ARP, DNS, TCP e HTTP.", "DNS, ARP, TCP e HTTP.", "ARP, TCP, DNS e HTTP.", "HTTP, TCP, DNS e ARP.", "DNS, TCP, ARP e HTTP."] };
  assert.equal(parseGeneratedQuestion(order, "q").format, "ORDEM");
  assert.throws(() => parseGeneratedQuestion({ ...order, options: [...order.options.slice(0, 4), "ARP, DNS, UDP e HTTP."] }, "q"), /mesmos passos/);
  const figure = { src: "/illustrations/MET-06.webp", alt: "Pirâmide de caixas, a maior no topo." };
  assert.equal(parseGeneratedQuestion({ ...sample, prompt: "Texto.\n\n[figura]\n\nPergunta?", figure }, "q").figure?.src, figure.src);
  assert.throws(() => parseGeneratedQuestion({ ...sample, prompt: "Texto.\n[figura]" }, "q"), /\[figura\]/);
  assert.throws(() => parseGeneratedQuestion({ ...sample, figure: { ...figure, src: "/illustrations/nao-existe.webp" } }, "q"), /não encontrado/);
  assert.throws(() => parseGeneratedQuestion({ ...sample, figure: { ...figure, alt: "Figura." } }, "q"), /alternativo/);
  assert.throws(() => parseGeneratedQuestion({ ...sample, stimulus: ["VIDEO"] }, "q"), /estímulo/);
});

test("the bank does not give the answer away by length, statement pattern or letter", async () => {
  // Limites de docs/GENERATED-QUALITY-AUDIT.md, perto do que se mede nas 203 objetivas oficiais.
  const questions = [];
  for (const file of await generatedFiles()) questions.push(...(await readGeneratedFile(file)).questions);
  const report = auditGenerated(questions);
  assert.deepEqual(report.simple.overLength, [], "certa mais de 15% maior que a maior errada");
  assert.ok(report.simple.uniqueLongest <= 0.15, `certa única mais longa em ${report.simple.uniqueLongest}`);
  assert.ok(report.simple.guesser <= 0.25, `chutador acerta ${report.simple.guesser}`);
  assert.ok(report.items.firstTrue >= 0.4 && report.items.firstTrue <= 0.75, `item I verdadeiro em ${report.items.firstTrue}`);
  const trueCounts = Object.values(report.items.byTrueCount);
  assert.ok(Object.keys(report.items.byTrueCount).length >= 3 && Math.max(...trueCounts) / report.items.count <= 0.85, "número de afirmações verdadeiras variado");
  const assertion = report.assertion;
  assert.ok((assertion.byAnswer.A ?? 0) / assertion.count <= 0.35 && (assertion.byAnswer.B ?? 0) / assertion.count >= 0.15 && (assertion.byAnswer.E ?? 0) >= 1, "asserção-razão equilibrada");
  for (const letter of "ABCDE") {
    const share = (report.letters[letter] ?? 0) / report.total;
    assert.ok(share >= 0.12 && share <= 0.26, `letra ${letter} em ${share}`);
  }
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
