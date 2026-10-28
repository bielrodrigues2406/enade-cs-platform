import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertCalibriTextDocument, assertTextCopyGeometry, CALIBRI_MAP_SHA256,
  CALIBRI_PYPDF_VERSION, CALIBRI_TEXT_ALGORITHM, createDerivedQuestionText,
  validateTextCopyReceipt } from "../scripts/lib/derived-question-text.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const expected = { originalFileName: "original.pdf", originalSha256: "1".repeat(64),
  outputFileName: "copy.pdf", outputSha256: "2".repeat(64), generatorSha256: "3".repeat(64) };
const receipt = () => ({ schemaVersion: 1, algorithm: CALIBRI_TEXT_ALGORITHM,
  generatorSha256: expected.generatorSha256, pypdfVersion: CALIBRI_PYPDF_VERSION,
  derivedFrom: { file: expected.originalFileName, sha256: expected.originalSha256 },
  map: { file: "calibri-cid-unicode.json", sha256: CALIBRI_MAP_SHA256 },
  output: { file: expected.outputFileName, sha256: expected.outputSha256 },
  fixedFonts: ["ABCDEF+Calibri", "ABCDEF+Calibri-Bold"],
  tool: `scripts/repair-calibri-text.py com pypdf ${CALIBRI_PYPDF_VERSION}`,
  purpose: "Somente extração de texto; imagem e procedência vêm do PDF original." });

test("derived text receipts bind source, output, map and generator rather than trusting a self-reported hash", () => {
  assert.deepEqual(validateTextCopyReceipt(receipt(), expected), receipt());
  for (const field of ["derivedFrom", "map", "output"]) {
    const value = receipt(); value[field].sha256 = "4".repeat(64);
    assert.throws(() => validateTextCopyReceipt(value, expected), /não corresponde/);
  }
  const changed = receipt(); changed.generatorSha256 = "5".repeat(64);
  assert.throws(() => validateTextCopyReceipt(changed, expected), /incompatíveis/);
  const path = receipt(); path.output.file = "../copy.pdf";
  assert.throws(() => validateTextCopyReceipt(path, expected), /não corresponde/);
  const extra = { ...receipt(), humanReviewed: true };
  assert.throws(() => validateTextCopyReceipt(extra, expected), /inválido/);
});

test("unsupported algorithm, pypdf version, fonts and incomplete receipts fail closed", () => {
  for (const change of [{ algorithm: "ARBITRARY_REWRITE" }, { pypdfVersion: "0.0.0" },
    { fixedFonts: [] }, { fixedFonts: ["Symbol"] }, { fixedFonts: ["Calibri", "Calibri"] },
    { fixedFonts: Array(33).fill("Calibri") }, { purpose: "Approved" }, { schemaVersion: 2 }]) {
    assert.throws(() => validateTextCopyReceipt({ ...receipt(), ...change }, expected));
  }
  const missing = receipt(); delete missing.map;
  assert.throws(() => validateTextCopyReceipt(missing, expected));
});

test("derived text cannot reorder or resize pages or operate outside the four supported exams", () => {
  const pages = [{ width: 600, height: 800 }, { width: 620, height: 840 }];
  assert.doesNotThrow(() => assertTextCopyGeometry(pages, structuredClone(pages)));
  for (const derived of [[], pages.slice(1), [...pages].reverse(),
    [{ width: 600, height: 799 }, pages[1]], [{ width: NaN, height: 800 }, pages[1]],
    [null, pages[1]]]) assert.throws(() => assertTextCopyGeometry(pages, derived), /geometria/);
  assert.throws(() => assertTextCopyGeometry([], []), /geometria/);
  const document = { id: "enade-2014-bacharelado-exam", kind: "EXAM", year: 2014, sha256: expected.originalSha256 };
  assert.doesNotThrow(() => assertCalibriTextDocument(document));
  for (const change of [{ year: 2017 }, { kind: "ANSWER_KEY" }, { id: "enade-2021-bacharelado-exam" },
    { id: "arbitrary-2014-exam" }, { sha256: "invalid" }])
    assert.throws(() => assertCalibriTextDocument({ ...document, ...change }), /quatro provas/);
});

// Synthetic bytes test orchestration and failure boundaries, not PDF repair.
// Real-source reproduction is an explicit local verification of the CLI.
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "enade-derived-test-"));
  const originalPath = join(directory, "original.pdf"), workDirectory = join(directory, "private");
  await mkdir(workDirectory);
  const original = Buffer.from("%PDF-TEST ONLY original bytes\n");
  await writeFile(originalPath, original);
  const document = { id: "enade-2014-bacharelado-exam", kind: "EXAM", year: 2014, sha256: hash(original) };
  const args = { document, originalPath, workDirectory, python: "test-python" };
  const runner = async (python, command, limits) => {
    assert.equal(python, "test-python"); assert.equal(command[0], "-I");
    assert.equal(command[2], "repair"); assert.equal(command[3], "--map");
    assert.equal(command[5], originalPath); assert.equal(limits.timeout, 30000);
    const output = command[6], bytes = Buffer.from("%PDF-TEST ONLY derived bytes\n");
    const value = receipt();
    value.derivedFrom = { file: basename(originalPath), sha256: document.sha256 };
    value.output = { file: basename(output), sha256: hash(bytes) };
    value.generatorSha256 = hash(await readFile(command[1]));
    await writeFile(output, bytes, { flag: "wx" });
    await writeFile(`${output}.json`, JSON.stringify(value), { flag: "wx" });
  };
  return { directory, original, args, runner };
}

test("the trusted generator runs in a private destination and preserves a stable path-free receipt", async () => {
  const f = await fixture();
  try {
    const result = await createDerivedQuestionText(f.args, f.runner);
    assert.equal(result.receipt.derivedFrom.sha256, f.args.document.sha256);
    assert.equal(result.receipt.output.file, `${f.args.document.id}.pdf`);
    assert.ok(!JSON.stringify(result.receipt).includes(f.directory));
    assert.deepEqual(await readFile(f.args.originalPath), f.original);
    const otherWork = join(f.directory, "another-private-directory");
    await mkdir(otherWork);
    const repeated = await createDerivedQuestionText({ ...f.args, workDirectory: otherWork }, f.runner);
    assert.deepEqual(repeated.receipt, result.receipt);
    await assert.rejects(createDerivedQuestionText(f.args, f.runner), /já existe/);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("mismatched or changed originals, wrong receipts and non-regular output never produce accepted text", async () => {
  const f = await fixture();
  try {
    await assert.rejects(createDerivedQuestionText({ ...f.args,
      document: { ...f.args.document, sha256: expected.originalSha256 } }, f.runner), /original/);
    await assert.rejects(createDerivedQuestionText(f.args, async (...args) => {
      await f.runner(...args); const file = args[1][6];
      const value = JSON.parse(await readFile(`${file}.json`, "utf8"));
      value.derivedFrom.sha256 = "0".repeat(64);
      await writeFile(`${file}.json`, JSON.stringify(value));
    }), /não corresponde/);
    const output = join(f.args.workDirectory, `${f.args.document.id}.pdf`);
    await rm(output); await rm(`${output}.json`);
    await assert.rejects(createDerivedQuestionText(f.args, async (...args) => {
      await f.runner(...args); await writeFile(f.args.originalPath, "%PDF-TEST ONLY changed original");
    }), /original mudou/);
    await writeFile(f.args.originalPath, f.original);
    await rm(output); await rm(`${output}.json`);
    await assert.rejects(createDerivedQuestionText(f.args, async (...args) => {
      await symlink(f.args.originalPath, args[1][6]);
    }), /não regular/);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("CLI rejects incompatible modes and unsupported exams before opening PDFs", async () => {
  const cli = promisify(execFile);
  for (const options of [
    ["--id", "enade-2014-bacharelado-exam", "--repair-calibri", "--ocr"],
    ["--id", "enade-2021-bacharelado-exam", "--repair-calibri"],
    ["--id", "enade-2014-bacharelado-exam", "--python", "python3"],
  ]) await assert.rejects(cli(process.execPath, ["scripts/extract-questions.mjs", ...options]),
    (error) => /não pode ser combinado|quatro provas|exige --repair-calibri/.test(error.stderr));
});
