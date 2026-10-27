import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { curator, object, revision, text, transaction } from "./editorial.js";
import { createEditorialDraft } from "./curation.js";
import { readArchive, sourceById, sourceFields, type Source } from "./source-store.js";
import { sourceCatalog, type CatalogDocument } from "./source-catalog.js";
export type { CatalogDocument } from "./source-catalog.js";

type Content = {
  title: string; topic: string; prompt: string;
  options: { id: string; text: string }[];
  correctOptionId: string; explanation: string; explanationCredit: string;
  keyPage: number | null;
};
type Intake = {
  id: string; examSourceId: string; keySourceId: string | null;
  sourceKey: string; number: number; kind: string; pages: number[];
  raw: Record<string, unknown>; extraction: Record<string, unknown>;
  machineDigest: string; content: Content;
  assistedReview: Record<string, unknown>; flags: string[]; resolvedFlags: string[];
  state: "PENDING" | "HOLD" | "DRAFTED"; revision: number;
  lastEditor: string | null; draftedVersionId: string | null;
};
type Review = Record<string, unknown> & {
  key: string; examId: string; examSha256: string; topic: string; explanation: string;
  notes: string[]; issues: { code: string; note: string }[];
  disposition: string;
};
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const SHA = /^[a-f0-9]{64}$/;
const KEY = /^[QD][1-9][0-9]{0,3}$/;
const fields = `i.id,i.exam_source_id AS "examSourceId",i.key_source_id AS "keySourceId",i.source_key AS "sourceKey",i.question_number AS number,i.kind,i.pages,i.original_raw AS raw,i.extraction,i.machine_digest AS "machineDigest",i.content,i.assisted_review AS "assistedReview",i.flags,i.resolved_flags AS "resolvedFlags",i.state,i.revision,i.last_editor_id AS "lastEditor",i.drafted_version_id AS "draftedVersionId"`;

function closed(value: unknown, names: string[]) {
  const input = object(value);
  if (Object.keys(input).some((key) => !names.includes(key)))
    fail("Há campos desconhecidos nos dados de importação.", 400);
  return input;
}
function integer(value: unknown, max: number, name: string, min = 1): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max)
    fail(`${name} inválido.`, 400);
  return value as number;
}
function strings(value: unknown, name: string, maxItems = 100, maxLength = 160): string[] {
  if (!Array.isArray(value) || value.length > maxItems)
    fail(`${name} inválidos.`, 400);
  return (value as unknown[]).map((v) => text(v, name, maxLength));
}
function optionalText(value: unknown, name: string, max: number) {
  return value === undefined || value === null ? "" : text(value, name, max, 0);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    return `{${Object.keys(input).sort().map((key) => `${JSON.stringify(key)}:${canonical(input[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");

function catalogBinding(exam: CatalogDocument, key: CatalogDocument) {
  if (exam.family !== key.family) fail("A família do gabarito não corresponde à prova.", 400);
  if (exam.family === "PND") {
    const examType = /-pv-(\d+)$/.exec(exam.id)?.[1];
    const keyType = /-gb-(\d+)$/.exec(key.id)?.[1];
    if (!examType || examType !== keyType) fail("O tipo de gabarito não corresponde ao caderno da PND.", 400);
  }
}

function editable(value: unknown): Content {
  const input = closed(value, ["title", "topic", "prompt", "options", "correctOptionId", "explanation", "explanationCredit", "keyPage"]);
  if (!Array.isArray(input.options) || input.options.length > 5)
    fail("Use até cinco alternativas na fila de importação.", 400);
  const options = (input.options as unknown[]).map((value) => {
    const item = closed(value, ["id", "text"]);
    const id = text(item.id, "Identificador da alternativa", 1);
    if (!/^[A-E]$/.test(id)) fail("Alternativa inválida.", 400);
    return { id, text: text(item.text, "Alternativa", 4000, 0) };
  });
  if (new Set(options.map((o) => o.id)).size !== options.length)
    fail("Alternativas repetidas.", 400);
  const correctOptionId = text(input.correctOptionId, "Gabarito", 1, 0);
  if (correctOptionId && !/^[A-E]$/.test(correctOptionId)) fail("Gabarito inválido.", 400);
  return {
    title: text(input.title, "Título", 160),
    topic: text(input.topic, "Assunto", 80, 0),
    prompt: text(input.prompt, "Enunciado", 24000, 0),
    options, correctOptionId,
    explanation: text(input.explanation, "Explicação", 4000, 0),
    explanationCredit: text(input.explanationCredit, "Crédito da análise", 160, 0),
    keyPage: input.keyPage == null ? null : integer(input.keyPage, 1000, "Página do gabarito"),
  };
}

async function detail(id: string, client?: PoolClient) {
  if (!UUID.test(id)) fail("Importação não encontrada.", 404);
  const connection = client ?? db;
  const row = (await connection.query<Intake>(`SELECT ${fields} FROM question_intake i WHERE i.id=$1`, [id])).rows[0];
  if (!row) fail("Importação não encontrada.", 404);
  const source = await sourceById(row.examSourceId, client);
  const answerKey = row.keySourceId ? await sourceById(row.keySourceId, client) : null;
  const events = (await connection.query(
    `SELECT event_type AS type,revision,note,created_at AS "createdAt",actor_id IS NOT NULL AS "byCurator" FROM question_intake_event WHERE intake_id=$1 ORDER BY id`, [id],
  )).rows;
  const metadata = (s: Source) => ({ id: s.id, title: s.title, year: s.year, area: s.area, modality: s.modality, status: s.status, pageCount: s.pageCount, sha256: s.sha256, isFinal: s.isFinal });
  const { machineDigest: _, lastEditor: __, ...view } = row;
  return { ...view, title: row.content.title, year: source.year, modality: source.modality,
    assistedReviewStatus: row.assistedReview.status, source: metadata(source),
    answerKey: answerKey ? metadata(answerKey) : null, events };
}
async function locked(client: PoolClient, id: string, expected: number, retryDraft = false) {
  if (!UUID.test(id)) fail("Importação não encontrada.", 404);
  const row = (await client.query<Intake>(`SELECT ${fields} FROM question_intake i WHERE i.id=$1 FOR UPDATE`, [id])).rows[0];
  if (!row) fail("Importação não encontrada.", 404);
  if (row.revision !== expected && !(retryDraft && row.state === "DRAFTED" && row.revision === expected + 1))
    fail("A importação mudou. Reabra antes de continuar; seu texto local foi preservado.", 409);
  return row;
}
async function event(client: PoolClient, id: string, actor: string | null, type: string, rev: number, note: string | null) {
  await client.query("INSERT INTO question_intake_event(intake_id,actor_id,event_type,revision,note) VALUES($1,$2,$3,$4,$5)", [id, actor, type, rev, note]);
}

@Controller("api/curation/imports")
export class QuestionImportsController {
  @Get() async list(@Req() req: any, @Query() query: Record<string, unknown>) {
    await curator(req);
    const input = closed(query, ["offset", "limit", "state"]);
    const parse = (v: unknown, fallback: number, max: number) => v === undefined ? fallback :
      typeof v === "string" && /^\d{1,7}$/.test(v) ? integer(Number(v), max, "Paginação", 0) : fail("Paginação inválida.", 400);
    const offset = parse(input.offset, 0, 1000000), limit = parse(input.limit, 25, 50);
    if (!limit) fail("Limite inválido.", 400);
    const state = input.state ?? null;
    if (state !== null && !["PENDING", "HOLD", "DRAFTED"].includes(state as string)) fail("Estado inválido.", 400);
    const counts: Record<string, number> = { PENDING: 0, HOLD: 0, DRAFTED: 0 };
    for (const row of (await db.query("SELECT state,count(*)::int AS count FROM question_intake GROUP BY state")).rows) counts[row.state] = row.count;
    const total = state ? counts[state as string] : Object.values(counts).reduce((a, b) => a + b, 0);
    const items = (await db.query(
      `SELECT i.id,i.source_key AS "sourceKey",i.question_number AS number,i.kind,i.state,i.revision,i.content->>'title' AS title,s.year,s.modality,i.flags,i.resolved_flags AS "resolvedFlags",(SELECT count(*)::int FROM unnest(i.flags) f WHERE NOT f=ANY(i.resolved_flags)) AS "unresolvedCount",i.assisted_review->>'status' AS "assistedReviewStatus",i.drafted_version_id AS "draftedVersionId" FROM question_intake i JOIN source_document s ON s.id=i.exam_source_id WHERE ($1::text IS NULL OR i.state=$1) ORDER BY s.year DESC,s.modality,i.question_number,i.source_key,i.id LIMIT $2 OFFSET $3`, [state, limit, offset],
    )).rows;
    return { items, total, offset, limit, counts };
  }
  @Get(":id") async get(@Req() req: any, @Param("id") id: string) {
    await curator(req);
    return detail(id);
  }
  @Put(":id") async edit(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    const input = closed(body, ["baseRevision", "content", "resolvedFlags", "note", "keySourceId", "pages"]);
    const expected = revision(input), content = editable(input.content);
    const resolved = strings(input.resolvedFlags, "Pendências resolvidas", 100, 160);
    const note = text(input.note, "Nota da conferência", 2000, 8);
    if (new Set(resolved).size !== resolved.length) fail("Pendências repetidas.", 400);
    return transaction(req, async (client, actor) => {
      const row = await locked(client, id, expected);
      if (row.state === "DRAFTED") fail("A questão já foi encaminhada à curadoria.", 409);
      if (resolved.some((flag) => !row.flags.includes(flag))) fail("Pendência desconhecida.", 400);
      const exam = await sourceById(row.examSourceId, client);
      const pages = input.pages === undefined ? row.pages : Array.isArray(input.pages) && input.pages.length <= 1000
        ? [...new Set(input.pages.map((n) => integer(n, exam.pageCount, "Página da questão")))].sort((a, b) => a - b)
        : fail("Páginas inválidas.", 400);
      const keySourceId = input.keySourceId === undefined ? row.keySourceId : input.keySourceId;
      if (keySourceId !== null && (typeof keySourceId !== "string" || !UUID.test(keySourceId))) fail("Gabarito inválido.", 400);
      const key = keySourceId ? await sourceById(keySourceId as string, client) : null;
      const flags = [...row.flags];
      let extraction = row.extraction;
      if (key && (key.kind !== "ANSWER_KEY" || key.status === "REJECTED" || key.year !== exam.year || key.area !== exam.area || key.modality !== exam.modality))
        fail("O gabarito não corresponde à prova.", 400);
      if (keySourceId !== row.keySourceId && key) {
        const catalog = await sourceCatalog();
        const examDocument = catalog.find((d) => d.kind === "EXAM" && d.sha256 === exam.sha256 && d.officialUrl === exam.officialUrl) ?? fail("Prova ausente do catálogo de importação.", 400);
        const keyDocument = catalog.find((d) => d.kind === "ANSWER_KEY" && d.sha256 === key.sha256 && d.officialUrl === key.officialUrl) ?? fail("Gabarito ausente do catálogo de importação.", 400);
        catalogBinding(examDocument, keyDocument);
        await readArchive(key);
        if (examDocument.auxiliary === true || keyDocument.auxiliary === true) {
          if (!flags.includes("FONTE_AUXILIAR_DERIVADA")) flags.push("FONTE_AUXILIAR_DERIVADA");
          extraction = { ...extraction, sourceEvidence: { auxiliary: true, originalBytesAvailable: false,
            exam: { catalogId: examDocument.id, derivation: examDocument.derivation ?? null },
            answerKey: { catalogId: keyDocument.id, derivation: keyDocument.derivation ?? null } } };
        }
      }
      if (content.keyPage !== null && (!key || content.keyPage > key.pageCount))
        fail("Página do gabarito fora do documento.", 400);
      const state = flags.includes("FONTE_AUXILIAR_DERIVADA") || flags.some((flag) => !resolved.includes(flag)) ? "HOLD" : "PENDING";
      await client.query("UPDATE question_intake SET content=$2,resolved_flags=$3,state=$4,last_editor_id=$5,key_source_id=$6,pages=$7,flags=$8,extraction=$9,revision=revision+1,updated_at=now() WHERE id=$1", [id, content, resolved, state, actor, keySourceId, pages, flags, extraction]);
      await event(client, id, actor, "EDITED", expected + 1, note);
      return detail(id, client);
    });
  }
  @Post(":id/draft") @HttpCode(200) async draft(@Req() req: any, @Param("id") id: string, @Body() body: unknown) {
    const input = closed(body, ["baseRevision", "fidelityConfirmed"]), expected = revision(input);
    if (input.fidelityConfirmed !== true) fail("Confirme a fidelidade da transcrição ao PDF antes de continuar.", 400);
    return transaction(req, async (client, actor) => {
      const row = await locked(client, id, expected, true);
      if (row.state === "DRAFTED") {
        const v = (await client.query("SELECT question_id AS \"questionId\" FROM question_version WHERE id=$1", [row.draftedVersionId])).rows[0];
        return { versionId: row.draftedVersionId, questionId: v.questionId };
      }
      if (row.kind !== "OBJECTIVE" || row.raw.status === "anulada" || row.flags.includes("ANULADA"))
        fail("Questões discursivas, anuladas ou sem classificação exigem um fluxo editorial próprio.", 400);
      if (row.flags.includes("fora-escopo-ciencia-computacao"))
        fail("Esta questão pertence a outro curso do caderno compartilhado e permanece arquivada fora da curadoria de Ciência da Computação.", 400);
      if (row.flags.includes("FONTE_AUXILIAR_DERIVADA"))
        fail("Esta questão usa um trecho derivado de uma compilação. Obtenha e confira os documentos originais antes de criar um rascunho oficial.", 400);
      if (row.flags.some((flag) => !row.resolvedFlags.includes(flag))) fail("Resolva e registre as pendências antes de criar o rascunho.", 400);
      if (!row.keySourceId || !row.pages.length || !row.content.keyPage)
        fail("Informe as páginas e o gabarito de origem antes de continuar.", 400);
      const version = await createEditorialDraft(client, actor, {
        ...row.content, origin: "OFFICIAL", authorCredit: "Inep",
        provenance: { examSourceId: row.examSourceId, keySourceId: row.keySourceId, page: row.pages[0], questionNumber: row.number, keyPage: row.content.keyPage },
      });
      await client.query("UPDATE question_intake SET state='DRAFTED',drafted_version_id=$2,fidelity_confirmed_by=$3,fidelity_confirmed_at=now(),last_editor_id=$3,revision=revision+1,updated_at=now() WHERE id=$1", [id, version.id, actor]);
      await event(client, id, actor, "DRAFTED", expected + 1, "Fidelidade ao PDF confirmada pelo curador; rascunho ainda depende de revisão editorial independente.");
      return { versionId: version.id, questionId: version.questionId };
    });
  }
}

function reviews(value: unknown, catalog: Map<string, CatalogDocument>) {
  const map = new Map<string, Review & { author: string }>();
  if (value === undefined) return map;
  const input = closed(value, ["schemaVersion", "origin", "author", "humanReviewed", "items"]);
  if (input.schemaVersion !== 1 || input.origin !== "ASSISTED" || input.humanReviewed !== false || !Array.isArray(input.items) || input.items.length > 2000)
    fail("A revisão importada deve ser assistida, sem aprovação humana.", 400);
  const author = text(input.author, "Autor da análise assistida", 160);
  for (const raw of input.items as unknown[]) {
    const item = closed(raw, ["examId", "examSha256", "key", "topic", "explanation", "notes", "issues", "disposition", "duplicateOf"]);
    const examId = text(item.examId, "Prova da análise", 150), examSha256 = text(item.examSha256, "SHA-256 da análise", 64);
    const key = text(item.key, "Questão da análise", 5), document = catalog.get(examId);
    if (!KEY.test(key) || Number(key.slice(1)) > 1000 || !SHA.test(examSha256) || document?.kind !== "EXAM" || document.sha256 !== examSha256)
      fail("A análise não corresponde ao PDF catalogado.", 400);
    if (!["CONTENT_CHECKED", "MANUAL_REQUIRED"].includes(item.disposition as string) || !Array.isArray(item.issues) || item.issues.length > 50)
      fail("Estado ou pendências da análise inválidos.", 400);
    const issues = (item.issues as unknown[]).map((v) => {
      const issue = closed(v, ["code", "note"]);
      return { code: text(issue.code, "Código da pendência", 100), note: text(issue.note, "Pendência da análise", 2000) };
    });
    if (item.duplicateOf !== undefined) {
      const duplicate = closed(item.duplicateOf, ["examId", "key"]);
      if (!catalog.has(text(duplicate.examId, "Prova equivalente", 150)) || !KEY.test(text(duplicate.key, "Questão equivalente", 5)))
        fail("Referência de questão equivalente inválida.", 400);
    }
    const identity = `${examId}/${key}`;
    if (map.has(identity)) fail("Análises repetidas para a mesma questão.", 400);
    map.set(identity, { ...item, examId, examSha256, key, author,
      topic: text(item.topic, "Assunto da análise", 80, 0), explanation: text(item.explanation, "Explicação assistida", 4000, 0),
      notes: strings(item.notes, "Notas da análise", 60, 2000), issues, disposition: item.disposition as string,
    });
  }
  return map;
}

/** Administrative/offline entry point only. No HTTP endpoint accepts extraction
 * reports. A catalog can be injected by isolated integration tests. */
export async function importQuestionReport(report: unknown, options: {
  actorId?: string; review?: unknown; catalog?: CatalogDocument[];
} = {}) {
  if (Buffer.byteLength(JSON.stringify(report), "utf8") > 8 * 1024 * 1024 ||
      (options.review !== undefined && Buffer.byteLength(JSON.stringify(options.review), "utf8") > 8 * 1024 * 1024))
    fail("Relatório acima do limite de 8 MiB.", 400);
  const documents = options.catalog ?? await sourceCatalog();
  const catalog = new Map<string, CatalogDocument>(documents.map((d: CatalogDocument) => [d.id, d]));
  const input = closed(report, ["document", "completeness", "items", "extraction", "warnings"]);
  const documentId = text(input.document, "Documento", 150), document = catalog.get(documentId) ?? fail("Prova não arquivada no catálogo.", 400);
  if (document.kind !== "EXAM" || !SHA.test(document.sha256 ?? "")) fail("Prova não arquivada no catálogo.", 400);
  const completeness = closed(input.completeness, ["missing", "unexpected"]);
  strings(completeness.missing, "Questões ausentes", 1000, 100);
  strings(completeness.unexpected, "Questões inesperadas", 1000, 100);
  if (input.warnings !== undefined) strings(input.warnings, "Avisos", 100, 2000);
  if (input.extraction !== undefined) object(input.extraction);
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 1000)
    fail("O relatório deve conter de uma a mil questões identificadas.", 400);
  if (options.actorId !== undefined && !UUID.test(options.actorId)) fail("Identidade administrativa inválida.", 400);
  const assisted = reviews(options.review, catalog);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    // Serialize each document's imports, including new rows not yet lockable.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`question-intake/${document.sha256}`]);
    if (options.actorId) {
      const role = await client.query("SELECT c.identity_id FROM curator_role c JOIN account a ON a.identity_id=c.identity_id WHERE c.identity_id=$1 FOR SHARE OF c,a", [options.actorId]);
      if (!role.rowCount) fail("A identidade informada não possui permissão de curadoria.", 403);
    }
    const loaded = new Map<string, Source>();
    async function sourceFor(id: string, sha: string, kind: string) {
      const expected = catalog.get(id) ?? fail("O relatório não corresponde às fontes catalogadas.", 400);
      if (expected.kind !== kind || !SHA.test(sha) || expected.sha256 !== sha)
        fail("O relatório não corresponde às fontes catalogadas.", 400);
      if (loaded.has(id)) return loaded.get(id)!;
      const source = (await client.query<Source>(`SELECT ${sourceFields} FROM source_document WHERE sha256=$1 FOR SHARE`, [sha])).rows[0];
      if (!source || source.kind !== kind || source.status === "REJECTED" || source.officialUrl !== expected.officialUrl || source.year !== expected.year || source.area !== expected.area || source.modality !== expected.modality || (expected.byteSize !== undefined && source.byteSize !== expected.byteSize) || (expected.pageCount !== undefined && source.pageCount !== expected.pageCount))
        fail("Cadastre a fonte correta e confira seus metadados antes de importar questões.", 400);
      await readArchive(source);
      loaded.set(id, source);
      return source;
    }
    const exam = await sourceFor(documentId, document.sha256!, "EXAM");
    const seen = new Set<string>();
    const results = { document: documentId, inserted: 0, updated: 0, unchanged: 0, protected: 0, items: [] as { id: string; sourceKey: string; result: string }[], completeness };
    for (const raw of input.items as unknown[]) {
      const item = closed(raw, ["key", "kind", "number", "block", "pages", "ligatureJoins", "status", "flags", "answer", "prompt", "options", "source", "optionLetters", "courseScope"]);
      if (Buffer.byteLength(JSON.stringify(item), "utf8") > 200000) fail("Questão acima do limite permitido.", 400);
      const key = text(item.key, "Identificador original", 5), number = integer(item.number, 1000, "Número da questão");
      if (!KEY.test(key) || Number(key.slice(1)) !== number || seen.has(key)) fail("Número ou identificador original inválido/repetido.", 400);
      seen.add(key);
      if (!["OBJECTIVE", "DISCURSIVE", "UNKNOWN"].includes(item.kind as string)) fail("Tipo de questão inválido.", 400);
      const kind = item.kind as string;
      if (!Array.isArray(item.pages) || item.pages.length > 1000) fail("Páginas inválidas.", 400);
      const pages = [...new Set((item.pages as unknown[]).map((n) => integer(n, exam.pageCount, "Página da questão")))].sort((a, b) => a - b);
      const flags = strings(item.flags ?? [], "Pendências da extração", 100, 160);
      const status = text(item.status, "Estado da extração", 100);
      optionalText(item.block, "Bloco", 100);
      const courseScope = item.courseScope === undefined ? [] : strings(item.courseScope, "Cursos", 10, 200);
      if (exam.modality === "COMUM") {
        if (!courseScope.length) flags.push("ESCOPO_DO_CURSO_PENDENTE");
        else if (!courseScope.some((course) => /ciencias? da computacao/.test(course.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())))
          flags.push("fora-escopo-ciencia-computacao");
      }
      if (item.ligatureJoins !== undefined) strings(item.ligatureJoins, "Junções tipográficas", 1000, 1000);
      if (typeof item.optionLetters === "string") {
        if (item.optionLetters.length > 1000 || !/^[A-E]*$/.test(item.optionLetters))
          fail("Diagnóstico das letras das alternativas inválido.", 400);
      } else if (item.optionLetters !== undefined) {
        strings(item.optionLetters, "Letras das alternativas", 20, 10);
      }
      const provenance = closed(item.source, ["examId", "examSha256", "answerKeyId", "answerKeySha256", "answerKeyDefinitive", "answerKeyPage", "answerKeyVariant"]);
      if (provenance.examId !== documentId || provenance.examSha256 !== exam.sha256) fail("A questão pertence a outro PDF.", 400);
      const answerKey = provenance.answerKeyId == null ? null : await sourceFor(text(provenance.answerKeyId, "Gabarito", 150), text(provenance.answerKeySha256, "Hash do gabarito", 64), "ANSWER_KEY");
      const keyDocument = answerKey ? catalog.get(provenance.answerKeyId as string)! : null;
      const auxiliary = document.auxiliary === true || keyDocument?.auxiliary === true;
      if (auxiliary) flags.push("FONTE_AUXILIAR_DERIVADA");
      if (answerKey && (answerKey.year !== exam.year || answerKey.area !== exam.area || answerKey.modality !== exam.modality)) fail("O gabarito não corresponde à prova.", 400);
      if (keyDocument) {
        catalogBinding(document, keyDocument);
        if (document.family === "ENADE_LICENCIATURAS" && provenance.answerKeyVariant !== document.variant) {
          flags.push("VARIANTE_DO_GABARITO_PENDENTE");
        }
      }
      if (provenance.answerKeyDefinitive !== undefined && typeof provenance.answerKeyDefinitive !== "boolean") fail("Indicador de gabarito inválido.", 400);
      const analysis = assisted.get(`${documentId}/${key}`);
      if (!analysis) flags.push("REVISAO_ASSISTIDA_PENDENTE");
      if (analysis?.disposition === "MANUAL_REQUIRED" && !analysis.issues.length) flags.push("REVISAO_MANUAL_NECESSARIA");
      flags.push(...(analysis?.issues.map((issue) => issue.code) ?? []));
      if (!pages.length) flags.push("PAGINA_AUSENTE");
      if (!answerKey) flags.push("GABARITO_AUSENTE");
      if (kind !== "OBJECTIVE") flags.push(kind === "DISCURSIVE" ? "DISCURSIVA" : "TIPO_INDEFINIDO");
      if (status === "anulada") flags.push("ANULADA");
      if (!["rascunho", "discursiva", "anulada"].includes(status)) flags.push("CONFERENCIA_MANUAL_DA_EXTRACAO");
      const prompt = optionalText(item.prompt, "Enunciado extraído", 24000);
      const rawOptions = item.options ?? [];
      if (!Array.isArray(rawOptions) || rawOptions.length > 5) fail("Alternativas extraídas inválidas.", 400);
      const choices = (rawOptions as unknown[]).map((v) => {
        const option = closed(v, ["letter", "text"]), id = text(option.letter, "Alternativa", 1);
        if (!/^[A-E]$/.test(id)) fail("Letra extraída inválida.", 400);
        return { id, text: optionalText(option.text, "Alternativa extraída", 4000) };
      });
      if (new Set(choices.map((o) => o.id)).size !== choices.length) fail("Alternativas extraídas repetidas.", 400);
      const answer = optionalText(item.answer, "Gabarito extraído", 100), correctOptionId = /^[A-E]$/.test(answer) ? answer : "";
      if (!prompt) flags.push("ENUNCIADO_AUSENTE");
      if (kind === "OBJECTIVE" && (choices.length < 2 || choices.some((o) => !o.text))) flags.push("ALTERNATIVAS_INCOMPLETAS");
      if (kind === "OBJECTIVE" && (!correctOptionId || !choices.some((o) => o.id === correctOptionId))) flags.push("GABARITO_INCOMPATIVEL");
      const keyPage = provenance.answerKeyPage == null ? answerKey?.pageCount === 1 ? 1 : null : integer(provenance.answerKeyPage, answerKey?.pageCount ?? 0, "Página do gabarito");
      if (!keyPage) flags.push("PAGINA_DO_GABARITO_PENDENTE");
      const content: Content = { title: `${auxiliary ? "Fonte auxiliar · " : ""}${exam.year} · ${exam.modality === "BACHARELADO" ? "Bacharelado" : exam.modality === "LICENCIATURA" ? "Licenciatura" : "Caderno compartilhado"} · ${kind === "DISCURSIVE" ? "Discursiva" : "Questão"} ${number}`,
        topic: analysis?.topic ?? "", prompt, options: choices, correctOptionId, explanation: analysis?.explanation ?? "", explanationCredit: analysis?.author ?? "", keyPage };
      const review = { ...(analysis ?? {}), origin: "ASSISTED", humanReviewed: false, status: analysis?.disposition ?? "NOT_REVIEWED" };
      const uniqueFlags = [...new Set(flags)];
      if (uniqueFlags.length > 100) fail("Há mais de cem pendências nesta questão.", 400);
      const state = uniqueFlags.length ? "HOLD" : "PENDING";
      const extraction = { metadata: input.extraction ?? {}, completeness, warnings: input.warnings ?? [], latestRaw: item,
        ...(auxiliary ? { sourceEvidence: { auxiliary: true, originalBytesAvailable: false,
          exam: { catalogId: document.id, derivation: document.derivation ?? null },
          answerKey: keyDocument ? { catalogId: keyDocument.id, derivation: keyDocument.derivation ?? null } : null } } : {}) };
      const machineDigest = digest({ item, content, review, extraction, flags: uniqueFlags });
      const existing = (await client.query<Intake>(`SELECT ${fields} FROM question_intake i WHERE i.exam_source_id=$1 AND i.source_key=$2 FOR UPDATE`, [exam.id, key])).rows[0];
      let id = existing?.id ?? randomUUID(), result: string;
      if (existing?.machineDigest === machineDigest) { results.unchanged++; result = "unchanged"; }
      else if (existing?.lastEditor || existing?.state === "DRAFTED") { results.protected++; result = "protected"; }
      else if (existing) {
        await client.query("UPDATE question_intake SET key_source_id=$2,kind=$3,pages=$4,extraction=$5,machine_digest=$6,content=$7,assisted_review=$8,flags=$9,resolved_flags='{}',state=$10,revision=revision+1,updated_at=now() WHERE id=$1", [id, answerKey?.id ?? null, kind, pages, extraction, machineDigest, content, review, uniqueFlags, state]);
        await event(client, id, optionsActor(options), "REEXTRACTED", existing.revision + 1, "Nova extração/análise assistida; evidência inicial preservada. Nenhuma aprovação humana atribuída.");
        results.updated++; result = "updated";
      } else {
        await client.query("INSERT INTO question_intake(id,exam_source_id,key_source_id,source_key,question_number,kind,pages,original_raw,extraction,machine_digest,content,assisted_review,flags,state,imported_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)", [id, exam.id, answerKey?.id ?? null, key, number, kind, pages, item, extraction, machineDigest, content, review, uniqueFlags, state, optionsActor(options)]);
        await event(client, id, optionsActor(options), "IMPORTED", 1, "Extração em fila privada; fontes e conteúdo ainda dependem de conferência. Nenhuma aprovação humana atribuída.");
        results.inserted++; result = "inserted";
      }
      results.items.push({ id, sourceKey: key, result });
    }
    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
const optionsActor = (options: { actorId?: string }) => options.actorId ?? null;
