import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, parseAnswerKey } from "../scripts/lib/question-extraction.mjs";

// Synthetic source lines only; no official question or database mutation.
const line = (text, marker = null) => ({
  text, marker, page: 1, yMin: 100, yMax: 112, xMax: 200,
});
const options = ["A", "B", "C", "D", "E"].map((letter) =>
  line(`${letter} Alternativa de teste ${letter}`, letter),
);
const classifyOne = (lines) => classify([
  { key: "Q1", kind: "OBJECTIVE", number: 1, lines, regions: [], joins: [] },
], {
  answers: new Map([["Q1", "A"]]), definitive: true,
  graphicsByPage: new Map(), symbolPages: new Set(),
})[0];

test("a question without its stem cannot be a clean draft", () => {
  const item = classifyOne(options);
  assert.equal(item.status, "revisao-manual");
  assert.ok(item.flags.includes("enunciado-ausente"));
});

test("recognized A-E markers cannot hide a missing option text", () => {
  const item = classifyOne([
    line("Enunciado de teste."),
    ...options.map((option, index) => index === 2 ? { ...option, text: "C " } : option),
  ]);
  assert.equal(item.status, "revisao-manual");
  assert.ok(item.flags.includes("alternativa-vazia"));
});

test("contradictory answer keys fail instead of selecting the first answer", () => {
  assert.throws(() => parseAnswerKey(
    "GABARITO DEFINITIVO\nQUESTÃO 1 A\nQUESTÃO 1 C\n",
  ), /contraditório/);
  assert.equal(parseAnswerKey(
    "GABARITO DEFINITIVO\nQUESTÃO 1 A\nQUESTÃO 1 A\n",
  ).answers.get("Q1"), "A");
});
