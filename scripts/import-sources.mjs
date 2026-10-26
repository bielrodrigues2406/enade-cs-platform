import { execFile } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
const run = promisify(execFile);
const repository = fileURLToPath(new URL("../", import.meta.url));
export async function bundleFile(directory, document) {
  if (
    !/^[a-z0-9-]{1,150}$/.test(document.id) ||
    !/^20\d\d$/.test(String(document.year))
  )
    throw new Error("Identificador de arquivo inválido.");
  const root = await realpath(directory);
  const file = await realpath(
    resolve(root, String(document.year), document.id + ".pdf"),
  );
  if (!file.startsWith(root + sep))
    throw new Error("O arquivo aponta para fora da pasta do pacote.");
  return file;
}
async function main() {
  if (process.argv.includes("--help")) {
    console.log(
      "Importa PDFs locais do catálogo como pendentes de conferência.\nnode scripts/import-sources.mjs --directory PASTA [--years 2005,2008,...] [--actor UUID]\nO padrão inclui todos os anos catalogados. Arquivos ausentes/falhas são reportados e retornam exit 1.",
    );
    return;
  }
  const options = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    if (
      !["--directory", "--years", "--actor"].includes(args[i]) ||
      !args[i + 1] ||
      Object.hasOwn(options, args[i])
    )
      throw new Error("Argumentos inválidos. Consulte --help.");
    options[args[i]] = args[i + 1];
  }
  if (!options["--directory"]) throw new Error("Informe --directory PASTA.");
  if (options["--years"] && !/^20\d\d(?:,20\d\d)*$/.test(options["--years"]))
    throw new Error("Anos inválidos.");
  if (
    options["--actor"] &&
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(options["--actor"])
  )
    throw new Error("UUID inválido.");
  const years = options["--years"]
    ? new Set(options["--years"].split(",").map(Number))
    : null;
  const manifest = JSON.parse(
    await readFile(
      new URL("../data/official-sources.json", import.meta.url),
      "utf8",
    ),
  );
  const selected = manifest.documents.filter(
    (d) => !years || years.has(d.year),
  );
  if (!selected.length)
    throw new Error("Nenhum documento para os anos selecionados.");
  const results = [];
  for (const document of selected) {
    try {
      const file = await bundleFile(resolve(options["--directory"]), document);
      const flags = [
        "--url",
        document.officialUrl,
        "--kind",
        document.kind,
        "--year",
        String(document.year),
        "--area",
        document.area,
        "--modality",
        document.modality,
        "--title",
        document.title,
        "--file",
        file,
      ];
      if (document.sha256) flags.push("--sha256", document.sha256);
      if (options["--actor"]) flags.push("--actor", options["--actor"]);
      const output = await run(
        process.execPath,
        ["--import", "tsx", "scripts/import-source.ts", ...flags],
        { cwd: repository, timeout: 45000, maxBuffer: 65536, encoding: "utf8" },
      );
      const result = JSON.parse(output.stdout);
      results.push({ catalogId: document.id, ...result });
    } catch (error) {
      results.push({
        catalogId: document.id,
        error:
          error.code === "ENOENT"
            ? "Arquivo ausente."
            : "Não importado. Confira integridade, formato, metadados e permissão; use import:source para o diagnóstico individual.",
      });
    }
  }
  console.log(
    JSON.stringify(
      {
        documents: selected.length,
        imported: results.filter((r) => r.id).length,
        failed: results.filter((r) => r.error).length,
        results,
      },
      null,
      2,
    ),
  );
  if (results.some((r) => r.error)) process.exitCode = 1;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
