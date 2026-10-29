import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { sourceCatalog, type CatalogDocument } from "./source-catalog.js";
import { readArchive, sourceFields, type Source } from "./source-store.js";
import { MAX_IMAGE_BYTES, storeAsset, versionImages, webpSize } from "./question-images.js";

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
  width: number;
  height: number;
  byteSize: number;
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

// These findings concern meaning or a defect in the source. An image approval
// cannot resolve them. Visual/OCR-only warnings may be satisfied by checked crops.
const imageResolvableIssues = new Set([
  "IMAGEM_TEXTO_I_NAO_INTEGRADA", "CHARGE_NAO_INTEGRADA", "MAPA_NAO_INTEGRADO", "CORRIGIR_VERSALETE", "CONFERIR_REFERENCIA",
  "IMAGENS_NAO_INTEGRADAS", "IMAGEM_NAO_INTEGRADA", "FOTOGRAFIA_NAO_INTEGRADA", "GRAFICO_NAO_INTEGRADO",
  "GRAFO_NAO_INTEGRADO", "CIRCUITO_NAO_INTEGRADO", "INFOGRAFICO_OMITIDO", "CONFERIR_RECURSO_VISUAL", "CONFERIR_ALERTA_VISUAL",
  "ALTERNATIVAS_VISUAIS_NAO_INTEGRADAS", "ARVORE_E_TABELA_NAO_INTEGRADAS", "FIGURA_LOGICA_NAO_INTEGRADA",
  "IMAGEM_DO_ENUNCIADO_NAO_INTEGRADA", "IMAGENS_E_ROTULOS_PENDENTES", "FIDELIDADE_OCR_PENDENTE",
  "FORMULAS_DAS_ALTERNATIVAS_AUSENTES", "FORMULAS_DE_INFERENCIA_NAO_PRESERVADAS", "CONFERIR_SIMBOLOS", "CONFERIR_GLIFOS",
]);
const unresolvedIssue = (code: string) => !imageResolvableIssues.has(code);
const materialIssue = (code: string) => /^(?:DEFEITO_|DADOS_E_UNIDADES_|AMBIGUIDADE_|INCONSISTENCIA_|CONVENCAO_|SEMANTICA_SQL_|REDACAO_PSK_|REVISAO_CONCEITUAL_|FORA_ESCOPO|fora-escopo-ciencia-computacao|ANULADA_OFICIAL$|ANULACAO_PRESERVADA$|CONFERIR_CONTEXTO_LEGAL$)/.test(code);
function originalDocument(doc: CatalogDocument) {
  if (doc.auxiliary === true || doc.originalBytesAvailable === false)
    fail("Fontes auxiliares ou sem os bytes originais não podem ser publicadas como oficiais.", 400);
}
function itemIndex(value: unknown, label: string) {
  if (!Array.isArray(value) || !value.length || value.length > 1000) fail(`${label} inválido.`, 400);
  const result = new Map<string, Record_>();
  for (const raw of value as unknown[]) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(`${label} inválido.`, 400);
    const item = raw as Record_;
    if (typeof item.key !== "string" || !/^[QD][1-9][0-9]{0,3}$/.test(item.key) || result.has(item.key) ||
        !Number.isInteger(item.number) || item.number !== Number(item.key.slice(1)))
      fail(`${label}: número ou chave inválida/repetida.`, 400);
    result.set(item.key as string, item);
  }
  return result;
}
function pageGeometry(renderer: unknown, count: number) {
  const data = closed(renderer, ["dpi", "format", "lossless", "pdftoppm", "imagemagick", "pages"], "Renderizador");
  if (data.dpi !== CROP_DPI || data.format !== "image/webp" || data.lossless !== true ||
      !Array.isArray(data.pages) || data.pages.length !== count)
    fail("Gere novamente o manifesto com geometria original completa e WebP sem perda a 200 DPI.", 400);
  return (data.pages as unknown[]).map((value, index) => {
    const page = closed(value, ["page", "width", "height"], "Geometria da página");
    if (page.page !== index + 1 || [page.width, page.height].some((n) =>
      typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > 14400))
      fail("Geometria original inválida ou fora de ordem.", 400);
    return page as { page: number; width: number; height: number };
  });
}
function cropFragments(crop: Record_, key: string, pages: { width: number; height: number }[]) {
  if (!Array.isArray(crop.fragments) || !crop.fragments.length || crop.fragments.length > 20)
    fail(`${key}: fragmentos inválidos.`, 400);
  const seen = new Set<string>();
  return (crop.fragments as unknown[]).map((value, index) => {
    const f = closed(value, ["file", "page", "box", "sha256", "width", "height", "byteSize"], "Fragmento");
    if (f.file !== `${key}-${index + 1}.webp` || typeof f.sha256 !== "string" || !SHA.test(f.sha256) ||
        !Number.isInteger(f.page) || (f.page as number) < 1 || (f.page as number) > pages.length ||
        !Number.isInteger(f.byteSize) || (f.byteSize as number) < 1 || (f.byteSize as number) > MAX_IMAGE_BYTES ||
        !Number.isInteger(f.width) || (f.width as number) < 1 || (f.width as number) > 8000 ||
        !Number.isInteger(f.height) || (f.height as number) < 1 || (f.height as number) > 16000)
      fail(`${key}: arquivo, página ou dimensões de fragmento inválidos.`, 400);
    const box = closed(f.box, ["x0", "y0", "x1", "y1"], "Caixa do fragmento");
    if (Object.values(box).length !== 4 || Object.values(box).some((n) => typeof n !== "number" || !Number.isFinite(n)))
      fail(`${key}: caixa do fragmento inválida.`, 400);
    const b = box as Fragment["box"], page = pages[(f.page as number) - 1], scale = CROP_DPI / 72;
    if (b.x0 < 0 || b.y0 < 0 || b.x1 <= b.x0 || b.y1 <= b.y0 ||
        b.x1 > page.width + 0.01 || b.y1 > page.height + 0.01 ||
        Math.abs(Math.round(b.x1 * scale) - Math.round(b.x0 * scale) - (f.width as number)) > 2 ||
        Math.abs(Math.round(b.y1 * scale) - Math.round(b.y0 * scale) - (f.height as number)) > 2)
      fail(`${key}: caixa fora da página ou incompatível com os pixels.`, 400);
    const region = JSON.stringify([f.page, b]);
    if (seen.has(region)) fail(`${key}: fragmento repetido.`, 400);
    seen.add(region);
    return f as unknown as Fragment;
  });
}
function analysisIssues(value: unknown, exam: CatalogDocument, explanations?: Map<string, { explanation: string; author: string }>) {
  const blocked = new Map<string, string[]>();
  if (!value || typeof value !== "object" || Array.isArray(value)) return blocked;
  const data = value as { author?: string; items?: Record_[] };
  if (!Array.isArray(data.items)) return blocked;
  for (const item of data.items) {
    if (item.examId !== exam.id) continue;
    if (item.examSha256 !== exam.sha256) fail("A análise pertence a outra versão da prova.", 400);
    const key = String(item.key);
    const codes = Array.isArray(item.issues) ? item.issues.map((issue) =>
      String((issue as Record_)?.code ?? "")).filter(unresolvedIssue) : [];
    if (codes.length) blocked.set(key, codes);
    if (explanations && typeof item.explanation === "string" && item.explanation.trim())
      explanations.set(key, { explanation: item.explanation, author: String(data.author ?? "IA") });
  }
  return blocked;
}

function finalityOf(keyDoc: CatalogDocument, declared: boolean, finality: unknown) {
  const documents = (finality as { documents?: Record<string, { finality?: string }> })?.documents ?? {};
  const decision = documents[keyDoc.id]?.finality;
  if (decision === "DECLARED" || decision === "ONLY_PUBLISHED") return decision;
  if (declared) return "DECLARED";
  return fail(`${keyDoc.id}: o gabarito não se declara definitivo e não há decisão registrada (D10).`, 400);
}

async function publicationSource(client: PoolClient, doc: CatalogDocument) {
  originalDocument(doc);
  const source = (
    await client.query<Source & { verificationOrigin: string; keyFinality: string | null }>(
      `SELECT ${sourceFields},verification_origin AS "verificationOrigin",key_finality AS "keyFinality" FROM source_document WHERE sha256=$1 FOR UPDATE`,
      [doc.sha256],
    )
  ).rows[0];
  if (!source || source.status === "REJECTED" || source.kind !== doc.kind || source.officialUrl !== doc.officialUrl ||
    source.year !== doc.year || source.modality !== doc.modality || source.area !== doc.area ||
    (doc.byteSize !== undefined && source.byteSize !== doc.byteSize) ||
    (doc.pageCount !== undefined && source.pageCount !== doc.pageCount))
    fail(`${doc.id}: importe a fonte do catálogo antes de publicar (npm run import:sources).`, 409);
  return source;
}

/** Fonte conferida pelo agente: arquivo íntegro e igual ao fixado no catálogo. */
async function verifySource(client: PoolClient, doc: CatalogDocument, agent: string, keyFinality: string | null) {
  const source = await publicationSource(client, doc);
  await readArchive(source);
  if (source.status === "VERIFIED") {
    if (doc.kind === "ANSWER_KEY" && !source.isFinal) fail(`${doc.id}: gabarito conferido sem ser final.`, 409);
    if (doc.kind === "ANSWER_KEY" && (source.keyFinality ?? "DECLARED") !== keyFinality)
      fail(`${doc.id}: a finalidade conferida diverge da decisão registrada; não foi alterada.`, 409);
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
  if (!found || found.kind !== "EXAM" || !found.sha256 || !SHA.test(found.sha256))
    fail("Conferência, relatório e recortes precisam ser da mesma prova catalogada.", 400);
  const exam = found as CatalogDocument & { sha256: string };
  originalDocument(exam);
  if (exam.sha256 !== review.examSha256 ||
    report.document !== exam.id || manifest.document !== exam.id || manifest.examSha256 !== exam.sha256)
    fail("Conferência, relatório e recortes precisam ser da mesma prova catalogada.", 400);
  if (review.manifestSha256 !== input.manifestSha256)
    fail("A conferência foi feita sobre outro manifesto de recortes. Gere os recortes de novo ou refaça a conferência.", 409);
  const completeness = closed(report.completeness, ["missing", "unexpected"], "Completude");
  if (!Array.isArray(completeness.missing) || !Array.isArray(completeness.unexpected))
    fail("Completude inválida.", 400);
  if ((completeness.missing as unknown[]).length || (completeness.unexpected as unknown[]).length)
    fail("A numeração da prova está incompleta; nada é publicado.", 409);
  const reportItems = itemIndex(report.items, "Itens do relatório");
  const crops = itemIndex(manifest.items, "Itens do manifesto");
  const analysis = new Map<string, { explanation: string; author: string }>();
  const issues = analysisIssues(input.analysis, exam, analysis);
  // Omitting --analysis cannot hide known findings already in the repository.
  const reviewedFile = await readFile(path.resolve("data", "question-reviews", `${exam.year}-review.json`), "utf8")
    .catch((error) => { if (error.code === "ENOENT") return ""; throw error; });
  if (reviewedFile) for (const [key, codes] of analysisIssues(JSON.parse(reviewedFile), exam))
    issues.set(key, [...(issues.get(key) ?? []), ...codes]);
  const summary: PublicationSummary = {
    document: exam.id, reviewer: review.reviewer, extractor: review.extractor,
    published: [], unchanged: [], blocked: [], rejected: [],
  };
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`assisted-publication/${exam.sha256}`]);
    const examSource = await publicationSource(client, exam);
    const pages = pageGeometry(manifest.renderer, examSource.pageCount);
    let keyDoc: CatalogDocument | null = null;
    for (const verdict of review.items) {
      if (verdict.verdict === "BLOCKED") {
        summary.blocked.push({ key: verdict.key, reason: verdict.reason });
        continue;
      }
      await client.query("SAVEPOINT assisted_item");
      const item = reportItems.get(verdict.key);
      const crop = crops.get(verdict.key);
      const reject = async (reason: string) => {
        await client.query("ROLLBACK TO SAVEPOINT assisted_item");
        await client.query("RELEASE SAVEPOINT assisted_item");
        summary.rejected.push({ key: verdict.key, reason });
      };
      if (!item || !crop) { await reject("questão ausente do relatório ou do manifesto"); continue; }
      if (crop.number !== item.number || crop.kind !== item.kind ||
          (crop.answer !== undefined && crop.answer !== item.answer)) {
        await reject("identidade do recorte difere da questão"); continue;
      }
      const staged = (await client.query<{ flags: string[]; resolved: string[]; review: { issues?: { code?: string }[] } }>(
        `SELECT flags,resolved_flags AS resolved,assisted_review AS review FROM question_intake
         WHERE exam_source_id=$1 AND source_key=$2 FOR SHARE`, [examSource.id, verdict.key],
      )).rows[0];
      const pending = [...(issues.get(verdict.key) ?? []),
        ...(Array.isArray(item.flags) ? item.flags.filter((flag) => typeof flag === "string" && materialIssue(flag)) : []),
        ...(staged ? [...staged.flags.filter(materialIssue),
          ...(staged.review.issues ?? []).map((issue) => issue.code ?? "").filter(unresolvedIssue)]
          .filter((code) => !staged.resolved.includes(code)) : [])];
      if (pending.length) { await reject(`pendência material não resolvida: ${[...new Set(pending)].join(", ")}`); continue; }
      if (item.kind !== "OBJECTIVE" || ["anulada", "discursiva"].includes(item.status as string)) {
        await reject("só objetivas válidas são publicadas"); continue;
      }
      if (item.answer !== verdict.answer) { await reject(`gabarito conferido (${verdict.answer}) difere do lido no PDF (${item.answer})`); continue; }
      const fragments = cropFragments(crop, verdict.key, pages);
      if (fragments.length !== verdict.fragments.length || fragments.some((f, i) => f.sha256 !== verdict.fragments[i])) {
        await reject("os recortes mudaram depois da conferência"); continue;
      }
      const source = closed(item.source, ["examId", "examSha256", "answerKeyId", "answerKeySha256", "answerKeyDefinitive", "answerKeyPage", "answerKeyVariant"], "Procedência");
      if (source.examId !== exam.id || source.examSha256 !== exam.sha256) {
        await reject("a procedência do item aponta para outra prova"); continue;
      }
      const itemKeyDoc = catalog.get(source.answerKeyId as string);
      if (!itemKeyDoc || itemKeyDoc.kind !== "ANSWER_KEY" || itemKeyDoc.sha256 !== source.answerKeySha256 ||
        itemKeyDoc.year !== exam.year || itemKeyDoc.modality !== exam.modality ||
        itemKeyDoc.area !== exam.area || itemKeyDoc.family !== exam.family) {
        await reject("gabarito do item não corresponde ao catálogo"); continue;
      }
      originalDocument(itemKeyDoc);
      if (exam.family === "PND" && (!/-pv-(\d+)$/.test(exam.id) ||
          /-pv-(\d+)$/.exec(exam.id)![1] !== /-gb-(\d+)$/.exec(itemKeyDoc.id)?.[1])) {
        await reject("o tipo do gabarito PND não corresponde ao caderno"); continue;
      }
      if (exam.family === "ENADE_LICENCIATURAS" &&
          (!exam.variant || source.answerKeyVariant !== exam.variant)) {
        await reject("a variante do gabarito não corresponde ao caderno"); continue;
      }
      if (verdict.optionCount !== (exam.family === "PND" ? 4 : 5)) {
        await reject("a quantidade de alternativas difere do formato do caderno"); continue;
      }
      if (keyDoc && itemKeyDoc.id !== keyDoc.id) { await reject("itens da mesma prova com gabaritos diferentes"); continue; }
      await verifySource(client, exam, review.reviewer, null);
      const keySource = await verifySource(client, itemKeyDoc, review.reviewer,
        finalityOf(itemKeyDoc, source.answerKeyDefinitive === true, input.finality));
      const keyPage = Number.isInteger(source.answerKeyPage) ? source.answerKeyPage as number : 1;
      if (keyPage < 1 || keyPage > keySource.pageCount) { await reject("página do gabarito fora do arquivo"); continue; }

      // Imagens primeiro: arquivo íntegro, igual ao conferido.
      const images = [];
      for (const fragment of fragments) {
        const bytes = await input.readCrop(fragment.file);
        if (bytes.length !== fragment.byteSize || createHash("sha256").update(bytes).digest("hex") !== fragment.sha256)
          fail(`${verdict.key}: recorte ${fragment.file} difere do manifesto.`, 409);
        const size = webpSize(bytes);
        if (size.width !== fragment.width || size.height !== fragment.height)
          fail(`${verdict.key}: dimensões da imagem divergem do manifesto.`, 409);
        const stored = await storeAsset(client, bytes);
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
      if (current?.digest === contentDigest) {
        await client.query("RELEASE SAVEPOINT assisted_item");
        keyDoc = itemKeyDoc;
        summary.unchanged.push(verdict.key); continue;
      }
      const open = await client.query("SELECT 1 FROM question_version WHERE question_id=$1 AND editorial_status<>'PUBLISHED'", [questionId]);
      if (open.rowCount) { await reject("há uma versão em edição na curadoria"); continue; }
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
      await client.query("RELEASE SAVEPOINT assisted_item");
      keyDoc = itemKeyDoc;
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
