// Carrega num banco novo (produção) o conteúdo publicado que está no
// repositório (DEP-2): baixa a prova e o gabarito de cada conferência em
// data/agent-reviews, confere o SHA-256 do catálogo, importa as fontes e
// publica as conferências. Pode rodar de novo: o que já existe é mantido.
//   node dist/admin/bootstrap-content.mjs        (na imagem)
//   npm run bootstrap:content                    (local)
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { db } from "../apps/api/src/database.js";
import { importDocument, validateMirrorUrl, validateOfficialUrl } from "../apps/api/src/source-store.js";
import { downloadPdf } from "./lib/source-download.mjs";
import { describe, publishReview, reviewDocument } from "./lib/publish-review.js";

const run = promisify(execFile);
const REVIEWS = "data/agent-reviews";
type CatalogDocument = {
  id: string; year: number; area: string; modality: "BACHARELADO" | "LICENCIATURA" | "CST" | "COMUM";
  kind: "EXAM" | "ANSWER_KEY" | "RESPONSE_STANDARD"; title: string; officialUrl: string; mirrorUrl?: string; sha256: string;
};

/** Conferências commitadas (a pasta pending/ fica de fora: ainda não conferidas). */
async function reviewFiles() {
  return (await readdir(REVIEWS)).filter((name) => name.endsWith(".json")).sort().map((name) => path.join(REVIEWS, name));
}

/** Prova e gabarito de cada conferência, como estão no catálogo. */
async function neededDocuments(files: string[]) {
  const catalog: CatalogDocument[] = JSON.parse(await readFile("data/official-sources.json", "utf8")).documents;
  const byId = new Map(catalog.map((doc) => [doc.id, doc]));
  const ids = new Set<string>();
  for (const file of files) {
    const exam = await reviewDocument(file);
    ids.add(exam).add(exam.replace(/-exam$/, "-answer-key"));
  }
  return [...ids].map((id) => byId.get(id) ?? (() => { throw new Error(`Documento fora do catálogo: ${id}`); })());
}

async function alreadyImported(sha256: string) {
  return Boolean((await db.query("SELECT 1 FROM source_document WHERE sha256=$1", [sha256])).rowCount);
}

/** Baixa do Inep; se falhar, da cópia catalogada. Só aceita os bytes do SHA-256 do catálogo. */
async function fetchVerified(doc: CatalogDocument, work: string) {
  const file = path.join(work, `${doc.id}.pdf`);
  const attempts: [string, (url: string) => string, "DIRECT" | "MIRROR"][] = [[doc.officialUrl, validateOfficialUrl, "DIRECT"]];
  if (doc.mirrorUrl) attempts.push([doc.mirrorUrl, validateMirrorUrl, "MIRROR"]);
  const errors: string[] = [];
  for (const [url, validate, method] of attempts) {
    try {
      const retrievalUrl = await downloadPdf(url, file, validate);
      const bytes = await readFile(file);
      if (createHash("sha256").update(bytes).digest("hex") !== doc.sha256) throw new Error("SHA-256 diferente do catálogo");
      return { bytes, file, method, retrievalUrl };
    } catch (error) {
      errors.push(`${method}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`${doc.id} não foi baixado (${errors.join("; ")}).`);
}

async function importSource(doc: CatalogDocument, work: string) {
  if (await alreadyImported(doc.sha256)) return `${doc.id}: já importado.`;
  const { bytes, file, method, retrievalUrl } = await fetchVerified(doc, work);
  const { stdout } = await run("pdfinfo", [file], { timeout: 10000 });
  const pageCount = Number(/^Pages:\s+(\d+)/m.exec(stdout)?.[1] ?? 0);
  await importDocument({
    title: doc.title, officialUrl: doc.officialUrl, kind: doc.kind, year: doc.year, area: doc.area,
    modality: doc.modality, pageCount, bytes, acquisitionMethod: method,
    ...(method === "MIRROR" ? { retrievalUrl } : {}),
  });
  return `${doc.id}: importado (${method === "DIRECT" ? "Inep" : "cópia catalogada"}).`;
}

async function main() {
  const files = await reviewFiles();
  const work = await mkdtemp(path.join(tmpdir(), "enade-bootstrap-"));
  try {
    for (const doc of await neededDocuments(files)) console.log(await importSource(doc, work));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  let rejected = 0;
  for (const file of files) {
    const summary = await publishReview(file);
    rejected += summary.rejected.length;
    console.log(describe(summary));
  }
  if (rejected) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await db.end();
}
