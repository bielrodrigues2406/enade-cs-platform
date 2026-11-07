// Relatório de pistas das questões geradas: npm run audit:generated
import { generatedFiles, readGeneratedFile } from "../apps/api/src/generated-publication.js";
import { auditGenerated } from "../apps/api/src/generated-audit.js";

const questions = [];
for (const file of await generatedFiles()) questions.push(...(await readGeneratedFile(file)).questions);
const report = auditGenerated(questions);
const pct = (value: number) => `${Math.round(value * 100)}%`;
console.log(`Questões: ${report.total}`);
console.log(`Simples (${report.simple.count}): certa única mais longa ${pct(report.simple.uniqueLongest)}, chutador ${pct(report.simple.guesser)}`);
console.log(`  certa mais de 15% maior que a maior errada: ${report.simple.overLength.join(", ") || "nenhuma"}`);
console.log(`Itens (${report.items.count}): item I verdadeiro ${pct(report.items.firstTrue)}, itens verdadeiros na certa ${JSON.stringify(report.items.byTrueCount)}`);
console.log(`Asserção (${report.assertion.count}): ${JSON.stringify(report.assertion.byAnswer)}`);
console.log(`Letras: ${JSON.stringify(report.letters)}`);
console.log(`Enunciado: mediana ${report.promptWords.median} palavras, ${pct(report.promptWords.long)} com 180 ou mais`);
process.exit(0);
