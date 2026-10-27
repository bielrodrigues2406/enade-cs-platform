import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { HttpException } from "@nestjs/common";
import { db } from "../apps/api/src/database.js";
import { importQuestionReport } from "../apps/api/src/question-imports.js";

const HELP = `Importa questões extraídas para uma fila PRIVADA de conferência.

Uso:
  npm run import:questions -- --file RELATORIO.questions.json [--review ANALISE.json] [--actor UUID]

O relatório deve corresponder ao catálogo data/official-sources.json e aos PDFs
registrados e íntegros no arquivo de fontes. A análise opcional tem origem ASSISTED,
humanReviewed=false e SHA-256 da prova por questão. Importar não confere fontes,
atribui revisão humana ou publica conteúdo. Sem --actor, a entrada é administrativa.

Reimportações iguais são idempotentes. Novas extrações só atualizam itens nunca
editados nem encaminhados à curadoria. A evidência inicial permanece preservada.
`;
class CliError extends Error {}
async function jsonFile(file: string) {
  const location = path.resolve(file), info = await stat(location);
  if (!info.isFile() || info.size < 2 || info.size > 8 * 1024 * 1024)
    throw new CliError("Cada arquivo JSON deve ter de 2 bytes a 8 MiB.");
  try { return JSON.parse(await readFile(location, "utf8")); }
  catch { throw new CliError("O arquivo não contém JSON válido."); }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) { console.log(HELP); return; }
  if (!args.length || args.length % 2) throw new CliError("Informe os argumentos em pares. Consulte --help.");
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    if (!["--file", "--review", "--actor"].includes(args[i]) || options.has(args[i]) || !args[i + 1] || args[i + 1].startsWith("--"))
      throw new CliError("Há argumento desconhecido, repetido ou sem valor. Consulte --help.");
    options.set(args[i], args[i + 1]);
  }
  if (!options.has("--file")) throw new CliError("Informe --file RELATORIO.questions.json.");
  const result = await importQuestionReport(await jsonFile(options.get("--file")!), {
    ...(options.has("--review") ? { review: await jsonFile(options.get("--review")!) } : {}),
    ...(options.has("--actor") ? { actorId: options.get("--actor")! } : {}),
  });
  console.log(JSON.stringify(result));
}
try { await main(); }
catch (error) {
  const response = error instanceof HttpException ? error.getResponse() : null;
  console.error(error instanceof CliError ? error.message :
    response && typeof response === "object" && "message" in response ? String(response.message) :
      "Não foi possível importar. Confira os arquivos, o catálogo, a permissão e a configuração do banco/arquivo de PDFs.");
  process.exitCode = 1;
} finally { await db.end(); }
