// Publica só as questões geradas por IA (data/generated-questions), sem baixar
// provas. Útil ao acrescentar um lote: npm run publish:generated
import { db } from "../apps/api/src/database.js";
import { describeGenerated, generatedFiles, publishGeneratedFile } from "../apps/api/src/generated-publication.js";

try {
  for (const file of await generatedFiles()) console.log(describeGenerated(await publishGeneratedFile(file)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await db.end();
}
