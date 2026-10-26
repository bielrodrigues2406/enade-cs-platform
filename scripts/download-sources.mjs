import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  rm,
  mkdtemp,
  rename,
  lstat,
  realpath,
  open,
} from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { downloadPdf, MAX_PDF_BYTES } from "./lib/source-download.mjs";

export function validateDownloadUrl(input) {
  const url = new URL(input);
  const official =
    url.hostname === "download.inep.gov.br" &&
    /^\/(?:enade|pnd|educacao_superior\/enade|download\/(?:enade|Enade2008_RNP))\//.test(
      url.pathname,
    );
  const mirror =
    url.hostname === "raw.githubusercontent.com" &&
    /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[a-f0-9]{40}\/.+\.pdf$/.test(
      url.pathname,
    );
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith(".pdf") ||
    (!official && !mirror)
  )
    throw new Error("Destino de PDF não permitido.");
  return url.toString();
}
export function inspectDownloadedBytes(bytes, expected = {}) {
  if (
    bytes.length < 5 ||
    bytes.length > MAX_PDF_BYTES ||
    bytes.subarray(0, 5).toString() !== "%PDF-"
  )
    throw new Error(
      "O conteúdo recebido não tem assinatura PDF ou excede 10 MiB.",
    );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (
    (expected.sha256 && expected.sha256 !== sha256) ||
    (expected.byteSize && expected.byteSize !== bytes.length)
  ) {
    const error = new Error(
      "Os bytes divergem da cópia catalogada. Preserve o arquivo para conferência; não foi aceito como a versão esperada.",
    );
    error.sha256 = sha256;
    throw error;
  }
  return { sha256, byteSize: bytes.length };
}
async function confinedDirectory(root, name) {
  const candidate = join(root, name);
  try {
    await mkdir(candidate);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const info = await lstat(candidate);
  const actual = await realpath(candidate);
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (info.isSymbolicLink() || !info.isDirectory() || !actual.startsWith(prefix))
    throw new Error("Diretório fora da pasta de saída ou definido por symlink.");
  return actual;
}
async function readRegularFile(file, limit = MAX_PDF_BYTES) {
  const entry = await lstat(file);
  if (entry.isSymbolicLink())
    throw new Error("Arquivo definido por symlink não é aceito.");
  if (!entry.isFile() || entry.size > limit)
    throw new Error("Arquivo inválido ou acima do limite de tamanho.");
  const handle = await open(
    file,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > limit)
      throw new Error("Arquivo inválido ou acima do limite de tamanho.");
    const bytes = await handle.readFile();
    if (bytes.length > limit)
      throw new Error("Arquivo acima do limite de tamanho.");
    return bytes;
  } finally {
    await handle.close();
  }
}
function successfulReceipt(record) {
  return (
    [
      "DOWNLOADED_MATCHED_COPY",
      "DOWNLOADED_UNREVIEWED",
      "CACHED_MATCHED_COPY",
      "CACHED_UNREVIEWED",
    ].includes(record?.status) && /^[a-f0-9]{64}$/.test(record?.sha256 ?? "")
  );
}
async function storeReceipt(root, receipt, saved) {
  const temporary = await mkdtemp(join(root, ".receipt-"));
  try {
    const file = join(temporary, "report.json");
    await writeFile(
      file,
      JSON.stringify(
        {
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          results: [...saved.values()],
        },
        null,
        2,
      ) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    // Renaming replaces the receipt entry itself, never follows a symlink target.
    await rename(file, receipt);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
function parse(args) {
  const options = {
    output: resolve("enade-pdfs"),
    source: "official",
    years: null,
  };
  for (let i = 0; i < args.length; i += 2) {
    const value = args[i + 1];
    if (!value || !["--output", "--source", "--years"].includes(args[i]))
      throw new Error(
        "Use --output PASTA, --source official|mirror ou --years 2005,2008,...",
      );
    if (args[i] === "--output") options.output = resolve(value);
    if (args[i] === "--source") options.source = value;
    if (args[i] === "--years") {
      if (!/^20\d\d(?:,20\d\d)*$/.test(value))
        throw new Error("Anos inválidos.");
      options.years = new Set(value.split(",").map(Number));
    }
  }
  if (!["official", "mirror"].includes(options.source))
    throw new Error("Escolha official ou mirror.");
  return options;
}
export async function downloadCatalog(
  options,
  documents,
  { download = downloadPdf } = {},
) {
  const results = [];
  await mkdir(options.output, { recursive: true });
  const output = await realpath(options.output);
  const receipt = join(output, "download-report.json");
  let prior = [];
  try {
    prior = JSON.parse(
      (await readRegularFile(receipt, 2 * 1024 * 1024)).toString("utf8"),
    ).results;
    if (!Array.isArray(prior)) throw new Error("Recibo de download inválido.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const saved = new Map(prior.map((row) => [row.id, row]));
  for (const document of documents) {
    if (options.years && !options.years.has(document.year)) continue;
    if (
      !/^[a-z0-9-]{1,150}$/.test(document.id) ||
      !/^20\d\d$/.test(String(document.year))
    )
      throw new Error("Identificador ou ano inválido no catálogo.");
    const relative = `${document.year}/${document.id}.pdf`;
    const url =
      options.source === "mirror" ? document.mirrorUrl : document.officialUrl;
    const result = {
      id: document.id,
      file: relative,
      requestedUrl: url,
      status: "PENDING",
      reviewed: false,
    };
    let temporary;
    try {
      if (!url)
        throw new Error(
          "Não há cópia alternativa catalogada para este documento.",
        );
      validateDownloadUrl(url);
      const directory = await confinedDirectory(output, String(document.year));
      const destination = join(directory, document.id + ".pdf");
      try {
        const existing = await readRegularFile(destination);
        const old = saved.get(document.id);
        const expected = document.sha256
          ? document
          : successfulReceipt(old) &&
              old.requestedUrl === url &&
              old.file === relative
            ? old
            : null;
        if (!expected)
          throw new Error(
            "Arquivo existente sem hash de referência ou recibo. Preserve-o fora da pasta antes de tentar baixar de novo.",
          );
        Object.assign(result, inspectDownloadedBytes(existing, expected), {
          status: document.sha256 ? "CACHED_MATCHED_COPY" : "CACHED_UNREVIEWED",
          ...(old?.downloadUrl ? { downloadUrl: old.downloadUrl } : {}),
        });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        temporary = await mkdtemp(join(output, ".download-"));
        const file = join(temporary, "document.pdf");
        const actualUrl = await download(url, file, validateDownloadUrl);
        const bytes = await readRegularFile(file);
        try {
          Object.assign(result, inspectDownloadedBytes(bytes, document));
        } catch (error) {
          if (error.sha256) {
            const quarantine = await confinedDirectory(output, "quarantine");
            const kept = join(quarantine, error.sha256 + ".pdf");
            try {
              await copyFile(file, kept, constants.COPYFILE_EXCL);
            } catch (e) {
              if (e.code !== "EEXIST") throw e;
              const previous = await readRegularFile(kept);
              if (
                createHash("sha256").update(previous).digest("hex") !==
                error.sha256
              )
                throw new Error("Arquivo existente de quarentena divergente.");
            }
            result.quarantineFile = "quarantine/" + error.sha256 + ".pdf";
            result.sha256 = error.sha256;
          }
          throw error;
        }
        await copyFile(file, destination, constants.COPYFILE_EXCL);
        result.downloadUrl = actualUrl;
        result.status = document.sha256
          ? "DOWNLOADED_MATCHED_COPY"
          : "DOWNLOADED_UNREVIEWED";
      }
    } catch (error) {
      result.status = "FAILED";
      result.message = error.message;
    } finally {
      if (temporary) await rm(temporary, { recursive: true, force: true });
    }
    results.push(result);
    console.log(
      `${result.status}: ${document.id}${result.message ? " — " + result.message : ""}`,
    );
    const previous = saved.get(result.id);
    saved.set(
      result.id,
      result.status === "FAILED" && successfulReceipt(previous)
        ? { ...previous, lastAttempt: result }
        : result,
    );
    await storeReceipt(output, receipt, saved);
  }
  if (!results.length)
    throw new Error("Nenhum documento catalogado para os anos selecionados.");
  return results;
}
async function main() {
  if (process.argv.includes("--help")) {
    console.log(
      "Baixa todos os documentos catalogados, sem banco ou npm install. Requer Node 24 e curl.\nnode scripts/download-sources.mjs [--output enade-pdfs] [--source official|mirror] [--years 2005,2008,...]\nO padrão inclui todos os anos/famílias. PDFs existentes nunca são substituídos.\nAs cópias continuam pendentes de revisão humana; hashes conhecidos são de cópias catalogadas, não de uma assinatura do Inep.",
    );
    return;
  }
  const options = parse(process.argv.slice(2));
  const manifest = JSON.parse(
    await readFile(
      new URL("../data/official-sources.json", import.meta.url),
      "utf8",
    ),
  );
  const results = await downloadCatalog(options, manifest.documents);
  const failed = results.filter((r) => r.status === "FAILED").length;
  console.log(
    `Documentos: ${results.length}; concluídos/cache: ${results.length - failed}; pendentes/falhas: ${failed}.`,
  );
  console.log(
    "Compacte as pastas por ano junto ao download-report.json para enviar os arquivos à curadoria.",
  );
  if (failed) process.exitCode = 1;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
