import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, completeness, lineHeader, parseAnswerKey, parseOcrTsv,
  restorePdfOptionMarkers, segmentQuestions, selectAnswerKey, splitOptions } from "../scripts/lib/question-extraction.mjs";

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

test("legacy Discursiva labels do not change the next key's number or kind", () => {
  const { answers } = parseAnswerKey("9 - Discursiva\n10 - Discursiva\n11 - C\n20 - Discursiva\n21 - D\n");
  assert.deepEqual([...answers], [["Q9", "DISCURSIVA"], ["Q10", "DISCURSIVA"],
    ["Q11", "C"], ["Q20", "DISCURSIVA"], ["Q21", "D"]]);
});

const word = (text, xMin, yMin = 80) => ({
  text, xMin, xMax: xMin + text.length * 5, yMin, yMax: yMin + 10,
});

test("spaced legacy headers retain the printed Q number for discursive items", () => {
  const words = ["Q", "U", "ES", "T", "Ã", "O", "3", "9", "–", "D", "IS", "C", "U", "R", "S", "IV", "A"];
  let cursor = 30;
  const header = lineHeader({ words: words.map((text) => {
    const next = word(text, cursor); cursor = next.xMax + 1; return next;
  }) });
  assert.equal(header?.number, 39);
  assert.equal(header?.kind, "Q");
  assert.equal(header?.discursive, true);
  assert.deepEqual(completeness([{ key: "Q39", kind: "DISCURSIVE" }], new Map()),
    { missing: [], unexpected: [] });
});

test("a mention of the survey in instructions does not end extraction", () => {
  const words = Array.from({ length: 12 }, (_, i) => [
    word("QUESTÃO", 30, 40 + i * 40), word(String(i + 1), 80, 40 + i * 40),
    word("Enunciado.", 30, 55 + i * 40),
  ]).flat();
  words.push(word("Preencha o questionário de percepção sobre a prova localizado no final.", 30, 470));
  const questions = segmentQuestions([{ width: 600, height: 800, words }]);
  assert.equal(questions.length, 12);
});

test("shared passages are included with each referenced item instead of the preceding options", () => {
  const lines = [
    ["QUESTÃO", "1"], ["Texto da primeira."],
    ["Texto para questões 2 e 3"], ["Passagem comum."],
    ["QUESTÃO", "2"], ["Enunciado dois."],
    ["QUESTÃO", "3"], ["Enunciado três."],
  ];
  const words = lines.flatMap((tokens, index) => {
    let x = 30;
    return tokens.map((text) => { const w = word(text, x, 40 + index * 30); x = w.xMax + 4; return w; });
  });
  const questions = segmentQuestions([{ width: 600, height: 800, words }]);
  assert.equal(questions.length, 3);
  assert.ok(!questions[0].lines.some((l) => l.text.includes("Passagem comum")));
  for (const question of questions.slice(1)) {
    assert.equal(question.sharedContext, true);
    assert.ok(question.lines.some((l) => l.text === "Passagem comum."));
  }
});

test("OCR TSV preserves coordinates and confidence and never yields a clean draft", () => {
  const tsv = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n" +
    "5\t1\t1\t1\t1\t1\t100\t200\t80\t40\t93.5\tTeste\n" +
    "5\t1\t1\t1\t1\t2\tNaN\t200\t10\t10\t90\tinválido\n";
  const page = parseOcrTsv(tsv, 600, 800, 200);
  assert.equal(page.words.length, 1);
  assert.deepEqual(page.words[0], { text: "Teste", xMin: 36, yMin: 72,
    xMax: 64.8, yMax: 86.39999999999999, ocrConfidence: 93.5 });
  const item = classifyOne([line("Enunciado."), ...options].map((l) => ({ ...l, ocr: true })));
  assert.equal(item.status, "revisao-manual");
  assert.ok(item.flags.includes("revisao-ocr"));
});

test("PND keys are selected by matching type and missing keys cannot fall back to type 1", () => {
  const base = { kind: "ANSWER_KEY", family: "PND", year: 2025, modality: "LICENCIATURA" };
  const documents = [{ ...base, id: "gb1", variant: "Gabarito tipo 1" },
    { ...base, id: "gb4", variant: "Gabarito tipo 4" }];
  const exam = { id: "pv4", family: "PND", year: 2025, modality: "LICENCIATURA", variant: "Prova tipo 4" };
  assert.equal(selectAnswerKey(documents, exam)?.id, "gb4");
  assert.equal(selectAnswerKey(documents.slice(0, 1), exam), null);
  assert.equal(selectAnswerKey(documents, { ...exam, variant: null }), null);
  assert.throws(() => selectAnswerKey([...documents, documents[1]], exam), /mais de um gabarito/);
});

test("four-option exams use their explicit alphabet without accepting a missing fifth option in ENADE", () => {
  const lines = [line("Enunciado."), ...options.slice(0, 4)];
  assert.equal(splitOptions(lines).options, null);
  assert.equal(splitOptions(lines, "ABCD").options?.length, 4);
});

test("restored option letters come from PDF glyphs and do not delete adjoining OCR words", () => {
  const marker = { ...word("A", 30), xMax: 42, yMax: 95 };
  const circle = { ...word("O", 31), ocrConfidence: 60 };
  const adjoining = { ...word("OTexto", 31), ocrConfidence: 60 };
  const ocr = { width: 600, height: 800, words: [circle, adjoining] };
  const restored = restorePdfOptionMarkers(ocr, { ...ocr, words: [marker] });
  assert.deepEqual(restored.words.map((w) => w.text), ["OTexto", "A"]);
  assert.equal(restored.words[1].pdfOptionMarker, true);
  assert.deepEqual(restorePdfOptionMarkers(ocr, { ...ocr, words: [] }).words, ocr.words);
});
