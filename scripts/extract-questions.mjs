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
  completeness,
  detectGraphics,
  parseAnswerKey,
  parseBboxHtml,
  pageBands,
  parsePgm,
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
  };
  for (let i = 0; i < argv.length; i++) {
    const [name, value] = [argv[i], argv[i + 1]];
    if (name === "--directory") out.directory = value;
    else if (name === "--output") out.output = value;
    else if (name === "--id") out.ids.push(...value.split(","));
    else throw new Error(`Opção desconhecida: ${name}`);
    i++;
  }
  if (!out.ids.length)
    throw new Error(
      "Uso: node scripts/extract-questions.mjs --id enade-2021-bacharelado-exam [--directory enade-pdfs] [--output .local/question-drafts]",
    );
  return out;
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
      : "Numeração completa em relação ao gabarito.",
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
  // O critério de bloco (FG = 2 discursivas + 8 objetivas) vale a partir de 2014.
  if (doc.year < 2014)
    throw new Error(
      `${id}: cadernos anteriores a 2014 misturam cursos e numeração; extrair manualmente.`,
    );
  const keyDoc = catalog.documents.find(
    (d) =>
      d.kind === "ANSWER_KEY" &&
      d.year === doc.year &&
      d.modality === doc.modality &&
      d.family === doc.family,
  );
  if (!keyDoc) throw new Error(`${id}: gabarito não catalogado.`);
  const examPath = await verified(doc, opts.directory);
  const keyPath = await verified(keyDoc, opts.directory);
  const work = await mkdtemp(join(tmpdir(), "enade-extract-"));
  try {
    const { stdout: html } = await run("pdftotext", ["-bbox", examPath, "-"], {
      maxBuffer: 64 * 1024 * 1024,
    });
    const pages = parseBboxHtml(html);
    const { stdout: keyText } = await run("pdftotext", [
      "-layout",
      keyPath,
      "-",
    ]);
    const { answers, definitive } = parseAnswerKey(keyText);
    const items = classify(segmentQuestions(pages), {
      answers,
      definitive,
      graphicsByPage: await graphics(examPath, pages, work),
      symbolPages: await symbolPages(examPath, pages.length),
    }).map((item) => ({
      ...item,
      source: {
        examId: doc.id,
        examSha256: doc.sha256,
        answerKeyId: keyDoc.id,
        answerKeySha256: keyDoc.sha256,
        answerKeyDefinitive: definitive,
      },
    }));
    const check = completeness(items, answers);
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
        { document: doc.id, completeness: check, items },
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
