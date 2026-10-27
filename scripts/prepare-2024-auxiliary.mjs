// Prepara trechos de uma compilação conhecida para a fila privada de análise.
// Não baixa arquivos, não altera o PDF de entrada e não escreve no banco.
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  classify, completeness, detectGraphics, groupLines, lineText, pageBands,
  parseBboxHtml, parsePgm, segmentQuestions,
} from "./lib/question-extraction.mjs";

const run = promisify(execFile);
const repository = fileURLToPath(new URL("../", import.meta.url));
const upstream = {
  url: "https://raw.githubusercontent.com/ClaraFontenele/ENADE/0776b146a714f2e9537bccb5a521dfc5d8c16a97/Enade_ProvasAntigas_24_21_17_14.pdf",
  sha256: "5eb5a42a38c332b2a35c147cc9a3e17e1c940b465f217f135d84672ce8b0d4e8",
  gitBlob: "0e61fae7ca50a7f3fb65346737366a327c42677e",
  byteSize: 14637580,
  pageCount: 185,
};
const examId = "aux-enade-2024-computacao-pv-1";
const keyId = "aux-enade-2024-computacao-gb-1";
const variant = "Prova tipo 1";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const limits = { timeout: 30000, maxBuffer: 64 * 1024 * 1024 };

function options(argv) {
  const output = {
    file: resolve(repository, ".local/recent-sources-audit/Clara-enade-compilacao.pdf"),
    output: resolve(repository, ".local/import-review/auxiliary"),
  };
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i], value = argv[i + 1];
    if (!["--file", "--output"].includes(name) || !value || value.startsWith("--") || seen.has(name))
      throw new Error("Argumentos inválidos. Use --help.");
    seen.add(name);
    output[name.slice(2)] = resolve(value);
  }
  return output;
}

async function atomicWrite(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function pdfMetadata(path) {
  const bytes = await readFile(path);
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Arquivo sem assinatura PDF.");
  const { stdout } = await run("pdfinfo", [path], limits);
  const pageCount = Number(/^Pages:\s+(\d+)$/m.exec(stdout)?.[1]);
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error("Número de páginas inválido.");
  return { sha256: sha256(bytes), byteSize: bytes.length, pageCount };
}

// pdfunite cria um /ID aleatório no trailer. Substituir somente esse campo,
// depois da tabela xref, mantém os offsets e permite repetir os mesmos bytes.
// O arquivo de entrada permanece intacto; falhar em vez de editar outro campo.
export function stableDerivative(bytes, pages) {
  const raw = bytes.toString("latin1");
  const at = raw.lastIndexOf("trailer");
  const start = raw.lastIndexOf("startxref");
  if (at < 0 || at >= start) throw new Error("Trailer PDF não reconhecido; derivado não aceito.");
  const trailer = raw.slice(at, start);
  const string = String.raw`(?:\((?:\\[\s\S]|[^\\()])*\)|<[0-9a-fA-F\s]+>)`;
  const id = new RegExp(String.raw`/ID\s*\[\s*${string}\s+${string}\s*\]`, "g");
  const matches = [...trailer.matchAll(id)];
  if (matches.length !== 1) throw new Error("Identificador do trailer não reconhecido.");
  const stable = sha256(`${upstream.sha256}:${pages[0]}-${pages[1]}`).slice(0, 32);
  const replacement = trailer.replace(id, `/ID [<${stable}> <${stable}>]`);
  return Buffer.from(raw.slice(0, at) + replacement + raw.slice(start), "latin1");
}

// O gabarito0401 usa linhas de sete números seguidas por sete respostas.
// A numeração e a anulação conhecidas protegem contra associação de outro tipo.
export function parse2024Grid(text) {
  if (!/Gabarito\s+Definitivo/i.test(text)) throw new Error("Título de gabarito definitivo ausente.");
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const answers = new Map();
  for (let i = 0; i < lines.length; i++) {
    const numbers = lines[i].split(/\s+/);
    if (numbers.length !== 7 || numbers.some((n) => !/^\d{1,2}$/.test(n))) continue;
    const values = (lines[++i] ?? "").split(/\s+/);
    if (values.length !== 7 || values.some((a) => !/^[A-D*]$/.test(a)))
      throw new Error("Tabela de gabarito incompleta ou ilegível.");
    numbers.forEach((n, index) => {
      const key = `Q${Number(n)}`;
      if (answers.has(key)) throw new Error("Número de gabarito repetido.");
      answers.set(key, values[index] === "*" ? "ANULADA" : values[index]);
    });
  }
  if (answers.size !== 63 || Array.from({ length: 63 }, (_, i) => `Q${i + 1}`).some((k) => !answers.has(k)) ||
    answers.get("Q15") !== "ANULADA" || [...answers].some(([k, a]) => a === "ANULADA" && k !== "Q15"))
    throw new Error("O trecho não corresponde ao gabarito 0401 esperado (63 itens, Q15 anulada).");
  return answers;
}

async function derive(input, work, pages, name) {
  const pattern = join(work, `${name}-%d.pdf`);
  await run("pdfseparate", ["-f", String(pages[0]), "-l", String(pages[1]), input, pattern], limits);
  const separate = Array.from({ length: pages[1] - pages[0] + 1 }, (_, i) => join(work, `${name}-${pages[0] + i}.pdf`));
  const output = join(work, name + ".pdf");
  await run("pdfunite", [...separate, output], limits);
  await writeFile(output, stableDerivative(await readFile(output), pages));
  const metadata = await pdfMetadata(output);
  if (metadata.pageCount !== pages[1] - pages[0] + 1 || metadata.byteSize > 10 * 1024 * 1024)
    throw new Error("Derivado com páginas incorretas ou acima de 10 MiB.");
  return { path: output, ...metadata };
}

async function graphicalEvidence(path, pages, work) {
  const graphicsByPage = new Map(), symbolPages = new Set();
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index], number = index + 1;
    if (!page.words.length) continue;
    const prefix = join(work, `render-${number}`);
    await run("pdftoppm", ["-gray", "-r", "100", "-f", String(number), "-l", String(number), "-singlefile", path, prefix], limits);
    const pgm = prefix + ".pgm";
    const image = parsePgm(await readFile(pgm));
    graphicsByPage.set(number, detectGraphics({ ...image, scale: 100 / 72 }, page.words, page.extractionBands ?? pageBands(page)));
    await rm(pgm);
    const { stdout } = await run("pdffonts", ["-f", String(number), "-l", String(number), path], limits);
    if (stdout.split("\n").slice(2).some((line) => /symbol|euclid|math|mt ?extra|cambria|wingding|dingbat|zapf/i.test(line.split(/\s+/)[0])))
      symbolPages.add(number);
  }
  return { graphicsByPage, symbolPages };
}

// Neste trecho o nome do curso aparece também como letras espaçadas, seguido
// pela linha de impressão InDesign. O corte usa as coordenadas dessas linhas
// conhecidas no rodapé, sem remover menções ao curso no texto das questões.
function questionPage(page, number) {
  if ([1, 21, 43, 44].includes(number)) return { ...page, words: [] };
  const bands = pageBands(page);
  const footers = groupLines(page.words).filter((line) => {
    if (line.yMin < page.height * 0.86) return false;
    const text = lineText(line.words);
    return /\.indb\b/.test(text) || /^\d{0,2}COMPUTAÇÃO\d{0,2}$/.test(text.replace(/\s/g, ""));
  });
  const bottom = Math.min(bands.bottom, ...footers.map((line) => line.yMin - 0.5));
  return { ...page, words: page.words.filter((word) => word.yMax <= bottom), extractionBands: { ...bands, bottom } };
}

function catalogDocument(id, kind, metadata, pages, tools) {
  return {
    id, family: "ENADE_LICENCIATURAS", year: 2024, area: "Computação", modality: "LICENCIATURA", kind,
    title: kind === "EXAM" ? "Compilação auxiliar · trecho da prova de 2024 · caderno 0401" : "Compilação auxiliar · trecho do gabarito de 2024 · caderno 0401",
    officialPageUrl: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enade-das-licenciaturas/provas-e-gabaritos/2024",
    officialUrl: kind === "EXAM" ? "https://download.inep.gov.br/enade/provas_e_gabaritos/2024_Computacao_PV_1.pdf" : "https://download.inep.gov.br/enade/provas_e_gabaritos/2024_Computacao_GB_1_a_10.pdf",
    sha256: metadata.sha256, byteSize: metadata.byteSize, pageCount: metadata.pageCount, variant,
    acquisitionMethod: "LOCAL", status: "DERIVED_AUXILIARY", auxiliary: true, reviewed: false, originalBytesAvailable: false,
    derivation: {
      upstreamUrl: upstream.url, upstreamSha256: upstream.sha256, upstreamGitBlob: upstream.gitBlob,
      upstreamByteSize: upstream.byteSize, upstreamPageCount: upstream.pageCount, upstreamPages: pages,
      tools, stableTrailerId: "SHA-256(upstreamSha256 + ':' + primeiraPagina + '-' + ultimaPagina), primeiros 32 hex; somente /ID do trailer do derivado.",
    },
  };
}

export async function prepare2024(opts) {
  const info = await stat(opts.file);
  if (!info.isFile() || info.size !== upstream.byteSize)
    throw new Error("A compilação diverge do tamanho esperado. Nenhum trecho foi preparado.");
  const input = await readFile(opts.file);
  if (input.length !== upstream.byteSize || sha256(input) !== upstream.sha256)
    throw new Error("A compilação diverge do SHA-256/tamanho esperado. Nenhum trecho foi preparado.");
  const work = await mkdtemp(join(tmpdir(), "enade-2024-aux-"));
  try {
    // Todos os subprocessos leem esta cópia dos bytes já validados, mesmo se
    // outro processo substituir o caminho de entrada durante a preparação.
    const snapshot = join(work, "upstream.pdf");
    await writeFile(snapshot, input, { flag: "wx" });
    const metadata = await pdfMetadata(snapshot);
    if (metadata.pageCount !== upstream.pageCount) throw new Error("A compilação não contém 185 páginas.");
    const tools = {};
    for (const tool of ["pdfseparate", "pdfunite"]) {
      const { stdout, stderr } = await run(tool, ["-v"], limits);
      tools[tool] = (stdout || stderr).split(/\r?\n/)[0];
    }
    const exam = await derive(snapshot, work, [1, 44], "exam");
    const key = await derive(snapshot, work, [45, 45], "key");
    const documents = [catalogDocument(examId, "EXAM", exam, [1, 44], tools), catalogDocument(keyId, "ANSWER_KEY", key, [45, 45], tools)];
    const { stdout: keyText } = await run("pdftotext", ["-layout", key.path, "-"], limits);
    const answers = parse2024Grid(keyText);
    const { stdout: bbox } = await run("pdftotext", ["-bbox", exam.path, "-"], limits);
    // As páginas continuam no PDF de44p e mantêm sua numeração. Só omitir
    // da segmentação capa, rascunho, questionário e contracapa conhecidos.
    const pages = parseBboxHtml(bbox).map((page, i) => questionPage(page, i + 1));
    const questions = segmentQuestions(pages, { unnumberedDiscursive: true });
    const evidence = await graphicalEvidence(exam.path, pages, work);
    const items = classify(questions, {
      answers, definitive: true, ...evidence, generalObjectiveThrough: 27,
      generalDiscursiveThrough: 0, expectedOptionLetters: "ABCD", keyAvailable: true,
    }).map((item) => ({
      ...item,
      status: ["anulada", "discursiva"].includes(item.status) ? item.status : "revisao-manual",
      flags: [...new Set([...item.flags, "fonte-auxiliar-derivada", "conferencia-manual",
        ...(item.kind === "DISCURSIVE" ? ["padrao-resposta-ausente"] : [])])],
      source: {
        examId, examSha256: exam.sha256, answerKeyId: keyId, answerKeySha256: key.sha256,
        answerKeyDefinitive: true, answerKeyPage: 1, answerKeyVariant: variant,
      },
    }));
    const check = completeness(items, answers);
    if (!items.some((item) => item.key === "D1")) check.missing.push("D1");
    for (const item of items)
      if (item.kind === "DISCURSIVE" && item.key !== "D1" && !check.unexpected.includes(item.key)) check.unexpected.push(item.key);
    const warnings = [
      "Trechos derivados de compilação modificada por terceiro; os bytes dos originais do Inep não estão disponíveis.",
      "Toda questão permanece em HOLD na fila privada; aprovação humana e promoção para questão oficial estão bloqueadas para esta fonte auxiliar.",
      "A capa delimita FG com objetivas 1–27 e CE com objetivas 28–63 e discursiva. D1 é identificador técnico da discursiva sem número impresso.",
      "A detecção de figuras/código é heurística; comparar todos os enunciados, alternativas, símbolos e figuras com as páginas antes de qualquer uso editorial.",
    ];
    const manifest = { schemaVersion: 1, scope: "Fontes auxiliares derivadas: fora do inventário de PDFs originais; não substituem aquisições ou revisão humana.", documents };
    const report = {
      document: examId, completeness: check,
      extraction: { method: "PDF_TEXT_DERIVED_AUXILIARY", origin: "ASSISTED_CODEX", humanReviewed: false, originalBytesAvailable: false,
        footerPolicy: "Rodapés de curso e linhas de impressão InDesign conhecidos recortados por coordenadas; capa, rascunho, percepção e contracapa fora da segmentação.",
        derivation: documents[0].derivation },
      warnings, items,
    };
    const folder = join(opts.output, "2024");
    await atomicWrite(join(folder, examId + ".pdf"), await readFile(exam.path));
    await atomicWrite(join(folder, keyId + ".pdf"), await readFile(key.path));
    await atomicWrite(join(opts.output, examId + ".questions.json"), JSON.stringify(report, null, 2) + "\n");
    await atomicWrite(join(opts.output, "auxiliary-sources.json"), JSON.stringify(manifest, null, 2) + "\n");
    await atomicWrite(join(repository, "data/auxiliary-sources.json"), JSON.stringify(manifest, null, 2) + "\n");
    await atomicWrite(join(opts.output, examId + ".report.md"), [
      "# Trecho auxiliar · ENADE 2024 · caderno 0401", "", ...warnings.map((w) => `- ${w}`), "",
      `Identificadas: ${items.length}. Ausentes: ${check.missing.join(", ") || "nenhuma"}. Inesperadas: ${check.unexpected.join(", ") || "nenhuma"}.`, "",
      "| Questão | Bloco | Páginas do trecho | Gabarito | Pendências |", "| --- | --- | --- | --- | --- |",
      ...items.map((i) => `| ${i.key} | ${i.block} | ${i.pages.join(", ")} | ${i.answer ?? "—"} | ${i.flags.join(", ")} |`), "",
    ].join("\n"));
    return { document: examId, items: items.length, objective: items.filter((i) => i.kind === "OBJECTIVE").length,
      discursive: items.filter((i) => i.kind === "DISCURSIVE").length, completeness: check,
      documents: documents.map((d) => ({ id: d.id, sha256: d.sha256, byteSize: d.byteSize, pageCount: d.pageCount, file: join(folder, d.id + ".pdf") })),
      report: join(opts.output, examId + ".questions.json") };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 3 && process.argv[2] === "--help") {
    console.log("Uso: node scripts/prepare-2024-auxiliary.mjs [--file COMPILACAO_LOCAL.pdf] [--output PASTA]\nValida o hash da compilação conhecida, prepara prova/gabarito derivados e relatório privado. Sem rede ou banco. Atualiza data/auxiliary-sources.json, preservando o catálogo oficial.");
  } else {
    try { console.log(JSON.stringify(await prepare2024(options(process.argv.slice(2))), null, 2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
