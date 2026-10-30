// Monta pacotes de conferência por agente (CNT-V1, ADR-010/011, D15).
// Cada pacote reúne, para um lote de objetivas de uma prova: recortes
// commitados, transcrição automática, letra lida do gabarito com o texto da
// página do gabarito, alertas do extrator e achados anteriores de outros
// agentes. O agente explicador e o agente conferente trabalham sobre o mesmo
// pacote; o resultado vai para data/agent-reviews/ (formato no README dessa
// pasta).
//
//   node scripts/review-packets.mjs --exam enade-2014-bacharelado-exam \
//     [--keys Q1-Q18] [--reports data/question-reports] \
//     [--directory enade-pdfs] [--out .local/review-packets]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const AREAS = [
  "Formação Geral", "Algoritmos", "Programação", "Teoria da computação", "Compiladores", "Matemática",
  "Arquitetura de computadores", "Sistemas operacionais", "Redes", "Sistemas distribuídos", "Banco de dados",
  "Engenharia de software", "Interação humano-computador", "Inteligência artificial", "Computação gráfica",
  "Segurança", "Sistemas de informação", "Sociedade e ética",
];

function options(argv) {
  const out = { reports: "data/question-reports", directory: "enade-pdfs", out: ".local/review-packets", keys: null };
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i].replace(/^--/, "");
    if (!["exam", "keys", "reports", "directory", "out"].includes(name) || !argv[i + 1])
      throw new Error("Uso: node scripts/review-packets.mjs --exam ID [--keys Q1-Q18] [--reports PASTA] [--directory PASTA] [--out PASTA]");
    out[name] = argv[i + 1];
  }
  if (!/^[a-z0-9-]{1,150}$/.test(out.exam ?? "")) throw new Error("Informe --exam com o ID do catálogo.");
  return out;
}

const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const opts = options(process.argv.slice(2));
const catalog = json("data/official-sources.json").documents;
const exam = catalog.find((d) => d.id === opts.exam && d.kind === "EXAM");
if (!exam) throw new Error(`${opts.exam}: prova fora do catálogo.`);
const pdf = (doc) => path.resolve(opts.directory, String(doc.year), `${doc.id}.pdf`);
const manifestFile = `data/question-crop-manifests/${exam.id}.json`;
const manifestBytes = readFileSync(manifestFile);
const manifest = JSON.parse(manifestBytes);
const report = json(path.join(opts.reports, `${exam.id}.json`));
if (manifest.examSha256 !== exam.sha256 || report.document !== exam.id)
  throw new Error("Relatório, manifesto e catálogo não são da mesma prova.");

const [from, to] = opts.keys ? opts.keys.replace(/Q/g, "").split("-").map(Number) : [1, 1000];
const crops = new Map(manifest.items.map((i) => [i.key, i]));
const earlier = [];
for (const file of ["data/question-reviews", "data/agent-reviews"].flatMap((dir) =>
  existsSync(dir) ? execFileSync("ls", [dir]).toString().trim().split("\n").filter((f) => f.endsWith(".json")).map((f) => `${dir}/${f}`) : []))
  earlier.push({ file, data: json(file) });

const keyPages = new Map();
const keyText = (doc, page) => {
  const id = `${doc.id}#${page}`;
  if (!keyPages.has(id))
    keyPages.set(id, execFileSync("pdftotext", ["-layout", "-f", String(page), "-l", String(page), pdf(doc), "-"]).toString());
  return keyPages.get(id);
};

const items = [];
for (const item of report.items) {
  if (item.kind !== "OBJECTIVE" || item.number < from || item.number > to) continue;
  const crop = crops.get(item.key);
  const fragments = (crop?.fragments ?? []).map((f) => {
    const file = path.resolve("data/question-crops", exam.id, f.file);
    if (!existsSync(file)) return null;
    if (createHash("sha256").update(readFileSync(file)).digest("hex") !== f.sha256)
      throw new Error(`${item.key}: ${f.file} difere do manifesto.`);
    return { file, sha256: f.sha256, page: f.page };
  });
  if (!fragments.length || fragments.includes(null)) continue; // fora do escopo commitado
  const keyDoc = catalog.find((d) => d.id === item.source?.answerKeyId);
  const previous = earlier.flatMap(({ file, data }) => (data.items ?? [])
    .filter((p) => p.key === item.key && (p.examId ?? data.document) === exam.id)
    .map((p) => ({ file, verdict: p.verdict, issues: p.issues, notes: p.notes ?? p.reason, explanation: p.explanation })));
  items.push({
    key: item.key, number: item.number, block: item.block, status: item.status,
    answerFromKey: item.answer, answerKeyPage: item.source?.answerKeyPage ?? 1,
    flags: item.flags ?? [], cropWarnings: crop.warnings ?? [], fragments,
    prompt: item.prompt ?? "", options: item.options ?? [],
    examPage: crop.fragments[0].page, previous,
    answerKeyPdf: keyDoc ? pdf(keyDoc) : null,
  });
}
const keyDoc = catalog.find((d) => d.id === report.items.find((i) => i.source?.answerKeyId)?.source.answerKeyId);
const packet = {
  document: exam.id, year: exam.year, modality: exam.modality, examSha256: exam.sha256,
  cropsManifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
  examPdf: pdf(exam), answerKey: keyDoc ? { id: keyDoc.id, pdf: pdf(keyDoc),
    pages: [...new Set(items.map((i) => i.answerKeyPage))].map((page) => ({ page, text: keyText(keyDoc, page) })) } : null,
  areas: AREAS, items,
};
mkdirSync(opts.out, { recursive: true });
const name = `${exam.id}-q${items[0]?.number ?? from}-q${items.at(-1)?.number ?? to}.json`;
writeFileSync(path.join(opts.out, name), JSON.stringify(packet, null, 2));
console.log(`${path.join(opts.out, name)}: ${items.length} objetivas.`);
