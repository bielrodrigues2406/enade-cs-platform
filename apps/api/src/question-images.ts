import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";

// Imagens de questão (CT-1, ADR-010): recortes do PDF original em WebP,
// guardados em disco pelo SHA-256 e descritos em question_asset.
const SHA = /^[a-f0-9]{64}$/;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export type QuestionImage = {
  sha256: string;
  page: number;
  width: number;
  height: number;
};

export function assetPath(sha256: string) {
  if (!SHA.test(sha256)) fail("Imagem não encontrada.", 404);
  return path.join(
    process.env.QUESTION_ASSET_DIR || path.resolve(".local/question-assets"),
    sha256.slice(0, 2),
    `${sha256}.webp`,
  );
}

/** Confere a assinatura WebP e lê as dimensões (VP8, VP8L ou VP8X). */
export function webpSize(bytes: Buffer) {
  if (
    bytes.length < 30 ||
    bytes.toString("latin1", 0, 4) !== "RIFF" ||
    bytes.toString("latin1", 8, 12) !== "WEBP" ||
    bytes.readUInt32LE(4) + 8 !== bytes.length
  )
    fail("A imagem não é um WebP válido.", 400);
  const chunk = bytes.toString("latin1", 12, 16);
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X")
    return {
      width: bytes.readUIntLE(24, 3) + 1,
      height: bytes.readUIntLE(27, 3) + 1,
    };
  if (chunk === "VP8 " && bytes.readUIntBE(23, 3) === 0x9d012a)
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  return fail("A imagem não é um WebP válido.", 400);
}

/**
 * Grava uma imagem uma única vez (o nome é o hash) e registra seus
 * metadados. Reenviar os mesmos bytes não duplica nada.
 */
export async function storeAsset(client: PoolClient, bytes: Buffer) {
  if (bytes.length > MAX_IMAGE_BYTES) fail("Imagem acima de 5 MiB.", 400);
  const { width, height } = webpSize(bytes);
  if (width > 8000 || height > 16000) fail("Imagem grande demais.", 400);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const file = assetPath(sha256);
  const existing = await stat(file).catch(() => null);
  if (!existing) {
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, bytes, { flag: "wx" });
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  await readAsset(sha256, bytes.length);
  const row = (
    await client.query<{ byteSize: number; width: number; height: number }>(
      `INSERT INTO question_asset(sha256,media_type,byte_size,width,height) VALUES($1,'image/webp',$2,$3,$4)
       ON CONFLICT(sha256) DO UPDATE SET sha256=EXCLUDED.sha256
       RETURNING byte_size AS "byteSize",width,height`,
      [sha256, bytes.length, width, height],
    )
  ).rows[0];
  if (row.byteSize !== bytes.length || row.width !== width || row.height !== height)
    fail("Metadados da imagem divergem do arquivo.", 409);
  return { sha256, width, height, byteSize: bytes.length };
}

export async function readAsset(sha256: string, byteSize: number) {
  let bytes: Buffer;
  try {
    bytes = await readFile(assetPath(sha256));
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT")
      fail("Imagem indisponível no armazenamento.", 404);
    throw error;
  }
  if (
    bytes.length !== byteSize ||
    createHash("sha256").update(bytes).digest("hex") !== sha256
  )
    fail("Não foi possível confirmar a integridade da imagem.", 409);
  return bytes;
}

export async function versionImages(
  versionId: string,
  client?: PoolClient,
): Promise<QuestionImage[]> {
  return (
    await (client ?? db).query<QuestionImage>(
      `SELECT i.asset_sha256 AS sha256,i.source_page AS page,a.width,a.height
       FROM question_version_image i JOIN question_asset a ON a.sha256=i.asset_sha256
       WHERE i.version_id=$1 ORDER BY i.position`,
      [versionId],
    )
  ).rows;
}

export const imageView = (image: QuestionImage) => ({
  url: `/api/question-images/${image.sha256}.webp`,
  width: image.width,
  height: image.height,
  page: image.page,
});

@Controller("api")
export class QuestionImagesController {
  // Recorte de uma versão publicada (qualquer sessão), de discursiva
  // publicada ou de rascunho (somente curadoria). O nome é o hash: pode
  // ficar em cache para sempre.
  @Get("question-images/:file") async image(
    @Req() req: any,
    @Res() res: any,
    @Param("file") file: string,
  ) {
    const match = /^([a-f0-9]{64})\.webp$/.exec(file);
    if (!match) fail("Imagem não encontrada.", 404);
    const user = await requireIdentity(req);
    const row = (
      await db.query<{ byteSize: number }>(
        `SELECT a.byte_size AS "byteSize" FROM question_asset a WHERE a.sha256=$1 AND (
           EXISTS(SELECT 1 FROM question_version_image i JOIN question_version v ON v.id=i.version_id
                  WHERE i.asset_sha256=a.sha256 AND v.editorial_status='PUBLISHED')
           -- Discursiva: enunciado para todos; padrão de resposta só para quem já enviou a resposta.
           OR EXISTS(SELECT 1 FROM discursive_image d WHERE d.asset_sha256=a.sha256 AND d.part='PROMPT')
           OR EXISTS(SELECT 1 FROM discursive_image d JOIN discursive_response r ON r.question_id=d.question_id
                     WHERE d.asset_sha256=a.sha256 AND r.owner_id=$2 AND r.submitted_at IS NOT NULL)
           OR EXISTS(SELECT 1 FROM curator_role c JOIN account ac ON ac.identity_id=c.identity_id
                     WHERE c.identity_id=$2))`,
        [match![1], user.id],
      )
    ).rows[0];
    if (!row) fail("Imagem não encontrada.", 404);
    const bytes = await readAsset(match![1], row.byteSize);
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Content-Length", bytes.length);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.end(bytes);
  }
}
