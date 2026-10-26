import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { text } from "./editorial.js";
export type Source = {
  id: string;
  title: string;
  officialUrl: string;
  kind: "EXAM" | "ANSWER_KEY" | "RESPONSE_STANDARD" | "EXAM_MAP";
  year: number;
  area: string;
  modality: "BACHARELADO" | "LICENCIATURA" | "CST" | "COMUM";
  acquisitionMethod: "DIRECT" | "MIRROR" | "LOCAL";
  retrievalUrl: string | null;
  sha256: string;
  byteSize: number;
  pageCount: number;
  status: string;
  revision: number;
  importedBy: string | null;
  lastEditor: string | null;
  note: string | null;
  isFinal: boolean;
};
export const sourceFields = `id,title,official_url AS "officialUrl",kind,year,area,modality,sha256,byte_size AS "byteSize",page_count AS "pageCount",status,revision,imported_by AS "importedBy",last_editor_id AS "lastEditor",note,is_final AS "isFinal",acquisition_method AS "acquisitionMethod",retrieval_url AS "retrievalUrl"`;
export function validateOfficialUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return fail("URL oficial inválida.", 400);
  }
  const allowed =
    (url.hostname === "download.inep.gov.br" &&
      /^\/(?:enade|pnd|educacao_superior\/enade|download\/(?:enade|Enade2008_RNP))\//.test(
        url.pathname,
      )) ||
    (url.hostname === "www.gov.br" && url.pathname.startsWith("/inep/"));
  if (
    url.protocol !== "https:" ||
    !allowed ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith(".pdf") ||
    input.length > 2000
  )
    fail(
      "Use uma URL HTTPS de PDF do Inep, sem credenciais ou redirecionamentos externos.",
      400,
    );
  return url.toString();
}
export function validateMirrorUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return fail("URL da cópia inválida.", 400);
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "raw.githubusercontent.com" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    input.length > 2000 ||
    !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[a-f0-9]{40}\/.+\.pdf$/.test(
      url.pathname,
    )
  )
    fail(
      "Use uma cópia HTTPS do GitHub fixada no SHA completo do commit, sem credenciais ou parâmetros.",
      400,
    );
  return url.toString();
}
export function sourceMetadata(input: Record<string, unknown>) {
  const kind = input.kind,
    modality = input.modality,
    year = input.year;
  if (
    !["EXAM", "ANSWER_KEY", "RESPONSE_STANDARD", "EXAM_MAP"].includes(
      kind as string,
    ) ||
    !["BACHARELADO", "LICENCIATURA", "CST", "COMUM"].includes(
      modality as string,
    ) ||
    !Number.isInteger(year) ||
    (year as number) < 2004 ||
    (year as number) > new Date().getUTCFullYear()
  )
    fail("Tipo, modalidade ou edição da fonte inválidos.", 400);
  return {
    title: text(input.title, "Título", 200),
    kind: kind as Source["kind"],
    year: year as number,
    area: text(input.area, "Área", 120),
    modality: modality as Source["modality"],
  };
}
export function sourcePath(sha256: string) {
  if (!/^[a-f0-9]{64}$/.test(sha256)) fail("Arquivo de fonte inválido.", 409);
  return path.join(
    process.env.SOURCE_ARCHIVE_DIR || path.resolve(".local/sources"),
    sha256 + ".pdf",
  );
}
export async function readArchive(
  source: Pick<Source, "sha256" | "byteSize">,
): Promise<Buffer> {
  try {
    const file = sourcePath(source.sha256),
      info = await stat(file);
    if (!info.isFile() || info.size !== source.byteSize || info.size > 10485760)
      fail(
        "O arquivo arquivado não corresponde à fonte. Reimporte o documento antes de continuar.",
        409,
      );
    const bytes = await readFile(file);
    if (
      bytes.length !== source.byteSize ||
      bytes.subarray(0, 5).toString() !== "%PDF-" ||
      createHash("sha256").update(bytes).digest("hex") !== source.sha256
    )
      fail(
        "Não foi possível confirmar a integridade do arquivo arquivado.",
        409,
      );
    return bytes;
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT")
      fail(
        "Arquivo da fonte indisponível. Reimporte o documento antes de continuar.",
        409,
      );
    throw error;
  }
}
export async function sourceById(
  id: string,
  client?: PoolClient,
): Promise<Source> {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))
    fail("Fonte não encontrada.", 404);
  const source = (
    await (client ?? db).query<Source>(
      `SELECT ${sourceFields} FROM source_document WHERE id=$1`,
      [id],
    )
  ).rows[0];
  return source ?? fail("Fonte não encontrada.", 404);
}
export function sourceView(source: Source, actor: string) {
  const { importedBy, lastEditor, ...dto } = source;
  return {
    ...dto,
    canReview:
      source.status === "IMPORTED" &&
      importedBy !== actor &&
      lastEditor !== actor,
  };
}
export async function importDocument(input: {
  title: string;
  officialUrl: string;
  kind: Source["kind"];
  year: number;
  area: string;
  modality: Source["modality"];
  pageCount: number;
  bytes: Buffer;
  actorId?: string;
  acquisitionMethod?: Source["acquisitionMethod"];
  retrievalUrl?: string;
}) {
  const meta = sourceMetadata(input),
    url = validateOfficialUrl(input.officialUrl),
    bytes = input.bytes;
  const method = input.acquisitionMethod ?? "DIRECT";
  if (!["DIRECT", "MIRROR", "LOCAL"].includes(method))
    fail("Forma de obtenção inválida.", 400);
  const retrievalUrl =
    method === "MIRROR" ? validateMirrorUrl(input.retrievalUrl ?? "") : null;
  if (method !== "MIRROR" && input.retrievalUrl !== undefined)
    fail("Somente cópias remotas registram URL de obtenção.", 400);
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < 5 ||
    bytes.length > 10485760 ||
    bytes.subarray(0, 5).toString() !== "%PDF-" ||
    !Number.isInteger(input.pageCount) ||
    input.pageCount < 1 ||
    input.pageCount > 1000
  )
    fail("PDF ou número de páginas inválido.", 400);
  const sha256 = createHash("sha256").update(bytes).digest("hex"),
    file = sourcePath(sha256);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    await readArchive({ sha256, byteSize: bytes.length });
  } catch (error) {
    if ((error as { getStatus?: () => number }).getStatus?.() !== 409)
      throw error;
    // Restore missing/corrupt content atomically, without changing registry metadata.
    const temporary = file + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  await readArchive({ sha256, byteSize: bytes.length });
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (input.actorId) {
      if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(input.actorId))
        fail("UUID de curadoria inválido.", 400);
      const role = await client.query(
        "SELECT 1 FROM curator_role WHERE identity_id=$1 FOR SHARE",
        [input.actorId],
      );
      if (!role.rowCount)
        fail("A conta informada não possui papel de curadoria.", 403);
    }
    const id = randomUUID();
    const inserted = await client.query(
      "INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,imported_by,last_editor_id,acquisition_method,retrieval_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13) ON CONFLICT(sha256) DO NOTHING RETURNING id",
      [
        id,
        meta.title,
        url,
        meta.kind,
        meta.year,
        meta.area,
        meta.modality,
        sha256,
        bytes.length,
        input.pageCount,
        input.actorId ?? null,
        method,
        retrievalUrl,
      ],
    );
    if (!inserted.rowCount) {
      const old = (
        await client.query<Source>(
          `SELECT ${sourceFields} FROM source_document WHERE sha256=$1`,
          [sha256],
        )
      ).rows[0];
      if (
        old.officialUrl !== url ||
        old.kind !== meta.kind ||
        old.year !== meta.year ||
        old.area !== meta.area ||
        old.modality !== meta.modality ||
        old.pageCount !== input.pageCount
      )
        fail(
          "O arquivo já existe com metadados diferentes. Confira o registro da fonte.",
          409,
        );
      await client.query("COMMIT");
      return { id: old.id, duplicate: true, status: old.status };
    }
    await client.query(
      "INSERT INTO source_event(source_id,actor_id,event_type) VALUES($1,$2,'IMPORTED')",
      [id, input.actorId ?? null],
    );
    await client.query("COMMIT");
    return { id, duplicate: false, status: "IMPORTED" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export type Provenance = {
  examSourceId: string;
  keySourceId: string;
  page: number;
  questionNumber: number;
  keyPage: number;
};
export async function verifyProvenance(
  p: Provenance,
  client?: PoolClient,
  checkFiles = false,
) {
  const exam = await sourceById(p.examSourceId, client),
    key = await sourceById(p.keySourceId, client);
  if (
    exam.kind !== "EXAM" ||
    key.kind !== "ANSWER_KEY" ||
    exam.status !== "VERIFIED" ||
    key.status !== "VERIFIED" ||
    !key.isFinal ||
    exam.year !== key.year ||
    exam.area !== key.area ||
    exam.modality !== key.modality ||
    !Number.isInteger(p.page) ||
    p.page < 1 ||
    p.page > exam.pageCount ||
    !Number.isInteger(p.keyPage) ||
    p.keyPage < 1 ||
    p.keyPage > key.pageCount ||
    !Number.isInteger(p.questionNumber) ||
    p.questionNumber < 1 ||
    p.questionNumber > 1000
  )
    fail(
      "Confira prova, gabarito definitivo, edição, modalidade, área e páginas da questão.",
      400,
    );
  if (checkFiles) await Promise.all([readArchive(exam), readArchive(key)]);
  return { exam, key };
}
export const publicExam = (exam: Source) => ({
  id: exam.id,
  title: exam.title,
  officialUrl: exam.officialUrl,
  sha256: exam.sha256,
  year: exam.year,
  area: exam.area,
  modality: exam.modality,
  pageCount: exam.pageCount,
});
