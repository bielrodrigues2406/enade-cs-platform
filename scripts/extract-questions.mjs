// Gera um relatório de extração das questões de provas oficiais já baixadas
// (ver download-sources.mjs). Não grava no banco e não publica nada: cada
// questão sai classificada para conferência humana. Ver docs/OFFICIAL-SOURCES.md.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  classify,
  annotatePdfOptionFonts,
  completeness,
  detectGraphics,
  parseAnswerKey,
  parseBboxHtml,
  pageBands,
  parsePgm,
  parseOcrTsv,
  selectAnswerKey,
  restorePdfOptionMarkers,
  segmentQuestions,
} from "./lib/question-extraction.mjs";

const run = promisify(execFile);
const RENDER_DPI = 100;
// Fontes de símbolos matemáticos/lógicos cujo texto extraído não é confiável.
// BundesbahnPi desenha as letras das alternativas; C39 é o código de barras.
const SYMBOL_FONT =
  /symbol|euclid|math|mt ?extra|cambria|wingding|dingbat|zapf/i;
const IGNORED_FONT = /bundesbahn|c39/i;

function options(argv) {
  const out = {
    directory: "enade-pdfs",
    output: ".local/question-drafts",
    ids: [],
    ocr: false,
    ocrDpi: 200,
    tessdata: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const [name, value] = [argv[i], argv[i + 1]];
    if (name === "--ocr") { out.ocr = true; continue; }
    if (!value || value.startsWith("--")) throw new Error(`${name}: valor ausente.`);
    if (name === "--directory") out.directory = value;
    else if (name === "--output") out.output = value;
    else if (name === "--id") out.ids.push(...value.split(","));
    else if (name === "--tessdata-dir") out.tessdata = resolve(value);
    else if (name === "--ocr-dpi") out.ocrDpi = Number(value);
    else throw new Error(`Opção desconhecida: ${name}`);
    i++;
  }
  if (!out.ids.length)
    throw new Error(
      "Uso: node scripts/extract-questions.mjs --id enade-2021-bacharelado-exam [--directory enade-pdfs] [--output .local/question-drafts]",
    );
  if (!Number.isInteger(out.ocrDpi) || out.ocrDpi < 150 || out.ocrDpi > 400)
    throw new Error("--ocr-dpi deve ser inteiro de 150 a 400.");
  if (out.ocr && !out.tessdata)
    throw new Error("--ocr exige --tessdata-dir com por.traineddata local.");
  return out;
}

const CC = "Ciência da Computação";
const EC = "Engenharia de Computação";
const SI = "Sistemas de Informação";
const LC = "Licenciatura em Computação";

// Intervalos impressos nas instruções dos próprios cadernos compartilhados.
function historicalFormat(doc) {
  if (doc.year === 2005) return {
    generalObjectiveThrough: 7, generalDiscursiveThrough: 10, sharedBooklet: true,
    expectedDiscursive: [8, 9, 10, 39, 40, 55, 70, 85].map((n) => `Q${n}`),
    courseScopeFor: (q) => q.number <= 10 ? [CC, EC, SI] :
      q.number <= 40 ? [SI] : q.number <= 55 ? [CC, EC] : q.number <= 70 ? [CC] : [EC],
  };
  if (doc.year === 2008) return {
    generalObjectiveThrough: 8, generalDiscursiveThrough: 10, sharedBooklet: true,
    expectedDiscursive: [9, 10, 20, 39, 40, 59, 60, 79, 80].map((n) => `Q${n}`),
    courseScopeFor: (q) => q.number <= 20 ? [CC, EC, SI] :
      q.number <= 40 ? [CC] : q.number <= 60 ? [EC] : [SI],
  };
  if (doc.year === 2011) return {
    sharedBooklet: true, expectedDiscursive: [1, 2, 3, 4, 5].map((n) => `D${n}`),
    courseScopeFor: (q) => q.kind === "DISCURSIVE" || q.number <= 30 ? [CC, EC, SI, LC] :
      q.number <= 35 ? [LC] : q.number <= 40 ? [CC] : q.number <= 45 ? [EC] : [SI],
  };
  if (doc.year >= 2014 && doc.year <= 2021) return {
    expectedDiscursive: [1, 2, 3, 4, 5].map((n) => `D${n}`),
  };
  if (doc.id === "pnd-2025-computacao-pv-4" && doc.family === "PND") return {
    generalObjectiveThrough: 30, generalDiscursiveThrough: 1,
    expectedDiscursive: ["D1"], expectedOptionLetters: "ABCD",
    unnumberedDiscursive: true, courseScopeFor: () => [LC],
  };
  throw new Error(`${doc.id}: estrutura da edição ainda não definida; não usar o formato histórico por aproximação.`);
}

async function ocrPages(path, nativePages, work, opts) {
  const model = await readFile(join(opts.tessdata, "por.traineddata"));
  const modelSha256 = createHash("sha256").update(model).digest("hex");
  const { stdout: version, stderr: versionErr } = await run("tesseract", ["--version"]);
  const engine = (version || versionErr).split("\n")[0];
  const pages = new Array(nativePages.length);
  let next = 0;
  // OCR é CPU-bound; limite explícito evita um processo/thread por página.
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < nativePages.length) {
      const index = next++, number = index + 1;
      const image = join(work, `ocr-${number}`);
      await run("pdftoppm", ["-png", "-r", String(opts.ocrDpi), "-f", String(number),
        "-l", String(number), "-singlefile", path, image], { maxBuffer: 1024 * 1024 });
      const { stdout: tsv } = await run("tesseract", [image + ".png", "stdout",
        "--tessdata-dir", opts.tessdata, "-l", "por", "--psm", "3", "-c", "tessedit_create_tsv=1"], {
        env: { ...process.env, OMP_THREAD_LIMIT: "1" }, maxBuffer: 16 * 1024 * 1024,
      });
      if (!tsv.startsWith("level\tpage_num\t"))
        throw new Error(`OCR da página ${number} não produziu TSV válido.`);
      const native = nativePages[index];
      pages[index] = restorePdfOptionMarkers(
        parseOcrTsv(tsv, native.width, native.height, opts.ocrDpi), native);
      await rm(image + ".png");
      if (number % 8 === 0 || number === nativePages.length)
        console.error(`OCR: ${number}/${nativePages.length} páginas processadas.`);
    }
  }));
  return { pages, extraction: { method: "OCR", dpi: opts.ocrDpi, engine,
    language: "por", modelSha256, optionMarkers: "PDF_TEXT" } };
}

async function verified(doc, directory) {
  const path = resolve(directory, String(doc.year), `${doc.id}.pdf`);
  const bytes = await readFile(path);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== doc.sha256)
    throw new Error(`${doc.id}: SHA-256 diferente do catálogo; nada extraído.`);
  return path;
}

async function symbolPages(path, pageCount) {
  const pages = new Set();
  for (let p = 1; p <= pageCount; p++) {
    const { stdout } = await run("pdffonts", ["-f", p, "-l", p, path]);
    const fonts = stdout
      .split("\n")
      .slice(2)
      .map((l) => l.split(/\s+/)[0]);
    if (fonts.some((f) => SYMBOL_FONT.test(f) && !IGNORED_FONT.test(f)))
      pages.add(p);
  }
  return pages;
}

async function graphics(path, pages, work) {
  const byPage = new Map();
  const scale = RENDER_DPI / 72;
  for (let p = 1; p <= pages.length; p++) {
    const prefix = join(work, `page-${p}`);
    await run("pdftoppm", [
      "-gray",
      "-r",
      String(RENDER_DPI),
      "-f",
      String(p),
      "-l",
      String(p),
      "-singlefile",
      path,
      prefix,
    ]);
    const image = parsePgm(await readFile(prefix + ".pgm"));
    const page = pages[p - 1];
    byPage.set(
      p,
      detectGraphics({ ...image, scale }, page.words, pageBands(page)),
    );
  }
  return byPage;
}

function markdown(doc, items, check) {
  const count = (fn) => items.filter(fn).length;
  const statuses = [
    "rascunho",
    "revisao-manual",
    "discursiva",
    "anulada",
    "sem-gabarito-definitivo",
  ];
  const lines = [
    `# ${doc.title}`,
    "",
    `Fonte: ${doc.officialUrl} · SHA-256 ${doc.sha256}`,
    "",
    "Extração automática para conferência. Nada foi publicado. Compare cada item com a página original antes de criar o rascunho.",
    "",
    check.missing.length || check.unexpected.length
      ? `**Extração incompleta.** Ausentes em relação ao gabarito: ${check.missing.join(", ") || "nenhum"}. Inesperados ou repetidos: ${check.unexpected.join(", ") || "nenhum"}. Nenhum item desta prova deve virar rascunho até a conferência da numeração.`
      : "Numeração completa segundo a distribuição do caderno e o gabarito disponível.",
    "",
    "| Situação | Questões |",
    "| --- | ---: |",
    ...statuses.map((s) => `| ${s} | ${count((i) => i.status === s)} |`),
    "",
    "| Questão | Bloco | Páginas | Situação | Gabarito | Alertas |",
    "| --- | --- | --- | --- | --- | --- |",
    ...items.map(
      (i) =>
        `| ${i.key} | ${i.block === "FORMACAO_GERAL" ? "FG" : "Específico"} | ${i.pages.join(", ")} | ${i.status} | ${i.answer ?? "—"} | ${i.flags.join(", ") || "—"} |`,
    ),
    "",
  ];
  return lines.join("\n");
}

async function extract(catalog, id, opts) {
  const doc = catalog.documents.find((d) => d.id === id);
  if (!doc || doc.kind !== "EXAM")
    throw new Error(`${id}: prova não encontrada no catálogo.`);
  const format = historicalFormat(doc);
  const keyDoc = selectAnswerKey(catalog.documents, doc);
  const examPath = await verified(doc, opts.directory);
  const keyAvailable = !!keyDoc?.sha256;
  const keyPath = keyAvailable ? await verified(keyDoc, opts.directory) : null;
  const work = await mkdtemp(join(tmpdir(), "enade-extract-"));
  try {
    const { stdout: html } = await run("pdftotext", ["-bbox", examPath, "-"], {
      maxBuffer: 64 * 1024 * 1024,
    });
    let nativePages = parseBboxHtml(html);
    let optionFonts = null;
    if (doc.year <= 2011 && !opts.ocr) {
      const { stdout: xml } = await run("pdftohtml", ["-xml", "-i", "-hidden", "-stdout", examPath], {
        timeout: 30000, maxBuffer: 64 * 1024 * 1024,
      });
      const annotated = annotatePdfOptionFonts(nativePages, xml, format.expectedOptionLetters ?? "ABCDE");
      nativePages = annotated.pages;
      optionFonts = { fonts: annotated.fonts, markers: annotated.markers, unmatched: annotated.unmatched };
    }
    const { pages, extraction } = opts.ocr ? await ocrPages(examPath, nativePages, work, opts) :
      { pages: nativePages, extraction: { method: "PDF_TEXT", ...(optionFonts ? { optionFonts } : {}) } };
    const keyText = keyPath ? (await run("pdftotext", ["-layout", keyPath, "-"])).stdout : "";
    const { answers, definitive } = parseAnswerKey(keyText);
    const keyPages = new Map();
    keyText.split("\f").forEach((page, index) => {
      for (const [key, answer] of parseAnswerKey(page).answers)
        if (answers.get(key) === answer) keyPages.set(key, index + 1);
    });
    const questions = segmentQuestions(pages, format);
    // Gabaritos de 2008 explicitam "Discursiva" na mesma numeração Qn.
    for (const question of questions)
      if (answers.get(question.key) === "DISCURSIVA") question.kind = "DISCURSIVE";
    const items = classify(questions, {
      answers,
      definitive,
      graphicsByPage: await graphics(examPath, nativePages, work),
      symbolPages: await symbolPages(examPath, pages.length),
      keyAvailable,
      ...format,
    }).map((item) => ({
      ...item,
      source: {
        examId: doc.id,
        examSha256: doc.sha256,
        answerKeyId: keyAvailable ? keyDoc.id : null,
        answerKeySha256: keyAvailable ? keyDoc.sha256 : null,
        answerKeyDefinitive: definitive,
        ...(keyPages.has(item.key) ? { answerKeyPage: keyPages.get(item.key) } : {}),
      },
    }));
    const lastObjective = doc.year === 2005 ? 85 : doc.year === 2008 ? 80 :
      doc.year === 2011 ? 50 : doc.family === "PND" ? 80 : 35;
    const coverage = new Map(answers);
    for (let number = 1; number <= lastObjective; number++)
      if (!format.expectedDiscursive.includes(`Q${number}`) && !coverage.has(`Q${number}`))
        coverage.set(`Q${number}`, null);
    const check = completeness(items, coverage);
    // O gabarito de múltipla escolha omite discursivas: conferir também a
    // distribuição declarada pelo caderno, sem criar itens vazios ausentes.
    for (const key of format.expectedDiscursive)
      if (!items.some((i) => i.key === key) && !check.missing.includes(key)) check.missing.push(key);
    for (const item of items)
      if (item.kind === "DISCURSIVE" && !format.expectedDiscursive.includes(item.key) &&
        !check.unexpected.includes(item.key)) check.unexpected.push(item.key);
    const warnings = [
      ...(optionFonts ? ["Marcadores das edições antigas foram comparados ao XML de fontes do próprio PDF; alternativas e reconstruções de layout continuam exigindo conferência visual."] : []),
      ...(opts.ocr ? ["OCR exige confronto de cada item com a página renderizada, inclusive alternativas, símbolos e figuras."] : []),
      ...(doc.year < 2014 ? ["Caderno compartilhado: os blocos de outros cursos foram preservados com courseScope e não são automaticamente questões de Ciência da Computação."] : []),
      ...(!definitive ? ["O gabarito não se declara definitivo; confirmação documental pendente."] : []),
      ...(!keyAvailable ? ["Gabarito correspondente não disponível: nenhuma resposta inferida ou substituída por outro tipo de prova."] : []),
      ...(format.unnumberedDiscursive ? ["D1 é identificador técnico da única discursiva sem número impresso (*** na capa), não uma numeração atribuída pelo Inep."] : []),
    ];
    // Numeração incompleta compromete a segmentação de todas as questões.
    if (check.missing.length || check.unexpected.length)
      for (const item of items)
        if (item.status === "rascunho") {
          item.status = "revisao-manual";
          item.flags.push("prova-incompleta");
        }
    await mkdir(opts.output, { recursive: true });
    await writeFile(
      join(opts.output, `${id}.questions.json`),
      JSON.stringify(
        { document: doc.id, completeness: check, extraction, warnings, items },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      join(opts.output, `${id}.report.md`),
      markdown(doc, items, check),
    );
    return { items, check };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

const opts = options(process.argv.slice(2));
const catalog = JSON.parse(
  await readFile(new URL("../data/official-sources.json", import.meta.url)),
);
let failed = false;
for (const id of opts.ids) {
  try {
    const { items, check } = await extract(catalog, id, opts);
    const by = (s) => items.filter((i) => i.status === s).length;
    if (check.missing.length || check.unexpected.length) failed = true;
    console.log(
      `${id}: ${items.length} questões${check.missing.length || check.unexpected.length ? ` (INCOMPLETA: faltam ${check.missing.join(",") || "—"}; inesperadas ${check.unexpected.join(",") || "—"})` : ""} · rascunho ${by("rascunho")} · revisão manual ${by("revisao-manual")} · discursivas ${by("discursiva")} · anuladas ${by("anulada")} · sem gabarito definitivo ${by("sem-gabarito-definitivo")}`,
    );
  } catch (err) {
    failed = true;
    console.error(err instanceof Error ? err.message : String(err));
  }
}
if (failed) process.exitCode = 1;
