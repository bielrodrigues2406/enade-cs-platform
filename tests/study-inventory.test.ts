import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { buildStudyInventory } from "../scripts/lib/study-inventory.mjs";

const source = { id: "exam", kind: "EXAM", family: "ENADE", year: 2021, modality: "BACHARELADO", sha256: "hash" };
function fixture(status = "rascunho", kind = "OBJECTIVE") {
  return {
    catalog: { documents: [source] },
    reports: [{ data: { document: "exam", items: [{ key: "Q1", number: 1, kind, block: "ESPECIFICO", status,
      source: { examSha256: "hash" }, prompt: "Enunciado", pages: [1] }] } }],
    objectiveReviews: [], discursiveReviews: [],
  };
}
const review = { file: "review.json", data: { document: "exam", examSha256: "hash", items: [{ key: "Q1", verdict: "APPROVED", area: "Algoritmos", subject: "Legado" }] } };

test("aprovação não elimina anulação, nem aprova taxonomia", () => {
  const input = fixture("anulada");
  input.objectiveReviews.push(review);
  const result = buildStudyInventory(input);
  assert.equal(result.occurrences[0].reviewStatus, "APPROVED_IN_FILE");
  assert.equal(result.occurrences[0].analysis.topic, null);
  assert.equal(result.editions[0].components[0].eligibleExtracted, 0);
  assert.equal(result.editions[0].components[0].topicIncidence, null);
});
test("escopo de outro curso prevalece sobre aprovação e item sem revisão permanece", () => {
  const input = fixture();
  input.reports[0].data.items[0].flags = ["fora-escopo-ciencia-computacao"];
  input.objectiveReviews.push(review);
  const result = buildStudyInventory(input);
  assert.equal(result.editions[0].components[0].eligibleExtracted, 0);
  assert.equal(buildStudyInventory(fixture()).occurrences[0].reviewStatus, "NO_ACTIVE_REVIEW");
});
test("discursiva antiga usa número e tipo, preservando a chave original Q1", () => {
  const input = fixture("discursiva", "DISCURSIVE");
  input.discursiveReviews.push({ file: "disc.json", data: { document: "exam", examSha256: "hash", items: [{ number: 1, decision: "APPROVED" }] } });
  const result = buildStudyInventory(input);
  assert.equal(result.occurrences[0].key, "Q1");
  assert.equal(result.totals.discursiveApprovedInFiles, 1);
});
test("rejeita conferência repetida, órfã e hash divergente", () => {
  const input = fixture();
  input.objectiveReviews.push(review, review);
  assert.throws(() => buildStudyInventory(input), /repetida/);
  input.objectiveReviews = [{ ...review, data: { ...review.data, examSha256: "outro" } }];
  assert.throws(() => buildStudyInventory(input), /Hash/);
  input.objectiveReviews = [{ ...review, data: { ...review.data, items: [{ key: "Q2" }] } }];
  assert.throws(() => buildStudyInventory(input), /sem ocorrência/);
});
test("rejeita equivalência inexistente e ciclos, sem inferir identidade pelo texto", () => {
  const input = fixture();
  const analysis = (key: string) => [{ data: { items: [{ examId: "exam", examSha256: "hash", key: "Q1", duplicateOf: { examId: "exam", key } }] } }];
  assert.throws(() => buildStudyInventory({ ...input, analyses: analysis("Q2") }), /inválida/);
  assert.throws(() => buildStudyInventory({ ...input, analyses: analysis("Q1") }), /cíclica/);
  assert.equal(buildStudyInventory(input).occurrences[0].analysis.canonicalId, null);
});
test("artefato do repositório é reproduzível offline sem banco", () => {
  execFileSync(process.execPath, ["scripts/study-inventory.mjs", "--check"], { cwd: process.cwd() });
});
