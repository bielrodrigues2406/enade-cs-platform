import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildStudyInventory } from "./lib/study-inventory.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const inputFiles = [];
async function read(file) {
  const bytes = await readFile(path.join(root, file));
  inputFiles.push({ file, sha256: createHash("sha256").update(bytes).digest("hex") });
  return { file, data: JSON.parse(bytes.toString("utf8")) };
}
async function folder(directory) {
  const names = (await readdir(path.join(root, directory))).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(names.map((name) => read(`${directory}/${name}`)));
}

if (process.argv.slice(2).some((arg) => arg !== "--check")) throw new Error("Uso: node scripts/study-inventory.mjs [--check]");
const catalog = (await read("data/official-sources.json")).data;
const reports = await folder("data/question-reports");
const objectiveReviews = await folder("data/agent-reviews");
const discursiveReviews = await folder("data/discursive-reviews");
const analyses = await folder("data/question-reviews");
const annotations = (await read("data/study-analysis/annotations.json")).data;
const inventory = buildStudyInventory({ catalog, reports, objectiveReviews, discursiveReviews, analyses, annotations });
const output = `${JSON.stringify({ ...inventory, inputs: inputFiles.sort((a, b) => a.file.localeCompare(b.file, "en")) }, null, 2)}\n`;
const target = path.join(root, "data/study-analysis/inventory.json");
if (process.argv.includes("--check")) {
  if (await readFile(target, "utf8") !== output) throw new Error("Inventário desatualizado: execute node scripts/study-inventory.mjs");
} else {
  await writeFile(target, output);
}
console.log(JSON.stringify(inventory.totals));
