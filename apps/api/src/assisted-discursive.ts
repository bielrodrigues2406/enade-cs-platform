import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { AREAS } from "./question-areas.js";
import { storeAsset } from "./question-images.js";
import { readArchive } from "./source-store.js";

// Publicação de discursivas conferidas por agente (DISC-2). Recebe a conferência
// commitada em data/discursive-reviews e os bytes de cada recorte; confere os
// hashes, a prova e o padrão de resposta já importados, e grava a discursiva
// com origem ASSISTED. Repetir não duplica: o que já existe é mantido.

const AGENT = /^[a-z0-9][a-z0-9-]{1,39}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const FILE = /^D[0-9]{1,3}-(prompt|standard)-[0-9]{1,2}\.webp$/;

type Fragment = { file: string; page: number; box: { x0: number; y0: number; x1: number; y1: number }; sha256: string };
type Criterion = { label: string | null; points: number };
type Item = {
  number: number; decision: "APPROVED" | "BLOCKED"; area: string; subject: string | null;
  criteria: Criterion[]; note: string | null; prompt: Fragment[]; standard: Fragment[];
};
export type DiscursiveReview = {
  document: string; examSha256: string; standardDocument: string; standardSha256: string;
  extractor: string; reviewer: string; renderer: { dpi: number }; items: Item[];
};
export type DiscursiveSummary = { document: string; published: number[]; kept: number[]; blocked: number[] };
type SourceRecord = {
  id: string; year: number; modality: string; status: string; sha256: string; byteSize: number;
};

function fail(message: string): never {
  throw new Error(message);
}

/** Recusa a conferência inteira se algo estiver fora do formato combinado. */
export function validateReview(review: DiscursiveReview) {
  if (!AGENT.test(review.extractor) || !AGENT.test(review.reviewer)) fail("Agentes da conferência inválidos.");
  if (!SHA256.test(review.examSha256) || !SHA256.test(review.standardSha256)) fail("SHA-256 das fontes inválido.");
  if (!Number.isInteger(review.renderer?.dpi) || review.renderer.dpi < 72 || review.renderer.dpi > 600) fail("DPI inválido.");
  for (const item of review.items) {
    const where = `${review.document} D${item.number}`;
    if (!Number.isInteger(item.number) || item.number < 1 || item.number > 1000) fail(`${where}: número inválido.`);
    if (!["APPROVED", "BLOCKED"].includes(item.decision)) fail(`${where}: decisão inválida.`);
    if (!(AREAS as readonly string[]).includes(item.area)) fail(`${where}: área fora da lista.`);
    const total = item.criteria.reduce((sum, c) => sum + c.points, 0);
    if (!item.criteria.length || item.criteria.length > 6 || total > 10 ||
      item.criteria.some((c) => c.points < 0.5 || c.points > 10 || !(c.label === null || /^[a-f]$/.test(c.label))))
      fail(`${where}: itens de avaliação inválidos.`);
    if (item.decision === "APPROVED" && (!item.prompt.length || !item.standard.length)) fail(`${where}: falta recorte.`);
    for (const f of [...item.prompt, ...item.standard])
      if (!FILE.test(f.file) || !SHA256.test(f.sha256) || !Number.isInteger(f.page) || f.page < 1 ||
        !(f.box.x1 > f.box.x0 && f.box.y1 > f.box.y0 && f.box.x0 >= 0 && f.box.y0 >= 0))
        fail(`${where}: recorte ${f.file} inválido.`);
  }
}

async function sourceId(sha256: string, kind: string): Promise<SourceRecord> {
  const row = (await db.query<SourceRecord>(
    'SELECT id,year,modality,status,sha256,byte_size AS "byteSize" FROM source_document WHERE sha256=$1 AND kind=$2', [sha256, kind],
  )).rows[0];
  return row ?? fail(`Fonte ${kind} ${sha256.slice(0, 12)} ainda não importada.`);
}

/** A conferência do padrão acompanha a publicação; nunca promove só por importar. */
async function verifyStandard(client: PoolClient, standard: SourceRecord, reviewer: string) {
  if (standard.status === "VERIFIED") return;
  if (standard.status !== "IMPORTED") fail("O padrão de resposta não está disponível para conferência.");
  await readArchive(standard);
  const changed = await client.query(
    `UPDATE source_document SET status='VERIFIED',verification_origin='ASSISTED',
       assisted_verifier=$2,reviewed_at=clock_timestamp(),revision=revision+1
     WHERE id=$1 AND status='IMPORTED' RETURNING id`, [standard.id, reviewer],
  );
  if (changed.rowCount) await client.query(
    `INSERT INTO source_event(source_id,agent,event_type,note) VALUES($1,$2,'VERIFIED',$3)`,
    [standard.id, reviewer, "Padrão conferido por agente: recortes aprovados e SHA-256 do arquivo arquivado igual à conferência."],
  );
}

export async function publishDiscursiveReview(
  review: DiscursiveReview,
  readCrop: (file: string) => Promise<Buffer>,
): Promise<DiscursiveSummary> {
  validateReview(review);
  const exam = await sourceId(review.examSha256, "EXAM");
  const standard = await sourceId(review.standardSha256, "RESPONSE_STANDARD");
  const summary: DiscursiveSummary = { document: review.document, published: [], kept: [], blocked: [] };
  for (const item of review.items) {
    if (item.decision !== "APPROVED") { summary.blocked.push(item.number); continue; }
    const crops = await Promise.all([...item.prompt, ...item.standard].map(async (f) => {
      const bytes = await readCrop(f.file);
      if (createHash("sha256").update(bytes).digest("hex") !== f.sha256) fail(`${review.document} ${f.file}: bytes diferentes da conferência.`);
      return bytes;
    }));
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await verifyStandard(client, standard, review.reviewer);
      const id = `discursive-${review.examSha256.slice(0, 12)}-d${item.number}`;
      const created = await client.query(
        `INSERT INTO discursive_question(id,exam_source_id,standard_source_id,year,modality,number,area,subject,criteria,
           review_origin,assisted_extractor,assisted_reviewer,review_note)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'ASSISTED',$10,$11,$12) ON CONFLICT DO NOTHING RETURNING id`,
        [id, exam.id, standard.id, exam.year, exam.modality, item.number, item.area, item.subject,
          JSON.stringify(item.criteria), review.extractor, review.reviewer, item.note],
      );
      if (!created.rowCount) {
        await client.query("COMMIT");
        summary.kept.push(item.number);
        continue;
      }
      const parts = [...item.prompt.map((f) => ["PROMPT", f] as const), ...item.standard.map((f) => ["STANDARD", f] as const)];
      const positions = { PROMPT: 0, STANDARD: 0 };
      for (const [index, [part, fragment]] of parts.entries()) {
        const asset = await storeAsset(client, crops[index]);
        await client.query(
          "INSERT INTO discursive_image(question_id,part,position,asset_sha256,source_page,box,dpi) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [id, part, ++positions[part], asset.sha256, fragment.page,
            [fragment.box.x0, fragment.box.y0, fragment.box.x1, fragment.box.y1], review.renderer.dpi],
        );
      }
      await client.query("COMMIT");
      summary.published.push(item.number);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return summary;
}
