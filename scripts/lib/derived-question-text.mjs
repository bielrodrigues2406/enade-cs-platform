// A cópia é gerada localmente por código/mapa do repositório; recibos enviados
// junto a PDFs arbitrários não são uma fronteira de confiança.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const CALIBRI_TEXT_ALGORITHM = "CALIBRI_TOUNICODE_V1";
export const CALIBRI_MAP_SHA256 = "f20d49d5a2c2f9a768d8139f7b37d36a13118744158433c3afce42a1bb5f8f05";
export const CALIBRI_PYPDF_VERSION = "6.10.0";
const repository = fileURLToPath(new URL("../../", import.meta.url));
const run = promisify(execFile);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const SHA = /^[a-f0-9]{64}$/;
const supported = new Set([2014, 2017].flatMap((year) =>
  ["bacharelado", "licenciatura"].map((mode) => `enade-${year}-${mode}-exam`)));

function requireObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key)))
    throw new Error("Recibo de cópia de texto inválido.");
  return value;
}

function fileHash(value, expectedName, expectedHash) {
  const entry = requireObject(value, ["file", "sha256"]);
  if (typeof entry.file !== "string" || entry.file !== basename(entry.file) ||
    !entry.file || entry.file.length > 200 || !SHA.test(entry.sha256) ||
    entry.file !== expectedName || entry.sha256 !== expectedHash)
    throw new Error("O recibo não corresponde aos arquivos da cópia de texto.");
}

/** Valida vínculos do recibo produzido pelo subprocesso local. Isto não
 * transforma o texto em transcrição conferida nem o derivado em fonte oficial. */
export function validateTextCopyReceipt(value, expected) {
  const receipt = requireObject(value, ["schemaVersion", "algorithm", "generatorSha256",
    "pypdfVersion", "derivedFrom", "map", "output", "fixedFonts", "tool", "purpose"]);
  if (receipt.schemaVersion !== 1 || receipt.algorithm !== CALIBRI_TEXT_ALGORITHM ||
    receipt.pypdfVersion !== CALIBRI_PYPDF_VERSION ||
    !SHA.test(receipt.generatorSha256) || receipt.generatorSha256 !== expected.generatorSha256 ||
    !Array.isArray(receipt.fixedFonts) || receipt.fixedFonts.length < 1 || receipt.fixedFonts.length > 32 ||
    receipt.fixedFonts.some((font) => typeof font !== "string" || !font || font.length > 200 ||
      !/(?:^|\+)Calibri/.test(font)) ||
    new Set(receipt.fixedFonts).size !== receipt.fixedFonts.length ||
    receipt.tool !== `scripts/repair-calibri-text.py com pypdf ${CALIBRI_PYPDF_VERSION}` ||
    receipt.purpose !== "Somente extração de texto; imagem e procedência vêm do PDF original.")
    throw new Error("Algoritmo, ferramenta ou fontes da cópia de texto incompatíveis.");
  fileHash(receipt.derivedFrom, expected.originalFileName, expected.originalSha256);
  fileHash(receipt.map, "calibri-cid-unicode.json", CALIBRI_MAP_SHA256);
  fileHash(receipt.output, expected.outputFileName, expected.outputSha256);
  return receipt;
}

export function assertTextCopyGeometry(originalPages, derivedPages) {
  if (!Array.isArray(originalPages) || originalPages.length < 1 ||
    !Array.isArray(derivedPages) || derivedPages.length !== originalPages.length ||
    originalPages.some((page, index) => !page || !derivedPages[index] || ["width", "height"].some((side) =>
      !Number.isFinite(page[side]) || page[side] <= 0 ||
      !Number.isFinite(derivedPages[index][side]) ||
      Math.abs(page[side] - derivedPages[index][side]) > 0.01)))
    throw new Error("A geometria da cópia de texto não corresponde ao PDF original.");
}

export function assertCalibriTextDocument(document) {
  const year = /^enade-(2014|2017)-/.exec(document?.id ?? "")?.[1];
  if (document?.kind !== "EXAM" || !supported.has(document.id) ||
    document.year !== Number(year) || !SHA.test(document.sha256 ?? ""))
    throw new Error("--repair-calibri aceita somente as quatro provas catalogadas de 2014/2017.");
}

async function boundedFile(path, limit) {
  const info = await lstat(path);
  if (!info.isFile() || info.size < 1 || info.size > limit)
    throw new Error("Arquivo da cópia de texto ausente, não regular ou acima do limite.");
  const bytes = await readFile(path);
  if (bytes.length !== info.size || bytes.length > limit)
    throw new Error("O arquivo da cópia de texto mudou durante a leitura.");
  return bytes;
}

/** A única entrada editável pelo usuário é o executável Python do seu ambiente
 * administrativo. O script, mapa e caminho da cópia não vêm de um recibo. */
export async function createDerivedQuestionText({ document, originalPath, workDirectory,
  python = "python3" }, runner = run) {
  assertCalibriTextDocument(document);
  const original = await boundedFile(originalPath, 10 * 1024 * 1024);
  if (!original.subarray(0, 5).equals(Buffer.from("%PDF-")) || sha256(original) !== document.sha256)
    throw new Error("O PDF original da cópia de texto não corresponde ao catálogo.");
  const script = join(repository, "scripts/repair-calibri-text.py");
  const map = join(repository, "data/calibri-cid-unicode.json");
  const generatorSha256 = sha256(await boundedFile(script, 128 * 1024));
  if (sha256(await boundedFile(map, 128 * 1024)) !== CALIBRI_MAP_SHA256)
    throw new Error("O mapa Unicode da Calibri diverge da versão conferida.");
  const output = join(workDirectory, `${document.id}.pdf`);
  if (resolve(output) === resolve(originalPath))
    throw new Error("A cópia de texto não pode sobrescrever o PDF original.");
  for (const path of [output, `${output}.json`]) {
    try { await lstat(path); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    throw new Error("O destino da cópia de texto já existe.");
  }
  try {
    await runner(python, ["-I", script, "repair", "--map", map, originalPath, output], {
      timeout: 30000, maxBuffer: 1024 * 1024,
    });
  } catch {
    throw new Error(`Não foi possível gerar a cópia de texto. Confira Python com pypdf ${CALIBRI_PYPDF_VERSION}, os arquivos e o limite de 30 segundos.`);
  }
  const derived = await boundedFile(output, 20 * 1024 * 1024);
  if (!derived.subarray(0, 5).equals(Buffer.from("%PDF-")))
    throw new Error("O gerador não produziu uma cópia de texto PDF.");
  const receiptBytes = await boundedFile(`${output}.json`, 64 * 1024);
  let raw;
  try { raw = JSON.parse(receiptBytes.toString("utf8")); }
  catch { throw new Error("O gerador não produziu um recibo JSON válido."); }
  const receipt = validateTextCopyReceipt(raw, {
    originalFileName: basename(originalPath), originalSha256: document.sha256,
    outputFileName: basename(output), outputSha256: sha256(derived), generatorSha256,
  });
  // A geração nunca muda os bytes do original; detectar também uma troca local
  // durante o subprocesso antes de aceitar a evidência extraída.
  if (sha256(await boundedFile(originalPath, 10 * 1024 * 1024)) !== document.sha256)
    throw new Error("O PDF original mudou durante a geração da cópia de texto.");
  return { path: output, receipt };
}
