import { test } from "node:test";
import assert from "node:assert/strict";
import { annotatePdfOptionFonts, classify, completeness, isOptionMarker, lineHeader, parseAnswerKey, parseOcrTsv,
  restorePdfOptionMarkers, segmentQuestions, selectAnswerKey, splitColumns, splitOptions } from "../scripts/lib/question-extraction.mjs";

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

// Font XML and coordinates are synthetic, including names chosen to ensure the
// font's name alone cannot grant marker status. No official content is copied.
const fontFixture = (extra = "", letters = "ABCDE", groups = 3) => {
  const markers = Array.from({ length: groups }, (_, group) => [...letters].map((letter, i) => ({
    ...word(letter, 30, 100 + group * 120 + i * 18), xMax: 38, yMax: 113 + group * 120 + i * 18,
  }))).flat();
  const prose = { ...word("A", 30, 60), xMax: 39 };
  const texts = markers.map((w) => `<text top="${w.yMin}" left="30" width="8" height="13" font="1">${w.text}</text>`).join("");
  return { pages: [{ width: 600, height: 800, words: [prose, ...markers] }],
    xml: `<pdf2xml><page number="1" width="600" height="800"><fontspec id="0" family="Circled-Letters" size="10"/><fontspec id="1" family="OpaqueFont" size="10"/><text top="60" left="30" width="9" height="10" font="0">A</text><text top="30" left="30" width="300" height="10" font="0">${"Texto comum. ".repeat(30)}</text>${texts}${extra}</page></pdf2xml>` };
};

test("dedicated PDF fonts recover real glyphs without accepting a normal sentence A", () => {
  const fixture = fontFixture();
  const found = annotatePdfOptionFonts(fixture.pages, fixture.xml);
  assert.deepEqual(found.fonts.map((font) => font.family), ["OpaqueFont"]);
  assert.equal(found.markers, 15);
  assert.equal(found.unmatched, 0);
  assert.equal(isOptionMarker(fixture.pages[0].words[0]), true);
  assert.equal(isOptionMarker(found.pages[0].words[0]), false);
  assert.equal(isOptionMarker(found.pages[0].words[1]), true);
  assert.ok(found.pages[0].words[1].xMax - found.pages[0].words[1].xMin <
    0.7 * (found.pages[0].words[1].yMax - found.pages[0].words[1].yMin));
});

test("mixed font text, incomplete alphabets and isolated diagram labels cannot prove option fonts", () => {
  const mixed = fontFixture('<text top="20" left="20" width="90" height="10" font="1">Texto misto.</text>');
  for (const fixture of [mixed, fontFixture("", "ABCD"), fontFixture("", "ABCDE", 1)]) {
    const found = annotatePdfOptionFonts(fixture.pages, fixture.xml);
    assert.deepEqual(found.fonts, []);
    assert.equal(found.markers, 0);
    assert.equal(isOptionMarker(found.pages[0].words[1]), false);
  }
});

test("small diagram fonts and ambiguous or incompatible coordinates cannot restore markers", () => {
  const fixture = fontFixture();
  const tiny = fixture.xml.replace('family="OpaqueFont" size="10"', 'family="OpaqueFont" size="5"');
  assert.equal(annotatePdfOptionFonts(fixture.pages, tiny).markers, 0);
  const shifted = fixture.xml.replaceAll('left="30" width="8"', 'left="200" width="8"');
  assert.throws(() => annotatePdfOptionFonts(fixture.pages, shifted), /nenhuma posição/);
  const duplicate = fixture.xml.replace('</page>', '<text top="100" left="30" width="8" height="13" font="1">A</text></page>');
  const found = annotatePdfOptionFonts(fixture.pages, duplicate);
  assert.equal(found.pages[0].words[1].pdfOptionFontMarker, false);
  assert.equal(found.unmatched, 2);
  assert.throws(() => annotatePdfOptionFonts([...fixture.pages, fixture.pages[0]], fixture.xml), /cobertura/);
});

test("font XML text boxes may include trailing spaces without changing the PDF letters", () => {
  const fixture = fontFixture();
  const spaced = fixture.xml.replaceAll('width="8" height="13" font="1">', 'width="18" height="13" font="1">').replaceAll('</text>', '   </text>');
  assert.equal(annotatePdfOptionFonts(fixture.pages, spaced).markers, 15);
});

const provenWord = (text: string, x: number, y: number, marker = false) => ({
  ...word(text, x, y), pdfOptionFontChecked: true, pdfOptionFontMarker: marker,
});
const provenLine = (words: ReturnType<typeof provenWord>[]) => ({
  words, text: words.map((w) => w.text).join(" "), page: 1,
  columnXMin: 0, columnXMax: 600, yMin: Math.min(...words.map((w) => w.yMin)),
  yMax: Math.max(...words.map((w) => w.yMax)), xMax: Math.max(...words.map((w) => w.xMax)),
  marker: isOptionMarker(words[0]) ? words[0].text : null,
});

test("horizontal alternatives retain each actual PDF letter and its own text", () => {
  const row = provenLine([..."ABCDE"].flatMap((letter, i) => [
    provenWord(letter, 30 + i * 100, 140, true), provenWord(`Texto${letter}`, 45 + i * 100, 140),
  ]));
  const split = splitOptions([provenLine([provenWord("Enunciado.", 30, 100)]), row]);
  assert.equal(split.reconstructed, true);
  assert.deepEqual(split.options?.map((o) => [o.letter, o.lines.map((l) => l.text).join(" ")]),
    [..."ABCDE"].map((letter) => [letter, `Texto${letter}`]));
  const item = classifyOne([provenLine([provenWord("Enunciado.", 30, 100)]), row]);
  assert.ok(item.flags.includes("alternativas-reconstruidas-layout"));
  assert.equal(item.status, "revisao-manual");
});

test("two-column and two-row choice grids preserve their printed alphabet and continuations", () => {
  const layout = (rows: string[][]) => rows.map((letters, index) => provenLine(letters.flatMap((letter, column) => [
    provenWord(letter, 30 + column * 130, 140 + index * 25, true),
    provenWord(`Texto${letter}`, 45 + column * 130, 140 + index * 25),
  ])));
  for (const rows of [[['A', 'D'], ['B', 'E'], ['C']], [['A', 'B', 'C'], ['D', 'E']]]) {
    const split = splitOptions([provenLine([provenWord("Enunciado.", 30, 100)]), ...layout(rows)]);
    assert.equal(split.reconstructed, true);
    assert.deepEqual(split.options?.map((o) => [o.letter, o.lines.map((l) => l.text).join(" ")]),
      [..."ABCDE"].map((letter) => [letter, `Texto${letter}`]));
  }
});

test("ambiguous groups, OCR letters and crossing grid text remain unstructured", () => {
  const row = provenLine([..."ABCDE"].flatMap((letter, i) => [
    provenWord(letter, 30 + i * 100, 140, true), provenWord(`Texto${letter}`, 45 + i * 100, 140),
  ]));
  const stem = provenLine([provenWord("Enunciado.", 30, 100)]);
  assert.equal(splitOptions([stem, row, { ...row, yMin: 180, yMax: 190 }]).options, null);
  assert.equal(splitOptions([stem, { ...row, ocr: true,
    words: row.words.map((w) => ({ ...w, ocrConfidence: 99 })) }]).options, null);
  assert.equal(splitOptions([stem, { ...row, words: row.words.map((w, i) => i === 1 ?
    { ...w, text: "Texto longo", xMax: 150 } : w) }]).options, null);
  assert.equal(splitOptions([stem, { ...row, page: 2 }]).options?.length, 5);
  assert.equal(splitOptions([stem, row, { ...provenLine([provenWord("Continuação.", 30, 200)]), page: 2 }]).options, null);
});

test("legacy gutters keep right-column prefixes out of the left question", () => {
  const words = [
    provenWord("QUESTÃO", 36, 70), provenWord("1", 80, 70),
    provenWord("QUESTÃO", 297, 70), provenWord("2", 345, 70),
    provenWord("Texto-esquerdo", 36, 100), provenWord("fim.", 258, 100),
    provenWord("Texto-direito", 292, 100),
    ...[..."ABCDE"].flatMap((letter, i) => [provenWord(letter, 292, 140 + i * 25, true),
      provenWord(`Escolha${letter}`, 307, 140 + i * 25)]),
  ];
  const columns = splitColumns({ width: 600, height: 800, words }, words);
  assert.equal(columns.length, 2);
  assert.ok(columns[0].x1 < 292);
  assert.ok(!columns[0].words.some((w) => w.xMin === 292));
  assert.equal(columns.flatMap((c) => c.words).length, words.length);
  const questions = segmentQuestions([{ width: 600, height: 800, words }]);
  assert.equal(questions.length, 2);
  assert.ok(!questions[0].lines.some((l) => l.text.includes("Escolha")));
  assert.equal(splitOptions(questions[1].lines).options?.length, 5);
});
