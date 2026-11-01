// Prepara as discursivas de uma prova oficial para conferência (DISC-2): copia
// os recortes do enunciado já gerados para as objetivas, recorta o padrão de
// resposta do Inep e lê os itens de avaliação. Não grava no banco nem publica.
//   node scripts/extract-discursives.mjs <id da prova> [números]
// Ex.: node scripts/extract-discursives.mjs enade-2014-bacharelado-exam
//      node scripts/extract-discursives.mjs enade-2005-comum-exam 8,9,10,39,40
// Saída: .local/discursive-work/<prova>/ (WebP) e <prova>.json (manifesto).
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { parseBboxHtml, parsePgm } from "./lib/question-extraction.mjs";
import { matchStandards, parseCriteria, standardBlocks } from "./lib/response-standard.mjs";

const run = promisify(execFile);
const DPI = 200;
/** Faixas de tinta separadas por mais que isto (pt) são blocos distintos. */
const GAP = 12;
const PAD = 6;
const OUT = ".local/discursive-work";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function pdfPages(file) {
  const { stdout } = await run("pdftotext", ["-bbox", file, "-"], { maxBuffer: 64 * 1024 * 1024, timeout: 60000 });
  return parseBboxHtml(stdout);
}

/** Página em tons de cinza a 72 dpi (1 px = 1 pt), para medir onde há tinta. */
async function grayPage(pdf, page, work) {
  const prefix = path.join(work, `ink-${page}`);
  await run("pdftoppm", ["-gray", "-r", "72", "-f", String(page), "-l", String(page), "-singlefile", pdf, prefix]);
  return parsePgm(await readFile(`${prefix}.pgm`));
}
const dark = (image, x, y) => image.pixels[y * image.width + x] < 200;

/** Linhas (y) com tinta entre x0 e x1. */
function inkRows(image, box) {
  const rows = [];
  for (let y = Math.max(0, Math.floor(box.y0)); y < Math.min(image.height, Math.ceil(box.y1)); y++)
    for (let x = Math.max(0, Math.floor(box.x0)); x < Math.min(image.width, Math.ceil(box.x1)); x++)
      if (dark(image, x, y)) { rows.push(y); break; }
  return rows;
}

/** Primeira e última coluna com tinta entre y0 e y1, na página inteira (figuras passam da margem do texto). */
function inkColumns(image, y0, y1) {
  let first = image.width, last = -1;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(image.height, Math.ceil(y1)); y++)
    for (let x = 0; x < image.width; x++)
      if (dark(image, x, y)) { first = Math.min(first, x); last = Math.max(last, x); }
  return last < 0 ? null : [first, last];
}

/** Agrupa linhas com tinta em faixas verticais [início, fim]. */
function inkBands(rows) {
  const bands = [];
  for (const y of rows) {
    const last = bands.at(-1);
    if (last && y - last[1] <= GAP) last[1] = y;
    else bands.push([y, y]);
  }
  return bands;
}

/**
 * Ajusta as caixas do padrão de resposta pela tinta da página: tira o branco
 * no fim e, quando o bloco termina antes do próximo padrão, descarta a figura
 * sem texto colada no fim (algumas edições repetem o enunciado como imagem).
 */
async function refineStandard(pdf, boxes, pages, work) {
  const refined = [];
  for (const [index, box] of boxes.entries()) {
    const image = await grayPage(pdf, box.page, work);
    let bands = inkBands(inkRows(image, box));
    const words = pages[box.page - 1].words;
    const hasText = ([a, b]) => words.some((w) => w.yMin >= a - 2 && w.yMax <= b + 2 && w.xMin >= box.x0 && w.xMax <= box.x1);
    // Logotipos de cabeçalho e rodapé são imagem: caem como faixa sem texto nas margens.
    const height = pages[box.page - 1].height;
    bands = bands.filter((band) => hasText(band) || (band[0] > height * 0.08 && band[1] < height * 0.9));
    const last = index === boxes.length - 1;
    while (last && bands.length && !hasText(bands.at(-1))) bands = bands.slice(0, -1);
    if (!bands.length) continue;
    const y0 = Math.max(box.y0, bands[0][0] - PAD), y1 = Math.min(box.y1, bands.at(-1)[1] + PAD);
    const columns = inkColumns(image, y0, y1) ?? [box.x0, box.x1];
    const page = pages[box.page - 1];
    refined.push({ ...box, y0, y1,
      x0: Math.max(0, Math.min(box.x0, columns[0] - PAD)), x1: Math.min(page.width, Math.max(box.x1, columns[1] + PAD)) });
  }
  return refined;
}

/** Recorta uma caixa (em pontos) da página e grava WebP sem perda, sem metadados. */
async function renderBox(pdf, box, file, work) {
  const scale = DPI / 72;
  const px = (v) => Math.round(v * scale);
  const png = path.join(work, path.basename(file, ".webp"));
  await run("pdftoppm", ["-r", String(DPI), "-f", String(box.page), "-l", String(box.page),
    "-x", String(px(box.x0)), "-y", String(px(box.y0)),
    "-W", String(px(box.x1) - px(box.x0)), "-H", String(px(box.y1) - px(box.y0)),
    "-png", "-singlefile", pdf, png]);
  await run("convert", [`${png}.png`, "-strip", "-define", "webp:lossless=true", "-define", "webp:method=6", file]);
  await rm(`${png}.png`);
  return fragment(file, box);
}

async function fragment(file, box) {
  const bytes = await readFile(file);
  const { stdout } = await run("identify", ["-format", "%w %h", file]);
  const [width, height] = stdout.trim().split(" ").map(Number);
  const round = (v) => Math.round(v * 100) / 100;
  return {
    file: path.basename(file), page: box.page,
    box: { x0: round(box.x0), y0: round(box.y0), x1: round(box.x1), y1: round(box.y1) },
    width, height, byteSize: bytes.length, sha256: sha256(bytes),
  };
}

async function main() {
  const [examId, only] = process.argv.slice(2);
  if (!examId) throw new Error("Informe o id da prova, por exemplo enade-2014-bacharelado-exam.");
  const catalog = JSON.parse(await readFile("data/official-sources.json", "utf8")).documents;
  const byId = new Map(catalog.map((doc) => [doc.id, doc]));
  const exam = byId.get(examId) ?? (() => { throw new Error(`Prova fora do catálogo: ${examId}`); })();
  const standard = byId.get(examId.replace(/-exam$/, "-response-standard"))
    ?? (() => { throw new Error(`Sem padrão de resposta no catálogo para ${examId}`); })();
  const source = (doc) => path.join(".local/sources", `${doc.sha256}.pdf`);

  const drafts = JSON.parse(await readFile(`.local/canonical-drafts/${examId}.questions.json`, "utf8")).items;
  const crops = JSON.parse(await readFile(`data/question-crop-manifests/${examId}.json`, "utf8")).items;
  const wanted = only ? new Set(only.split(",").map(Number)) : null;
  const discursive = drafts.filter((item) => item.kind === "DISCURSIVE" && (!wanted || wanted.has(item.number)));
  if (!discursive.length) throw new Error("Nenhuma discursiva encontrada nesta prova.");

  const standardPages = await pdfPages(source(standard));
  const standardBoxes = matchStandards(standardBlocks(standardPages), discursive.map((item) => item.number));

  const directory = path.join(OUT, examId);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const work = await mkdtemp(path.join(tmpdir(), "enade-discursive-"));
  const items = [];
  try {
    for (const item of discursive) {
      const crop = crops.find((entry) => entry.key === item.key);
      const prompt = [];
      for (const [index, piece] of (crop?.fragments ?? []).entries()) {
        const file = path.join(directory, `D${item.number}-prompt-${index + 1}.webp`);
        await copyFile(path.join(".local/canonical-crops", examId, piece.file), file);
        const copied = await fragment(file, { page: piece.page, ...piece.box });
        if (copied.sha256 !== piece.sha256) throw new Error(`${item.key}: recorte do enunciado difere do manifesto.`);
        prompt.push(copied);
      }
      const standardFragments = [];
      const boxes = await refineStandard(source(standard), standardBoxes.get(item.number) ?? [], standardPages, work);
      for (const [index, box] of boxes.entries())
        standardFragments.push(await renderBox(source(standard),
          box, path.join(directory, `D${item.number}-standard-${index + 1}.webp`), work));
      items.push({
        key: item.key, number: item.number, block: item.block,
        criteria: parseCriteria(item.prompt ?? ""),
        prompt, standard: standardFragments,
        warnings: [
          ...(prompt.length ? [] : ["sem recorte do enunciado"]),
          ...(standardFragments.length ? [] : ["padrão de resposta não localizado"]),
        ],
      });
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  const manifest = {
    document: examId, examSha256: exam.sha256,
    standardDocument: standard.id, standardSha256: standard.sha256,
    renderer: { dpi: DPI, format: "image/webp", lossless: true }, items,
  };
  await writeFile(path.join(OUT, `${examId}.json`), JSON.stringify(manifest, null, 2) + "\n");
  for (const item of items)
    console.log(`D${item.number} (${item.block}): ${item.prompt.length} recorte(s) do enunciado, ` +
      `${item.standard.length} do padrão, itens ${JSON.stringify(item.criteria)}` +
      (item.warnings.length ? ` · ${item.warnings.join("; ")}` : ""));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
