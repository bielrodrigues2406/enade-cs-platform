import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { db } from "../apps/api/src/database.js";

const run = promisify(execFile);
const MAX_BYTES = 10 * 1024 * 1024;
const HELP = `Importa um PDF oficial como IMPORTED, com revisão editorial pendente.

Uso:
  npm run import:source -- --url URL --kind EXAM|ANSWER_KEY|RESPONSE_STANDARD \\
    --year ANO --area AREA --modality BACHARELADO|LICENCIATURA|CST \\
    --title TITULO [--actor ID_DA_IDENTIDADE]

A URL precisa ser HTTPS, sem credenciais, porta, query ou fragmento, em:
  download.inep.gov.br/enade/...pdf
  www.gov.br/inep/...pdf

O comando verifica o PDF, calcula tamanho/hash e arquiva o documento.
Redirecionamentos são validados antes de cada acesso; o limite é três.
Sem --actor, a importação administrativa é registrada sem atribuir revisão
humana. Com --actor, a identidade precisa possuir permissão de curadoria.
Importar um documento não revisa nem publica questões oficiais.
`;
class CliError extends Error {}

type Flags = {
  url: string;
  kind: "EXAM" | "ANSWER_KEY" | "RESPONSE_STANDARD";
  year: number;
  area: string;
  modality: "BACHARELADO" | "LICENCIATURA" | "CST";
  title: string;
  actorId?: string;
};
function parse(args: string[]): Flags {
  const allowed = new Set([
    "--url",
    "--kind",
    "--year",
    "--area",
    "--modality",
    "--title",
    "--actor",
  ]);
  if (!args.length || args.length % 2)
    throw new CliError(
      "Informe os argumentos em pares. Use --help para consultar o formato.",
    );
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i],
      value = args[i + 1];
    if (
      !allowed.has(flag) ||
      values.has(flag) ||
      !value ||
      value.startsWith("--")
    )
      throw new CliError(
        "Há argumento desconhecido, repetido ou sem valor. Use --help.",
      );
    values.set(flag, value);
  }
  for (const flag of [
    "--url",
    "--kind",
    "--year",
    "--area",
    "--modality",
    "--title",
  ]) {
    if (!values.has(flag))
      throw new CliError("Faltam argumentos obrigatórios. Use --help.");
  }
  const text = (flag: string, max: number) => {
    const value = values.get(flag)!.trim();
    if (
      !value ||
      [...value].length > max ||
      /[\u0000-\u001f\u007f]/.test(value)
    )
      throw new CliError(
        "Título ou área inválidos: use texto dentro dos limites permitidos.",
      );
    return value;
  };
  const kind = values.get("--kind")!;
  if (!["EXAM", "ANSWER_KEY", "RESPONSE_STANDARD"].includes(kind))
    throw new CliError(
      "Tipo inválido. Use EXAM, ANSWER_KEY ou RESPONSE_STANDARD.",
    );
  const modality = values.get("--modality")!;
  if (!["BACHARELADO", "LICENCIATURA", "CST"].includes(modality))
    throw new CliError(
      "Modalidade inválida. Use BACHARELADO, LICENCIATURA ou CST.",
    );
  const year = values.get("--year")!;
  const currentYear = new Date().getUTCFullYear();
  if (!/^\d{4}$/.test(year) || Number(year) < 2004 || Number(year) > currentYear)
    throw new CliError(`Informe uma edição entre 2004 e ${currentYear}.`);
  const url = values.get("--url")!;
  if (url.length > 2000) throw new CliError("A URL excede o limite permitido.");
  const actorId = values.get("--actor");
  if (
    actorId &&
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      actorId,
    )
  )
    throw new CliError("A identidade de curadoria deve ser um UUID válido.");
  return {
    url,
    kind: kind as Flags["kind"],
    year: Number(year),
    area: text("--area", 120),
    modality: modality as Flags["modality"],
    title: text("--title", 200),
    ...(actorId ? { actorId } : {}),
  };
}

async function download(
  url: string,
  destination: string,
  validate: (input: string) => string,
) {
  let current = validate(url);
  for (let redirects = 0; redirects <= 3; redirects++) {
    let output: string;
    try {
      const result = await run(
        "curl",
        [
          "--disable",
          "--silent",
          "--show-error",
          "--proto",
          "=https",
          "--connect-timeout",
          "10",
          "--max-time",
          "30",
          "--max-filesize",
          String(MAX_BYTES),
          "--output",
          destination,
          "--write-out",
          "%{http_code}\n%{redirect_url}",
          "--url",
          current,
        ],
        {
          timeout: 35000,
          killSignal: "SIGKILL",
          maxBuffer: 65536,
          encoding: "utf8",
        },
      );
      output = result.stdout;
    } catch {
      throw new CliError(
        "Não foi possível baixar o PDF com TLS verificado. Confira o acesso de rede ao domínio oficial e os limites de tempo/tamanho.",
      );
    }
    const [status, redirect] = output.trim().split(/\r?\n/);
    if (status === "200") return current;
    if (!["301", "302", "303", "307", "308"].includes(status))
      throw new CliError(
        "O endereço oficial não retornou um PDF disponível (HTTP diferente de 200).",
      );
    if (redirects === 3 || !redirect)
      throw new CliError(
        "O documento excedeu o limite de redirecionamentos ou não informou destino.",
      );
    // Never fetch a redirect before validating its complete destination.
    current = validate(redirect);
  }
  throw new CliError("Não foi possível resolver o endereço oficial.");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    console.log(HELP);
    return;
  }
  const flags = parse(args);
  const { validateOfficialUrl, importDocument } = await import(
    "../apps/api/src/source-store.js"
  );
  // Reject invalid URLs before creating files or attempting any network access.
  const officialUrl = validateOfficialUrl(flags.url);
  const temporary = await mkdtemp(join(tmpdir(), "enade-source-"));
  try {
    const file = join(temporary, "document.pdf");
    const finalUrl = await download(officialUrl, file, validateOfficialUrl);
    const info = await stat(file);
    if (!info.isFile() || info.size < 5 || info.size > MAX_BYTES)
      throw new CliError("O arquivo recebido não atende ao limite de 10 MiB.");
    const bytes = await readFile(file);
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-", "ascii")))
      throw new CliError("O conteúdo recebido não é um PDF.");
    let output: string;
    try {
      output = (
        await run("pdfinfo", [file], {
          timeout: 10000,
          killSignal: "SIGKILL",
          maxBuffer: 65536,
          encoding: "utf8",
        })
      ).stdout;
    } catch {
      throw new CliError(
        "Não foi possível analisar o PDF. Confira sua integridade e a instalação de pdfinfo.",
      );
    }
    const pages = /^Pages:\s+(\d+)\s*$/m.exec(output);
    const pageCount = pages ? Number(pages[1]) : 0;
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 1000)
      throw new CliError("O PDF deve informar de 1 a 1000 páginas.");
    const result = await importDocument({
      title: flags.title,
      officialUrl: finalUrl,
      kind: flags.kind,
      year: flags.year,
      area: flags.area,
      modality: flags.modality,
      pageCount,
      bytes,
      ...(flags.actorId ? { actorId: flags.actorId } : {}),
    });
    console.log(
      JSON.stringify({
        id: result.id,
        duplicate: result.duplicate,
        state: result.status,
      }),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof CliError
      ? error.message
      : "Não foi possível importar o documento. Confira os argumentos, a permissão de curadoria e a configuração do banco/arquivo. Use --help.",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
