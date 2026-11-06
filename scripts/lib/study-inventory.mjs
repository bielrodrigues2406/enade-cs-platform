import { createHash } from "node:crypto";

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const identity = (document, key) => `${document}:${key}`;
const matchesSource = (document, hash) => typeof document?.sha256 === "string" &&
  /^[a-f0-9]{64}$/.test(document.sha256) && document.sha256 === hash;

function reviewIndex(files, discursive) {
  const index = new Map();
  for (const { file, data } of files) {
    for (const item of data.items) {
      const key = discursive ? String(item.number) : item.key;
      const id = identity(data.document, key);
      if (index.has(id)) throw new Error(`Conferência ativa repetida: ${id}`);
      index.set(id, { file, documentHash: data.examSha256, item });
    }
  }
  return index;
}

function occurrence(document, item, review, issues) {
  const flags = [...(item.flags ?? []), ...issues];
  const annulled = item.status === "anulada" || flags.some((f) => /^(ANULADA_OFICIAL|ANULACAO_PRESERVADA)$/.test(f));
  const outsideCC = flags.some((f) => /^(FORA_ESCOPO|fora-escopo-ciencia-computacao$)/.test(f));
  if (review && review.documentHash !== document.sha256) throw new Error(`Hash da conferência divergente: ${document.id}`);
  const approved = review && (review.item.verdict ?? review.item.decision) === "APPROVED";
  return {
    id: identity(document.id, item.key), document: document.id, key: item.key,
    kind: item.kind, block: item.block, pages: item.pages,
    scope: outsideCC ? "OUTSIDE_CC" : "CC_DOCUMENT_SCOPE",
    annulled, extractionStatus: item.status,
    reviewStatus: approved ? "APPROVED_IN_FILE" : review ? "BLOCKED_IN_FILE" : "NO_ACTIVE_REVIEW",
    reviewFile: review?.file ?? null,
    catalogArea: approved ? review.item.area : null,
    catalogSubject: approved ? review.item.subject : null,
    // O rótulo editorial existente não equivale à nova classificação analítica.
    analysis: { status: "PENDING", topic: null, skill: null, canonicalId: null },
    textFingerprint: sha256(JSON.stringify([item.kind, item.prompt, item.options ?? []])),
  };
}

function componentCoverage(items) {
  const eligible = items.filter((i) => i.scope === "CC_DOCUMENT_SCOPE" && !i.annulled);
  return {
    extracted: items.length,
    outsideCC: items.filter((i) => i.scope === "OUTSIDE_CC").length,
    annulledInCC: items.filter((i) => i.scope === "CC_DOCUMENT_SCOPE" && i.annulled).length,
    eligibleExtracted: eligible.length,
    approvedInFiles: eligible.filter((i) => i.reviewStatus === "APPROVED_IN_FILE").length,
    analysisClassified: 0,
    // Sem classificação conferida, incidência permanece desconhecida, não zero.
    topicIncidence: null,
  };
}

/** Inventário offline: nunca consulta banco, publica conteúdo ou infere equivalência por texto. */
export function buildStudyInventory({ catalog, reports, objectiveReviews, discursiveReviews, analyses = [], annotations = [] }) {
  const documents = new Map(catalog.documents.filter((d) => d.kind === "EXAM").map((d) => [d.id, d]));
  const reviews = reviewIndex(objectiveReviews, false);
  const discursive = reviewIndex(discursiveReviews, true);
  const scopeIssues = new Map();
  const duplicateLinks = [];
  for (const { data } of analyses) for (const item of data.items ?? []) {
    if (!matchesSource(documents.get(item.examId), item.examSha256)) throw new Error(`Hash da análise divergente: ${item.examId}`);
    scopeIssues.set(identity(item.examId, item.key), (item.issues ?? []).map((i) => i.code));
    if (item.duplicateOf) duplicateLinks.push({
      from: identity(item.examId, item.key), to: identity(item.duplicateOf.examId, item.duplicateOf.key),
    });
  }
  for (const note of annotations) {
    if (!note.evidence || !matchesSource(documents.get(note.document), note.examSha256)) throw new Error("Anotação sem evidência/hash compatível");
    const id = identity(note.document, note.key);
    scopeIssues.set(id, [...(scopeIssues.get(id) ?? []), note.code]);
  }
  const occurrences = [];
  const byDocument = new Map();
  const seen = new Set();
  const seenDiscursive = new Set();
  for (const { data: report } of reports) {
    const doc = documents.get(report.document);
    if (!doc) throw new Error(`Relatório fora do catálogo: ${report.document}`);
    if (typeof doc.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(doc.sha256)) throw new Error(`Hash da prova ausente ou inválido: ${doc.id}`);
    if (byDocument.has(doc.id)) throw new Error(`Relatório repetido: ${doc.id}`);
    const items = report.items.map((item) => {
      const id = identity(doc.id, item.key);
      if (seen.has(id)) throw new Error(`Ocorrência repetida: ${id}`);
      seen.add(id);
      if (item.source?.examId !== doc.id || item.source?.examSha256 !== doc.sha256) throw new Error(`Hash/identidade da extração divergente: ${id}`);
      if (!["OBJECTIVE", "DISCURSIVE"].includes(item.kind)) throw new Error(`Tipo inválido: ${id}`);
      const discursiveId = identity(doc.id, String(item.number));
      if (item.kind === "DISCURSIVE") seenDiscursive.add(discursiveId);
      const review = item.kind === "OBJECTIVE" ? reviews.get(id) : discursive.get(discursiveId);
      return occurrence(doc, item, review, scopeIssues.get(id) ?? []);
    });
    occurrences.push(...items);
    byDocument.set(doc.id, { items, completeness: report.completeness });
  }
  for (const id of reviews.keys()) {
    if (!seen.has(id)) throw new Error(`Conferência sem ocorrência: ${id}`);
  }
  for (const id of discursive.keys()) {
    if (!seenDiscursive.has(id)) throw new Error(`Conferência discursiva sem ocorrência: ${id}`);
  }
  const occurrenceMap = new Map(occurrences.map((item) => [item.id, item]));
  for (const note of annotations) {
    if (!seen.has(identity(note.document, note.key))) throw new Error("Anotação sem ocorrência");
  }
  const links = new Map();
  for (const link of duplicateLinks) {
    if (links.has(link.from)) throw new Error("Equivalência de origem repetida");
    if (!occurrenceMap.has(link.from) || !occurrenceMap.has(link.to) ||
        occurrenceMap.get(link.from).kind !== occurrenceMap.get(link.to).kind) throw new Error("Equivalência inválida");
    links.set(link.from, link.to);
  }
  for (const start of links.keys()) {
    const visited = new Set();
    let current = start;
    while (links.has(current)) {
      if (visited.has(current)) throw new Error("Equivalência cíclica");
      visited.add(current);
      current = links.get(current);
    }
  }
  const editions = [...documents.values()].sort((a, b) => a.id.localeCompare(b.id, "en")).map((doc) => {
    const report = byDocument.get(doc.id);
    return {
      document: doc.id, family: doc.family, year: doc.year, modality: doc.modality,
      title: doc.title, officialUrl: doc.officialUrl, sha256: doc.sha256 ?? null,
      acquisitionStatusInCatalog: doc.status,
      reportAvailable: Boolean(report), extractionCompleteness: report?.completeness ?? null,
      // Aquisição de arquivo e cobertura da matriz são estados independentes.
      officialMatrix: "NOT_ACQUIRED",
      components: report ? ["OBJECTIVE", "DISCURSIVE"].flatMap((kind) =>
        [...new Set(report.items.filter((i) => i.kind === kind).map((i) => i.block))].sort().map((block) => ({
          kind, block, ...componentCoverage(report.items.filter((i) => i.kind === kind && i.block === block)),
        }))) : null,
    };
  });
  const fingerprints = new Map();
  for (const item of occurrences) {
    const group = fingerprints.get(item.textFingerprint) ?? [];
    group.push(item.id);
    fingerprints.set(item.textFingerprint, group);
  }
  return {
    schemaVersion: 1,
    scope: "REPOSITORY_FILES_ONLY; not a production inventory or proof of publication; no canonical deduplication or reviewed topic classification",
    totals: {
      documents: editions.length, withReports: reports.length, occurrences: occurrences.length,
      objectiveApprovedInFiles: occurrences.filter((i) => i.kind === "OBJECTIVE" && i.reviewStatus === "APPROVED_IN_FILE").length,
      discursiveApprovedInFiles: occurrences.filter((i) => i.kind === "DISCURSIVE" && i.reviewStatus === "APPROVED_IN_FILE").length,
    },
    editions,
    annotations,
    documentedDuplicateLinks: duplicateLinks,
    occurrences: occurrences.sort((a, b) => a.id.localeCompare(b.id, "en")),
    duplicateCandidates: [...fingerprints.entries()].filter(([, ids]) => ids.length > 1).map(([fingerprint, ids]) => ({
      fingerprint, occurrences: ids.sort(), status: "NEEDS_VISUAL_AND_KEY_REVIEW",
    })).sort((a, b) => a.fingerprint.localeCompare(b.fingerprint, "en")),
  };
}
