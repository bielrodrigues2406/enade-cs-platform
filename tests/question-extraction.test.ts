import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classify,
  completeness,
  cropBoxes,
  detectGraphics,
  isOptionMarker,
  joinParagraphs,
  lineText,
  mergeLigatures,
  pageBands,
  parseAnswerKey,
  parseBboxHtml,
  segmentQuestions,
  splitOptions,
  textFlags,
} from "../scripts/lib/question-extraction.mjs";

type Word = {
  text: string;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
};
// Palavra de corpo de texto: 12 pt de altura, largura proporcional.
const w = (
  text: string,
  x: number,
  y: number,
  width = text.length * 6,
): Word => ({
  text,
  xMin: x,
  yMin: y,
  xMax: x + width,
  yMax: y + 12,
});
// Letra de alternativa: caixa quase quadrada da fonte de símbolos.
const marker = (letter: string, x: number, y: number): Word => ({
  text: letter,
  xMin: x,
  yMin: y,
  xMax: x + 12,
  yMax: y + 11.6,
});
const page = (words: Word[]) => ({ width: 560, height: 800, words });
const sentence = (text: string, x: number, y: number) => {
  let cursor = x;
  return text.split(" ").map((t) => {
    const word = w(t, cursor, y);
    cursor = word.xMax + 3;
    return word;
  });
};
const chrome = (n: number): Word[] => [
  w("*R02202101*", 30, 20),
  w(String(n), 30, 760, 10),
  w("CIÊNCIA", 200, 760),
  w("DA", 250, 760),
  w("COMPUTAÇÃO", 270, 760),
];

test("bbox HTML is decoded and typographic ligature characters are expanded", () => {
  const [p] = parseBboxHtml(
    '<page width="100" height="200"><word xMin="1" yMin="2" xMax="3" yMax="4">reﬂexos &amp; P&#39;s</word></page>',
  );
  assert.equal(p.width, 100);
  assert.deepEqual(p.words[0], {
    text: "reflexos & P's",
    xMin: 1,
    yMin: 2,
    xMax: 3,
    yMax: 4,
  });
});

test("option markers are told apart from a sentence starting with A", () => {
  assert.equal(isOptionMarker(marker("A", 30, 100)), true);
  assert.equal(isOptionMarker(w("A", 30, 100)), false);
  assert.equal(isOptionMarker(marker("F", 30, 100)), false);
});

test("split ligatures are joined and recorded; real spaces and new sentences stay apart", () => {
  const { words, joins } = mergeLigatures([
    w("afi", 0, 0),
    w("rma", 18.5, 0),
    w("profi", 50, 0),
    w("Rede", 83, 0),
    w("ti", 120, 0),
    w("mesmo", 140, 0),
  ]);
  assert.deepEqual(
    words.map((x) => x.text),
    ["afirma", "profi", "Rede", "ti", "mesmo"],
  );
  assert.deepEqual(joins, ["afi|rma"]);
  assert.equal(
    lineText([w("Project", 0, 0), w(",", 42.2, 0), w("do", 50, 0)]),
    "Project, do",
  );
});

test("page bands use barcode and the upper-case footer, not the same words in the text", () => {
  const bands = pageBands(
    page([
      ...chrome(3),
      w("QUESTÃO", 30, 77),
      w("computação", 100, 95),
      w("COMPUTAÇÃO", 30, 700),
    ]),
  );
  assert.ok(bands.top > 32 && bands.top < 77);
  assert.ok(bands.bottom < 760 && bands.bottom > 712);
});

test("questions are segmented across columns and pages and the perception survey ends the exam", () => {
  const first = page([
    ...chrome(1),
    w("QUESTÃO", 30, 80),
    w("01", 85, 80, 12),
    ...sentence("Enunciado da primeira questão.", 30, 100),
    marker("A", 30, 130),
    ...sentence("um", 46, 130),
    marker("B", 30, 150),
    ...sentence("dois", 46, 150),
    w("QUESTÃO", 300, 80),
    w("02", 355, 80, 12),
    ...sentence("Segunda questão começa.", 300, 100),
  ]);
  const second = page([
    ...chrome(2),
    ...sentence("Segunda questão continua.", 30, 80),
    ...Array.from({ length: 9 }, (_, i) => [
      w("QUESTÃO", 30, 120 + i * 60),
      w(String(i + 3), 85, 120 + i * 60, 12),
      ...sentence("Texto.", 30, 140 + i * 60),
    ]).flat(),
  ]);
  const survey = page([
    ...chrome(3),
    w("QUESTÃO", 30, 80),
    w("1", 85, 80, 6),
    ...sentence("Qual o grau de dificuldade?", 30, 100),
  ]);
  const qs = segmentQuestions([first, second, survey]);
  assert.deepEqual(
    qs.map((q) => q.key),
    ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10", "Q11"],
  );
  assert.deepEqual(
    qs[1].lines.map((l: { text: string }) => l.text),
    ["Segunda questão começa.", "Segunda questão continua."],
  );
  assert.deepEqual(
    qs[0].lines.map((l: { marker: string | null }) => l.marker),
    [null, "A", "B"],
  );
});

test("options require exactly A to E in order", () => {
  const line = (text: string, marker: string | null = null) => ({
    text,
    marker,
  });
  const ok = splitOptions([
    line("Enunciado"),
    ...["A", "B", "C", "D", "E"].map((l) => line(`${l} opção ${l}`, l)),
  ]);
  assert.equal(ok.options?.length, 5);
  assert.equal(ok.options?.[4].lines[0].text, "opção E");
  assert.equal(
    splitOptions([
      line("x"),
      line("A a", "A"),
      line("B b", "B"),
      line("D d", "D"),
    ]).options,
    null,
  );
});

test("paragraphs keep text blocks, references, PORQUE and the closing stem apart", () => {
  const l = (text: string, y: number, xMax = 530) => ({
    text,
    yMin: y,
    yMax: y + 12,
    xMax,
    page: 1,
  });
  const text = joinParagraphs([
    l("TEXTO I", 100, 80),
    l("Primeira linha do texto que", 114),
    l("continua aqui.", 128, 200),
    l("SILVA, J. Livro. 2020.", 142, 300),
    l("I. Primeira asserção", 156),
    l("termina aqui.", 170),
    l("PORQUE", 184, 300),
    l("II. Segunda asserção.", 198, 300),
    l("É correto o que se afirma em", 212, 300),
  ]);
  assert.deepEqual(text.split("\n"), [
    "TEXTO I",
    "Primeira linha do texto que continua aqui.",
    "SILVA, J. Livro. 2020.",
    "I. Primeira asserção termina aqui.",
    "PORQUE",
    "II. Segunda asserção.",
    "É correto o que se afirma em",
  ]);
});

test("answer keys of different layouts are read with annulled items", () => {
  const recent = parseAnswerKey(
    "GABARITO DEFINITIVO\nQUESTÃO DISCURSIVA 1 ***\nQUESTÃO 1 E\nQUESTÃO 29 ANULADA\n",
  );
  assert.equal(recent.definitive, true);
  assert.equal(recent.answers.get("Q1"), "E");
  assert.equal(recent.answers.get("Q29"), "ANULADA");
  assert.equal(recent.answers.get("D1"), "***");
  const old = parseAnswerKey("GABARITO\n 1- C\n 13 ANULADA\n 14 E\n");
  assert.equal(old.definitive, false);
  assert.equal(old.answers.get("Q1"), "C");
  assert.equal(old.answers.get("Q13"), "ANULADA");
});

test("text flags catch symbol mojibake, glyph-id text, code, figures and small caps", () => {
  assert.ok(textFlags("a ® Ø b").includes("caracteres-suspeitos"));
  assert.ok(textFlags("ĂƉĞŶĂƐ").includes("texto-ilegivel"));
  assert.ok(textFlags("int x = a[i];").includes("codigo"));
  assert.ok(
    !textFlags("listas, filas e pilhas; propício para lote").includes("codigo"),
  );
  assert.ok(textFlags("A figura a seguir").includes("mencao-a-figura"));
  assert.ok(textFlags("tEXtO").includes("versalete"));
  assert.ok(
    textFlags("TABAKMAN, R. a saúde na mídia").includes("referencia-versalete"),
  );
  assert.deepEqual(
    textFlags("Texto comum, sem nada especial.\nOutra linha."),
    [],
  );
});

test("graphics outside text boxes are found while text and thin rules are ignored", () => {
  const width = 200,
    height = 200,
    pixels = new Uint8Array(width * height).fill(255);
  const fill = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++)
      pixels.fill(0, y * width + x0, y * width + x1);
  };
  fill(10, 10, 60, 22); // texto (coberto por caixa de palavra)
  fill(10, 40, 190, 41); // régua fina
  for (const [x0, y0, x1, y1] of [
    [100, 100, 160, 101],
    [100, 140, 160, 141],
    [100, 100, 101, 141],
    [159, 100, 160, 141],
  ])
    fill(x0, y0, x1, y1); // retângulo de diagrama
  const found = detectGraphics(
    { width, height, pixels, scale: 1 },
    [{ text: "texto", xMin: 10, yMin: 10, xMax: 60, yMax: 22 }],
    { top: 0, bottom: 200 },
  );
  assert.deepEqual(found, [{ x0: 100, y0: 100, x1: 160, y1: 141 }]);
});

test("only a clean objective item with a definitive key becomes a draft", () => {
  const options = ["A", "B", "C", "D", "E"].map((l, i) => ({
    text: `${l} opção`,
    marker: l,
    yMin: 200 + i * 20,
    yMax: 212 + i * 20,
    xMax: 300,
    page: 1,
  }));
  const q = (
    key: string,
    number: number,
    lines = options,
    kind = "OBJECTIVE",
  ) => ({
    key,
    kind,
    number,
    lines: [
      { text: "Enunciado.", yMin: 100, yMax: 112, xMax: 300, page: 1 },
      ...lines,
    ],
    regions: [{ page: 1, x0: 0, x1: 560, y0: 90, y1: 400, lines: 6 }],
    joins: [],
  });
  const answers = new Map([
    ["Q1", "B"],
    ["Q9", "C"],
    ["Q10", "ANULADA"],
    ["Q11", "A"],
  ]);
  const items = classify(
    [
      q("Q1", 1),
      q("Q9", 9, options.slice(0, 4)),
      q("Q10", 10),
      q("Q11", 11),
      q("Q12", 12),
      q("D3", 3, [], "DISCURSIVE"),
    ],
    {
      answers,
      definitive: true,
      graphicsByPage: new Map([[2, [{ x0: 0, y0: 0, x1: 50, y1: 50 }]]]),
      symbolPages: new Set<number>(),
    },
  );
  assert.deepEqual(
    items.map((i: { key: string; status: string; block: string }) => [
      i.key,
      i.status,
      i.block,
    ]),
    [
      ["Q1", "rascunho", "FORMACAO_GERAL"],
      ["Q9", "revisao-manual", "COMPONENTE_ESPECIFICO"],
      ["Q10", "anulada", "COMPONENTE_ESPECIFICO"],
      ["Q11", "rascunho", "COMPONENTE_ESPECIFICO"],
      ["Q12", "sem-gabarito-definitivo", "COMPONENTE_ESPECIFICO"],
      ["D3", "discursiva", "COMPONENTE_ESPECIFICO"],
    ],
  );
  assert.deepEqual(
    items[0].options.map((o: { text: string }) => o.text),
    ["opção", "opção", "opção", "opção", "opção"],
  );
  const withFigure = classify([q("Q1", 1)], {
    answers,
    definitive: true,
    graphicsByPage: new Map([[1, [{ x0: 100, y0: 150, x1: 200, y1: 250 }]]]),
    symbolPages: new Set([1]),
  });
  assert.equal(withFigure[0].status, "revisao-manual");
  assert.deepEqual(withFigure[0].flags.sort(), ["figura", "fonte-de-simbolos"]);
  const notDefinitive = classify([q("Q1", 1)], {
    answers,
    definitive: false,
    graphicsByPage: new Map(),
    symbolPages: new Set<number>(),
  });
  assert.equal(notDefinitive[0].status, "sem-gabarito-definitivo");
  assert.deepEqual(
    completeness([{ key: "Q1" }, { key: "Q1" }, { key: "D1" }], answers),
    { missing: ["Q9", "Q10", "Q11"], unexpected: ["Q1"] },
  );
});

test("crop boxes skip block instructions, page frames and the scratch area", () => {
  const intro = sentence(
    "As questões de 11 a 40, a seguir, são específicas para os estudantes de Sistemas",
    40,
    60,
  );
  const sheet = page([
    ...chrome(1),
    ...intro,
    w("QUESTÃO", 30, 120),
    w("11", 85, 120, 12),
    ...sentence("Primeira parte do enunciado.", 30, 140),
    ...sentence("Continua na coluna da direita.", 300, 120),
    marker("A", 300, 150),
    ...sentence("certa", 316, 150),
    w("Área", 300, 200, 24),
    w("livre", 327, 200, 30),
    w("QUESTÃO", 300, 320),
    w("12", 355, 320, 12),
    ...sentence("Outra questão.", 300, 340),
  ]);
  const [q11] = segmentQuestions([sheet]);
  const figure = { x0: 40, y0: 170, x1: 200, y1: 260 };
  const frame = { x0: 10, y0: 30, x1: 550, y1: 750 };
  const boxes = cropBoxes(q11, [sheet], new Map([[1, [figure, frame]]]));
  assert.equal(boxes.length, 2);
  const [left, right] = boxes;
  // Coluna esquerda: do cabeçalho à figura, sem a moldura da página.
  assert.ok(left.y0 >= 114 && left.y1 <= 266 && left.x1 < 290, JSON.stringify(left));
  // Coluna direita: começa depois da instrução do bloco e para em "Área livre".
  assert.ok(right.y0 >= 72 && right.y0 <= 120, JSON.stringify(right));
  assert.ok(right.y1 < 200 && right.x0 >= 280, JSON.stringify(right));
});

