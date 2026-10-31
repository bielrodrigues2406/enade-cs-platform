// Publica as objetivas aprovadas na conferência por agente (PUB-A1, ADR-011).
// Uso administrativo, sem rota HTTP:
//   npm run publish:assisted -- --review data/agent-reviews/<pacote>.json
//     [--reports data/question-reports] [--crops data/question-crops]
//     [--manifests data/question-crop-manifests]
// Relatório, recortes e manifesto ficam commitados (gerados por
// `extract-questions --crops`), para que conferência e publicação usem os
// mesmos bytes em qualquer ambiente. A fonte da prova e do gabarito precisa
// estar importada (npm run import:sources ou bootstrap-content).
import { db } from "../apps/api/src/database.js";
import { DEFAULT_FOLDERS, describe, publishReview } from "./lib/publish-review.js";

const FLAGS = { "--reports": "reports", "--crops": "crops", "--manifests": "manifests" } as const;

function options(argv: string[]) {
  const folders = { ...DEFAULT_FOLDERS };
  let review = "";
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (!value || (flag !== "--review" && !(flag in FLAGS)))
      throw new Error("Uso: npm run publish:assisted -- --review ARQUIVO [--reports PASTA] [--crops PASTA] [--manifests PASTA]");
    if (flag === "--review") review = value;
    else folders[FLAGS[flag as keyof typeof FLAGS]] = value;
  }
  if (!review) throw new Error("Informe --review com a conferência do agente.");
  return { review, folders };
}

try {
  const { review, folders } = options(process.argv.slice(2));
  const summary = await publishReview(review, folders);
  console.log(describe(summary));
  if (summary.rejected.length) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await db.end();
}
