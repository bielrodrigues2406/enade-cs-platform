import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Núcleo por área (NUC-1, ver docs/CORE-CONCEPTS.md): o que é preciso saber
// em cada área para resolver e para cortar alternativas. O conteúdo fica em
// data/core-concepts; cada conceito traz palavras-chave que o ligam às
// questões oficiais do inventário (data/study-analysis), pelo assunto
// registrado na conferência. A ligação é reproduzível e testada: toda questão
// oficial da área precisa cair em pelo menos um conceito.

const ROOT = process.env.STUDY_CONTENT_DIR || path.resolve("data");
const ID = /^[a-z0-9-]{3,80}$/;
export const TRAP_PATTERNS = ["VIZINHO", "PAR", "INVERTIDA", "GRANDEZA", "CONDICAO", "ABSOLUTO", "CAUSA"] as const;
export type TrapPattern = (typeof TRAP_PATTERNS)[number];
export const FORMACAO_GERAL = "Formação Geral";

export type Concept = { id: string; name: string; definition: string; example: string; match: string[] };
export type CoreArea = {
  slug: string; area: string; title: string; summary: string; deck: string | null; sheet: string | null;
  concepts: Concept[]; facts: string[];
  pairs: { a: string; b: string; difference: string }[];
  cues: { cue: string; concept: string }[];
  traps: { pattern: TrapPattern; text: string }[];
  references: string[];
};
/** Questão oficial ligada a um conceito: id publicado, ano e assunto. */
export type LinkedQuestion = { id: string; year: number; subject: string };
export type AreaHistory = { editions: { year: number; count: number }[]; total: number };

const text = (value: unknown, where: string, max: number) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${where}: texto inválido.`);
  return value.trim();
};
const list = <T>(value: unknown, where: string, max: number, item: (v: any, w: string) => T): T[] => {
  if (!Array.isArray(value) || !value.length || value.length > max) throw new Error(`${where}: lista inválida.`);
  return value.map((v, i) => item(v, `${where}[${i}]`));
};
const optionalSlug = (value: unknown, where: string) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !ID.test(value)) throw new Error(`${where}: identificador inválido.`);
  return value;
};

/** Sem acento e em minúsculas, para casar palavras-chave com o assunto. */
export const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Palavra-chave casa quando começa no início de uma palavra do assunto. */
/**
 * Ligações conferidas (data/study-analysis/concept-links.json): questão oficial ->
 * conceitos que ela cobra. Recusa questão ou conceito desconhecido e questão sem conceito.
 */
export function parseConceptLinks(data: any, itemIds: Set<string>, conceptIds: Set<string>) {
  const links = new Map<string, string[]>();
  if (!data?.links || typeof data.links !== "object") throw new Error("concept-links: falta links.");
  for (const [id, entry] of Object.entries<any>(data.links)) {
    if (!itemIds.has(id)) throw new Error(`concept-links: questão desconhecida ${id}.`);
    const concepts = entry?.concepts;
    if (!Array.isArray(concepts) || !concepts.length) throw new Error(`concept-links: ${id} sem conceito.`);
    for (const c of concepts) if (!conceptIds.has(c)) throw new Error(`concept-links: ${id} cita conceito desconhecido ${c}.`);
    if (new Set(concepts).size !== concepts.length) throw new Error(`concept-links: ${id} repete conceito.`);
    links.set(id, concepts);
  }
  return links;
}

/** Sugestão por palavra-chave para ligar uma questão nova; a ligação valendo é a conferida. */
export function matches(concept: Concept, subject: string) {
  const target = normalize(subject);
  return concept.match.some((key) => new RegExp(`(?<![a-z0-9])${normalize(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(target));
}

export function parseCoreArea(data: any, where: string): CoreArea {
  if (!ID.test(data?.slug)) throw new Error(`${where}: slug inválido.`);
  const concepts = list(data.concepts, `${where}.concepts`, 20, (c, w) => {
    if (!ID.test(c?.id)) throw new Error(`${w}: id inválido.`);
    return {
      id: c.id, name: text(c.name, `${w}.name`, 120), definition: text(c.definition, `${w}.definition`, 600),
      example: text(c.example, `${w}.example`, 400), match: list(c.match, `${w}.match`, 20, (k, kw) => text(k, kw, 60)),
    };
  });
  const ids = new Set(concepts.map((c) => c.id));
  if (ids.size !== concepts.length) throw new Error(`${where}: conceitos repetidos.`);
  return {
    slug: data.slug, area: text(data.area, `${where}.area`, 60), title: text(data.title, `${where}.title`, 80),
    summary: text(data.summary, `${where}.summary`, 400),
    deck: optionalSlug(data.deck, `${where}.deck`), sheet: optionalSlug(data.sheet, `${where}.sheet`),
    concepts,
    facts: list(data.facts, `${where}.facts`, 16, (f, w) => text(f, w, 300)),
    pairs: list(data.pairs, `${where}.pairs`, 10, (p, w) => ({
      a: text(p?.a, `${w}.a`, 80), b: text(p?.b, `${w}.b`, 80), difference: text(p?.difference, `${w}.difference`, 300),
    })),
    cues: list(data.cues, `${where}.cues`, 12, (c, w) => {
      if (!ids.has(c?.concept)) throw new Error(`${w}: conceito inexistente.`);
      return { cue: text(c.cue, `${w}.cue`, 120), concept: c.concept };
    }),
    traps: list(data.traps, `${where}.traps`, 10, (t, w) => {
      if (!TRAP_PATTERNS.includes(t?.pattern)) throw new Error(`${w}: padrão de pegadinha inválido.`);
      return { pattern: t.pattern, text: text(t.text, `${w}.text`, 300) };
    }),
    references: list(data.references, `${where}.references`, 8, (r, w) => text(r, w, 200)),
  };
}

type Occurrence = {
  document: string; key: string; kind: string; block: string; scope: string; annulled: boolean;
  reviewStatus: string; reviewFile: string | null; catalogArea: string | null; catalogSubject: string | null;
};
/** Questão oficial objetiva de Bacharelado ou caderno comum, válida e conferida. */
export type OfficialItem = { id: string; year: number; area: string; subject: string };

/** Mesmo id que a publicação assistida grava: official-<sha12 da prova>-<chave>. */
export async function officialItems(): Promise<OfficialItem[]> {
  const inventory = JSON.parse(await readFile(path.join(ROOT, "study-analysis", "inventory.json"), "utf8"));
  const shaOf = new Map<string, string>();
  const items: OfficialItem[] = [];
  for (const o of inventory.occurrences as Occurrence[]) {
    if (o.kind !== "OBJECTIVE" || o.scope !== "CC_DOCUMENT_SCOPE" || o.annulled) continue;
    if (o.document.includes("licenciatura") || o.reviewStatus !== "APPROVED_IN_FILE" || !o.reviewFile || !o.catalogSubject) continue;
    if (!shaOf.has(o.reviewFile)) {
      const review = JSON.parse(await readFile(path.resolve(ROOT, "..", o.reviewFile), "utf8"));
      shaOf.set(o.reviewFile, String(review.examSha256));
    }
    const area = o.block === "FORMACAO_GERAL" ? FORMACAO_GERAL : o.catalogArea;
    if (!area) continue;
    items.push({
      id: `official-${shaOf.get(o.reviewFile)!.slice(0, 12)}-${o.key.toLowerCase()}`,
      year: Number(o.document.split("-")[1]), area, subject: o.catalogSubject,
    });
  }
  return items;
}

export type CoreCatalog = {
  areas: CoreArea[];
  links: Map<string, LinkedQuestion[]>;
  history: Map<string, AreaHistory>;
};

let cache: Promise<CoreCatalog> | null = null;

/** Lido uma vez: o núcleo e o inventário só mudam com novo deploy. */
export function loadCore(): Promise<CoreCatalog> {
  cache ??= buildCore().catch((error) => { cache = null; throw error; });
  return cache;
}

async function buildCore(): Promise<CoreCatalog> {
  const dir = path.join(ROOT, "core-concepts");
  const names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  const areas = await Promise.all(names.map(async (name) =>
    parseCoreArea(JSON.parse(await readFile(path.join(dir, name), "utf8")), name)));
  const seen = new Set<string>();
  for (const area of areas) for (const c of area.concepts) {
    if (seen.has(c.id)) throw new Error(`Conceito repetido entre áreas: ${c.id}.`);
    seen.add(c.id);
  }
  const items = await officialItems();
  const verified = parseConceptLinks(
    JSON.parse(await readFile(path.join(ROOT, "study-analysis", "concept-links.json"), "utf8")),
    new Set(items.map((i) => i.id)), seen);
  const links = new Map<string, LinkedQuestion[]>();
  const history = new Map<string, AreaHistory>();
  for (const area of areas) {
    const ofArea = items.filter((i) => i.area === area.area);
    // Ligações conferidas item a item (R4); podem atravessar áreas, como FG em Sociedade e ética.
    for (const concept of area.concepts) {
      links.set(concept.id, items.filter((i) => verified.get(i.id)?.includes(concept.id))
        .map(({ id, year, subject }) => ({ id, year, subject })).sort((a, b) => b.year - a.year));
    }
    const years = [...new Set(items.map((i) => i.year))].sort();
    history.set(area.slug, {
      editions: years.map((year) => ({ year, count: ofArea.filter((i) => i.year === year).length })),
      total: ofArea.length,
    });
  }
  return { areas: areas.sort((a, b) => (history.get(b.slug)!.total - history.get(a.slug)!.total)), links, history };
}
