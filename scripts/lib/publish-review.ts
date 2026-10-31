// Publica uma conferência de agente commitada (PUB-A1, ADR-011) a partir dos
// arquivos do repositório: relatório, manifesto, recortes, finalidade dos
// gabaritos e análise da edição. Usado pelo publish-assisted e pelo
// bootstrap-content (DEP-2).
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { publishAssisted } from "../../apps/api/src/assisted-publication.js";

export type ReviewFolders = { reports: string; crops: string; manifests: string };
export const DEFAULT_FOLDERS: ReviewFolders = {
  reports: "data/question-reports",
  crops: "data/question-crops",
  manifests: "data/question-crop-manifests",
};

const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));

/** Prova (`enade-2021-bacharelado-exam`) de uma conferência. */
export async function reviewDocument(reviewFile: string) {
  const document = String((await json(reviewFile)).document ?? "");
  if (!/^[a-z0-9-]{1,150}$/.test(document)) throw new Error(`Prova inválida na conferência ${reviewFile}.`);
  return document;
}

export async function publishReview(reviewFile: string, folders: ReviewFolders = DEFAULT_FOLDERS) {
  const review = await json(reviewFile);
  const document = await reviewDocument(reviewFile);
  const manifestBytes = await readFile(path.join(folders.manifests, `${document}.json`));
  const year = /-(\d{4})-/.exec(document)?.[1];
  const analysis = await json(path.join("data", "question-reviews", `${year}-review.json`)).catch(() => undefined);
  return publishAssisted({
    review,
    report: await json(path.join(folders.reports, `${document}.json`)),
    manifest: JSON.parse(manifestBytes.toString("utf8")),
    manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
    readCrop: (file) => {
      if (!/^[QD][0-9]{1,4}-[0-9]{1,2}\.webp$/.test(file)) throw new Error(`Nome de recorte inválido: ${file}`);
      return readFile(path.join(folders.crops, document, file));
    },
    finality: await json(path.join("data", "answer-key-finality.json")),
    analysis,
  });
}

export function describe(summary: Awaited<ReturnType<typeof publishAssisted>>) {
  const lines = [
    `${summary.document}: ${summary.published.length} publicadas, ${summary.unchanged.length} sem mudança, ` +
      `${summary.blocked.length} bloqueadas na conferência, ${summary.rejected.length} recusadas na publicação ` +
      `(extração ${summary.extractor}, conferência ${summary.reviewer}).`,
  ];
  for (const item of summary.rejected) lines.push(`  recusada ${item.key}: ${item.reason}`);
  for (const item of summary.blocked) lines.push(`  bloqueada ${item.key}: ${item.reason}`);
  return lines.join("\n");
}
