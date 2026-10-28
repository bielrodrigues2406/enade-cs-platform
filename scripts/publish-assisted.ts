// Publica as objetivas aprovadas na conferência por agente (PUB-A1, ADR-011).
// Uso administrativo, sem rota HTTP:
//   npm run publish:assisted -- --review data/agent-reviews/enade-2021-bacharelado-exam.json
//     [--drafts .local/question-drafts] [--crops .local/question-crops]
// Relatório e recortes vêm de `extract-questions --crops`; a fonte da prova e do
// gabarito precisa estar importada (npm run import:sources).
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../apps/api/src/database.js";
import { publishAssisted } from "../apps/api/src/assisted-publication.js";

function options(argv: string[]) {
  const out: Record<string, string> = {
    "--drafts": ".local/question-drafts",
    "--crops": ".local/question-crops",
  };
  for (let i = 0; i < argv.length; i += 2) {
    if (!["--review", "--drafts", "--crops"].includes(argv[i]) || !argv[i + 1])
      throw new Error("Uso: npm run publish:assisted -- --review ARQUIVO [--drafts PASTA] [--crops PASTA]");
    out[argv[i]] = argv[i + 1];
  }
  if (!out["--review"]) throw new Error("Informe --review com a conferência do agente.");
  return out;
}

const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));
try {
  const opts = options(process.argv.slice(2));
  const review = await json(opts["--review"]);
  const document = String(review.document ?? "");
  if (!/^[a-z0-9-]{1,150}$/.test(document)) throw new Error("Prova inválida na conferência.");
  const manifestBytes = await readFile(path.join(opts["--crops"], `${document}.crops.json`));
  const year = /-(\d{4})-/.exec(document)?.[1];
  const analysisFile = path.join("data", "question-reviews", `${year}-review.json`);
  const analysis = await json(analysisFile).catch(() => undefined);
  const summary = await publishAssisted({
    review,
    report: await json(path.join(opts["--drafts"], `${document}.questions.json`)),
    manifest: JSON.parse(manifestBytes.toString("utf8")),
    manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
    readCrop: (file) => {
      if (!/^[QD][0-9]{1,4}-[0-9]{1,2}\.webp$/.test(file)) throw new Error(`Nome de recorte inválido: ${file}`);
      return readFile(path.join(opts["--crops"], document, file));
    },
    finality: await json(path.join("data", "answer-key-finality.json")),
    analysis,
  });
  console.log(
    `${summary.document}: ${summary.published.length} publicadas, ${summary.unchanged.length} sem mudança, ` +
      `${summary.blocked.length} bloqueadas na conferência, ${summary.rejected.length} recusadas na publicação ` +
      `(extração ${summary.extractor}, conferência ${summary.reviewer}).`,
  );
  for (const item of summary.rejected) console.log(`  recusada ${item.key}: ${item.reason}`);
  for (const item of summary.blocked) console.log(`  bloqueada ${item.key}: ${item.reason}`);
  if (summary.rejected.length) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await db.end();
}
