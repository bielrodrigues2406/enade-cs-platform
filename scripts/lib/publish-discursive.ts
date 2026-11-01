// Lê uma conferência de discursivas commitada (DISC-2) e seus recortes e entrega
// ao publicador da API. Usado pelo bootstrap-content.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { publishDiscursiveReview, type DiscursiveReview, type DiscursiveSummary } from "../../apps/api/src/assisted-discursive.js";

export const DISCURSIVE_REVIEWS = "data/discursive-reviews";
const CROPS = "data/discursive-crops";

export async function discursiveReviewFiles() {
  const names = await readdir(DISCURSIVE_REVIEWS).catch(() => [] as string[]);
  return names.filter((name) => name.endsWith(".json")).sort().map((name) => path.join(DISCURSIVE_REVIEWS, name));
}

export async function readDiscursiveReview(file: string): Promise<DiscursiveReview> {
  const review = JSON.parse(await readFile(file, "utf8")) as DiscursiveReview;
  if (!/^[a-z0-9-]{1,150}$/.test(review.document) || !/^[a-z0-9-]{1,150}$/.test(review.standardDocument))
    throw new Error(`Documentos inválidos na conferência ${file}.`);
  return review;
}

export async function publishDiscursiveFile(file: string) {
  const review = await readDiscursiveReview(file);
  return publishDiscursiveReview(review, (name) => readFile(path.join(CROPS, review.document, path.basename(name))));
}

export function describeDiscursive(summary: DiscursiveSummary) {
  const parts = [`${summary.published.length} publicadas`, `${summary.kept.length} já existiam`];
  if (summary.blocked.length) parts.push(`${summary.blocked.length} bloqueadas (${summary.blocked.map((n) => `D${n}`).join(", ")})`);
  return `${summary.document} · discursivas: ${parts.join(", ")}.`;
}
