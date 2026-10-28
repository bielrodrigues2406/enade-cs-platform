import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { sourceCatalog, type CatalogDocument } from "./source-catalog.js";
import { readArchive, sourceFields, type Source } from "./source-store.js";
import { storeAsset, versionImages } from "./question-images.js";

/**
 * Publicação assistida (PUB-A1, ADR-010, ADR-011). Entrada administrativa,
 * sem rota HTTP: publica as objetivas que o agente conferente aprovou na
 * imagem, com o agente extrator e o conferente registrados. Nenhuma conta de
 * pessoa é criada ou usada.
 */
export const AREAS = [
  "Formação Geral",
  "Algoritmos",
  "Programação",
  "Teoria da computação",
  "Compiladores",
  "Matemática",
  "Arquitetura de computadores",
  "Sistemas operacionais",
  "Redes",
  "Sistemas distribuídos",
  "Banco de dados",
  "Engenharia de software",
  "Interação humano-computador",
  "Inteligência artificial",
  "Computação gráfica",
  "Segurança",
  "Sistemas de informação",
  "Sociedade e ética",
] as const;

const SHA = /^[a-f0-9]{64}$/;
const AGENT = /^[a-z][a-z0-9-]{1,39}$/;
const KEY = /^Q[0-9]{1,4}$/;
const LETTERS = "ABCDE";
const CROP_DPI = 200;

type Record_ = Record<string, unknown>;
const closed = (value: unknown, keys: string[], label: string): Record_ => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} inválido.`, 400);
  for (const key of Object.keys(value as object))
    if (!keys.includes(key)) fail(`${label}: campo inesperado "${key}".`, 400);
  return value as Record_;
};
const str = (value: unknown, label: string, max = 4000) =>
  typeof value === "string" && value.length <= max
    ? value
    : fail(`${label} inválido.`, 400);

type Verdict = {
  key: string;
  verdict: "APPROVED" | "BLOCKED";
  fragments: string[];
  answer: string;
  optionCount: number;
  area: string;
  notes: string;
  reason: string;
};
type Fragment = {
  file: string;
  page: number;
  box: { x0: number; y0: number; x1: number; y1: number };
  sha256: string;
};
export type PublicationSummary = {
  document: string;
  reviewer: string;
  extractor: string;
  published: string[];
  unchanged: string[];
  blocked: { key: string; reason: string }[];
  rejected: { key: string; reason: string }[];
};

function parseReview(value: unknown) {
  const input = closed(
    value,
    ["document", "examSha256", "cropsManifestSha256", "reviewer", "extractor", "reviewedAt", "items"],
    "Conferência",
  );
  const reviewer = str(input.reviewer, "Agente conferente", 40);
  const extractor = str(input.extractor, "Agente extrator", 40);
  if (!AGENT.test(reviewer) || !AGENT.test(extractor))
    fail("Identifique os agentes por nome simples (ex.: codex, claude).", 400);
  if (reviewer === extractor)
    fail("Quem extraiu não pode conferir a própria extração (ADR-010).", 400);
  const reviewedAt = str(input.reviewedAt, "Data da conferência", 40);
  if (Number.isNaN(Date.parse(reviewedAt))) fail("Data da conferência inválida.", 400);
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 1000)
    fail("A conferência precisa listar de uma a mil questões.", 400);
  const seen = new Set<string>();
  const items = (input.items as unknown[]).map((raw) => {
    const item = closed(
      raw,
      ["key", "verdict", "fragments", "answer", "optionCount", "area", "notes", "reason"],
      "Item da conferência",
    );
    const key = str(item.key, "Questão", 6);
    if (!KEY.test(key) || seen.has(key)) fail(`Questão ${key} inválida ou repetida na conferência.`, 400);
    seen.add(key);
    if (item.verdict === "BLOCKED")
      return { key, verdict: "BLOCKED", reason: str(item.reason, `Motivo do bloqueio de ${key}`, 2000) } as Verdict;
    if (item.verdict !== "APPROVED") fail(`Veredito inválido para ${key}.`, 400);
    if (!Array.isArray(item.fragments) || !item.fragments.length || item.fragments.length > 20 ||
      item.fragments.some((sha) => typeof sha !== "string" || !SHA.test(sha)))
      fail(`Recortes conferidos de ${key} inválidos.`, 400);
    const answer = str(item.answer, `Gabarito de ${key}`, 1);
    const optionCount = item.optionCount;
    if (!Number.isInteger(optionCount) || (optionCount as number) < 2 || (optionCount as number) > 5)
      fail(`Quantidade de alternativas de ${key} inválida.`, 400);
    if (!LETTERS.slice(0, optionCount as number).includes(answer) || answer.length !== 1)
      fail(`Gabarito de ${key} fora das alternativas.`, 400);
    const area = str(item.area, `Área de ${key}`, 80);
    if (!(AREAS as readonly string[]).includes(area)) fail(`Área de ${key} fora da lista.`, 400);
    return {
      key, verdict: "APPROVED", fragments: item.fragments as string[], answer,
      optionCount: optionCount as number, area,
      notes: item.notes === undefined ? "" : str(item.notes, `Notas de ${key}`, 2000),
    } as Verdict;
  });
  return {
    document: str(input.document, "Prova da conferência", 150),
    examSha256: str(input.examSha256, "SHA-256 da prova", 64),
    manifestSha256: str(input.cropsManifestSha256, "SHA-256 do manifesto", 64),
    reviewer, extractor, reviewedAt, items,
  };
}

function finalityOf(keyDoc: CatalogDocument, declared: boolean, finality: unknown) {
  if (declared) return "DECLARED";
  const documents = (finality as { documents?: Record<string, { finality?: string }> })?.documents ?? {};
  const decision = documents[keyDoc.id]?.finality;
  if (decision === "DECLARED" || decision === "ONLY_PUBLISHED") return decision;
  return fail(`${keyDoc.id}: o gabarito não se declara definitivo e não há decisão registrada (D10).`, 400);
}

/** Fonte conferida pelo agente: arquivo íntegro e igual ao fixado no catálogo. */
async function verifySource(client: PoolClient, doc: CatalogDocument, agent: string, keyFinality: string | null) {
  const source = (
    await client.query<Source & { verificationOrigin: string; keyFinality: string | null }>(
      `SELECT ${sourceFields},verification_origin AS "verificationOrigin",key_finality AS "keyFinality" FROM source_document WHERE sha256=$1 FOR UPDATE`,
      [doc.sha256],
    )
  ).rows[0];
  if (!source || source.status === "REJECTED" || source.kind !== doc.kind || source.officialUrl !== doc.officialUrl ||
    source.year !== doc.year || source.modality !== doc.modality)
    fail(`${doc.id}: importe a fonte do catálogo antes de publicar (npm run import:sources).`, 409);
  await readArchive(source);
  if (source.status === "VERIFIED") {
    if (doc.kind === "ANSWER_KEY" && !source.isFinal) fail(`${doc.id}: gabarito conferido sem ser final.`, 409);
    return source;
  }
  await client.query(
    `UPDATE source_document SET status='VERIFIED',verification_origin='ASSISTED',assisted_verifier=$2,reviewed_at=clock_timestamp(),
       is_final=$3,key_finality=$4,revision=revision+1 WHERE id=$1`,
    [source.id, agent, doc.kind === "ANSWER_KEY", keyFinality],
  );
  await client.query(
    "INSERT INTO source_event(source_id,agent,event_type,note) VALUES($1,$2,'VERIFIED',$3)",
    [source.id, agent, "Conferência assistida: SHA-256 igual ao fixado no catálogo e arquivo íntegro."],
  );
  return { ...source, status: "VERIFIED", isFinal: doc.kind === "ANSWER_KEY" };
}

const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function publishAssisted(input: {
  report: unknown;
  manifest: unknown;
  manifestSha256: string;
  readCrop: (file: string) => Promise<Buffer>;
  review: unknown;
  finality: unknown;
  analysis?: unknown;
  catalog?: CatalogDocument[];
}): Promise<PublicationSummary> {
  const review = parseReview(input.review);
  const report = closed(input.report, ["document", "completeness", "items", "extraction", "warnings"], "Relatório");
  const manifest = closed(input.manifest, ["document", "examSha256", "renderer", "items"], "Manifesto de recortes");
  const catalog = new Map((input.catalog ?? await sourceCatalog()).map((d) => [d.id, d]));
  const found = catalog.get(review.document);
  if (!found || found.kind !== "EXAM" || !found.sha256)
    fail("Conferência, relatório e recortes precisam ser da mesma prova catalogada.", 400);
  const exam = found as CatalogDocument & { sha256: string };
  if (exam.sha256 !== review.examSha256 ||
    report.document !== exam.id || manifest.document !== exam.id || manifest.examSha256 !== exam.sha256)
    fail("Conferência, relatório e recortes precisam ser da mesma prova catalogada.", 400);
  if (review.manifestSha256 !== input.manifestSha256)
    fail("A conferência foi feita sobre outro manifesto de recortes. Gere os recortes de novo ou refaça a conferência.", 409);
  const completeness = closed(report.completeness, ["missing", "unexpected"], "Completude");
  if ((completeness.missing as unknown[]).length || (completeness.unexpected as unknown[]).length)
    fail("A numeração da prova está incompleta; nada é publicado.", 409);
  const reportItems = new Map((report.items as Record_[]).map((item) => [item.key as string, item]));
  const crops = new Map((manifest.items as Record_[]).map((item) => [item.key as string, item]));
  const analysis = new Map<string, { explanation: string; author: string }>();
  if (input.analysis) {
    const data = input.analysis as { author?: string; items?: Record_[] };
    for (const item of data.items ?? [])
      if (item.examId === exam.id && typeof item.explanation === "string" && item.explanation.trim())
        analysis.set(item.key as string, { explanation: item.explanation, author: String(data.author ?? "IA") });
  }
  const summary: PublicationSummary = {
    document: exam.id, reviewer: review.reviewer, extractor: review.extractor,
    published: [], unchanged: [], blocked: [], rejected: [],
  };
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`assisted-publication/${exam.sha256}`]);
    const examSource = await verifySource(client, exam, review.reviewer, null);
    let keySource: Source | null = null;
    let keyDoc: CatalogDocument | null = null;
    for (const verdict of review.items) {
      if (verdict.verdict === "BLOCKED") {
        summary.blocked.push({ key: verdict.key, reason: verdict.reason });
        continue;
      }
      const item = reportItems.get(verdict.key);
      const crop = crops.get(verdict.key);
      const reject = (reason: string) => summary.rejected.push({ key: verdict.key, reason });
      if (!item || !crop) { reject("questão ausente do relatório ou do manifesto"); continue; }
      if (item.kind !== "OBJECTIVE" || ["anulada", "discursiva"].includes(item.status as string)) {
        reject("só objetivas válidas são publicadas"); continue;
      }
      if (item.answer !== verdict.answer) { reject(`gabarito conferido (${verdict.answer}) difere do lido no PDF (${item.answer})`); continue; }
      const fragments = crop.fragments as Fragment[];
      if (fragments.length !== verdict.fragments.length || fragments.some((f, i) => f.sha256 !== verdict.fragments[i])) {
        reject("os recortes mudaram depois da conferência"); continue;
      }
      const source = closed(item.source, ["examId", "examSha256", "answerKeyId", "answerKeySha256", "answerKeyDefinitive", "answerKeyPage", "answerKeyVariant"], "Procedência");
      const itemKeyDoc = catalog.get(source.answerKeyId as string);
      if (!itemKeyDoc || itemKeyDoc.kind !== "ANSWER_KEY" || itemKeyDoc.sha256 !== source.answerKeySha256 ||
        itemKeyDoc.year !== exam.year || itemKeyDoc.modality !== exam.modality) {
        reject("gabarito do item não corresponde ao catálogo"); continue;
      }
      if (!keySource) {
        keyDoc = itemKeyDoc;
        keySource = await verifySource(client, itemKeyDoc, review.reviewer,
          finalityOf(itemKeyDoc, source.answerKeyDefinitive === true, input.finality));
      } else if (itemKeyDoc.id !== keyDoc!.id) { reject("itens da mesma prova com gabaritos diferentes"); continue; }
      const keyPage = Number.isInteger(source.answerKeyPage) ? source.answerKeyPage as number : 1;
      if (keyPage < 1 || keyPage > keySource.pageCount) { reject("página do gabarito fora do arquivo"); continue; }

      // Imagens primeiro: arquivo íntegro, igual ao conferido.
      const images = [];
      for (const fragment of fragments) {
        const bytes = await input.readCrop(fragment.file);
        const stored = await storeAsset(client, bytes);
        if (stored.sha256 !== fragment.sha256) fail(`${verdict.key}: recorte ${fragment.file} difere do manifesto.`, 409);
        images.push({ ...fragment, ...stored });
      }
      const transcription = new Map(((item.options as { letter: string; text: string }[]) ?? []).map((o) => [o.letter, o.text]));
      const options = LETTERS.slice(0, verdict.optionCount).split("").map((letter, position) => ({
        id: letter, text: transcription.get(letter) ?? "", position,
      }));
      const explained = analysis.get(verdict.key);
      const number = item.number as number;
      const content = {
        title: `ENADE ${exam.year} · Questão ${number}`,
        topic: verdict.area,
        prompt: typeof item.prompt === "string" ? item.prompt : "",
        options,
        correctOptionId: verdict.answer,
        explanation: explained?.explanation ?? "",
        explanationCredit: explained
          ? `Explicação gerada por IA (${explained.author}), sem revisão humana`
          : "Sem explicação ainda",
        images: images.map((i) => [i.sha256, i.page, i.box]),
        keySource: keySource.id,
        keyPage,
      };
      const questionId = `official-${exam.sha256.slice(0, 12)}-${verdict.key.toLowerCase()}`;
      await client.query(
        `INSERT INTO editorial_question(id,origin,official_exam_id,official_question_number) VALUES($1,'OFFICIAL',$2,$3)
         ON CONFLICT(id) DO NOTHING`,
        [questionId, examSource.id, number],
      );
      const parent = (
        await client.query<{ officialExamId: string; number: number; currentVersionId: string | null }>(
          `SELECT official_exam_id AS "officialExamId",official_question_number AS number,current_version_id AS "currentVersionId"
           FROM editorial_question WHERE id=$1 FOR UPDATE`,
          [questionId],
        )
      ).rows[0];
      if (parent.officialExamId !== examSource.id || parent.number !== number) fail(`${verdict.key}: identidade da questão diverge.`, 409);
      const current = parent.currentVersionId
        ? (await client.query<{ digest: string | null }>(
            "SELECT assisted_digest AS digest FROM question_version_assisted WHERE version_id=$1",
            [parent.currentVersionId],
          )).rows[0]
        : null;
      const contentDigest = digest(content);
      if (current?.digest === contentDigest) { summary.unchanged.push(verdict.key); continue; }
      const open = await client.query("SELECT 1 FROM question_version WHERE question_id=$1 AND editorial_status<>'PUBLISHED'", [questionId]);
      if (open.rowCount) { reject("há uma versão em edição na curadoria"); continue; }
      const sequence = (
        await client.query<{ next: number }>(
          "SELECT COALESCE(max(version_number),0)+1 AS next FROM question_version WHERE question_id=$1",
          [questionId],
        )
      ).rows[0].next;
      const versionId = `${questionId}-v${sequence}`;
      await client.query(
        `INSERT INTO question_version(id,question_id,version_number,title,topic,prompt,origin,editorial_status,explanation,correct_option_id,
           author_credit,explanation_credit,exam_source_id,key_source_id,source_page,source_question_number,key_page,
           presentation,review_origin,assisted_extractor,assisted_reviewer)
         VALUES($1,$2,$3,$4,$5,$6,'OFFICIAL','DRAFT',$7,$8,'Inep',$9,$10,$11,$12,$13,$14,'IMAGE','ASSISTED',$15,$16)`,
        [versionId, questionId, sequence, content.title, content.topic, content.prompt, content.explanation, content.correctOptionId,
          content.explanationCredit, examSource.id, keySource.id, images[0].page, number, keyPage, review.extractor, review.reviewer],
      );
      for (const option of options)
        await client.query("INSERT INTO question_option(question_id,id,text,position) VALUES($1,$2,$3,$4)",
          [versionId, option.id, option.text, option.position]);
      for (const [index, image] of images.entries())
        await client.query(
          "INSERT INTO question_version_image(version_id,position,asset_sha256,source_page,box,dpi) VALUES($1,$2,$3,$4,$5,$6)",
          [versionId, index + 1, image.sha256, image.page, [image.box.x0, image.box.y0, image.box.x1, image.box.y1], CROP_DPI],
        );
      await client.query(
        "INSERT INTO question_version_assisted(version_id,assisted_digest,reviewed_at,review_notes) VALUES($1,$2,$3,$4)",
        [versionId, contentDigest, review.reviewedAt, verdict.notes],
      );
      await client.query(
        "UPDATE question_version SET editorial_status='PUBLISHED',reviewed_at=clock_timestamp() WHERE id=$1",
        [versionId],
      );
      await client.query("UPDATE editorial_question SET current_version_id=$2 WHERE id=$1", [questionId, versionId]);
      await client.query(
        `INSERT INTO editorial_event(question_id,version_id,agent,event_type,note) VALUES
           ($1,$2,$3,$4,'Transcrição automatizada e recortes do PDF oficial.'),
           ($1,$2,$5,'PUBLISHED',$6)`,
        [questionId, versionId, review.extractor, sequence === 1 ? "CREATED" : "VERSION_CREATED", review.reviewer,
          `Conferida por agente na imagem em ${review.reviewedAt}; sem revisão humana.`],
      );
      if ((await versionImages(versionId, client)).length !== images.length) fail(`${verdict.key}: imagens não registradas.`, 500);
      summary.published.push(verdict.key);
    }
    await client.query("COMMIT");
    return summary;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
