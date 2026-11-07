import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { db } from "./database.js";
import { AREAS } from "./question-areas.js";
import { publicAssetExists } from "./public-assets.js";
import { loadCore } from "./core-concepts.js";
import {
  FORMATS, LETTERS, STIMULI, TEMPLATED, assertionOptions, checkPromptShape, checkSequence, itemsOptions,
  type Format, type Letter,
} from "./generated-formats.js";

// Questões geradas por IA (GEN-1, ver docs/GENERATED-QUESTIONS.md). Cada
// arquivo de data/generated-questions traz as questões de uma área. A carga
// valida forma e qualidade mínima (explicação que começa pela resposta e
// comenta cada alternativa errada, conceito do núcleo da mesma área) e publica
// pelo caminho GENERATED: origem AI_GENERATED, gerador e conferência
// identificados, sem pessoa registrada como revisora. Republicar só cria nova
// versão quando o conteúdo muda.

const ROOT = process.env.STUDY_CONTENT_DIR || path.resolve("data");
const AGENT = /^[a-z][a-z0-9-]{1,39}$/;
export const KINDS = ["ESPELHO", "LACUNA", "QUENTE"] as const;
export const GENERATED_CREDIT = "Gerada por IA (Claude) para o CadernoCC, conferida por nova resolução, sem revisão humana";

export type GeneratedFigure = { src: string; alt: string };
export type GeneratedQuestion = {
  id: string; kind: (typeof KINDS)[number]; format: Format; concepts: string[];
  title: string; subject: string; prompt: string; options: string[]; answer: Letter;
  explanation: string; check: string; stimulus: (typeof STIMULI)[number][]; figure: GeneratedFigure | null;
};
export type GeneratedFile = { area: string; generator: string; checker: string; questions: GeneratedQuestion[] };
export type GeneratedSummary = { file: string; published: string[]; kept: string[] };

const text = (value: unknown, where: string, max: number) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${where}: texto inválido.`);
  return value.trim();
};

/** Forma e qualidade mínima de uma questão; os conceitos são conferidos à parte, contra o núcleo. */
export function parseGeneratedQuestion(data: any, where: string): GeneratedQuestion {
  if (!/^gen-[a-z0-9-]{3,60}$/.test(data?.id)) throw new Error(`${where}: id inválido.`);
  if (!KINDS.includes(data.kind)) throw new Error(`${where}: tipo inválido.`);
  if (!FORMATS.includes(data.format)) throw new Error(`${where}: formato inválido.`);
  if (!Array.isArray(data.concepts) || !data.concepts.length || data.concepts.length > 4) throw new Error(`${where}: conceitos inválidos.`);
  const { options, answer } = answerOf(data, where);
  const explanation = text(data.explanation, `${where}.explanation`, 6000);
  if (!explanation.startsWith(`Resposta: ${answer}.`)) throw new Error(`${where}: a explicação começa por "Resposta: ${answer}."`);
  for (const letter of LETTERS.filter((l) => l !== answer))
    if (!new RegExp(`(^|\\n)${letter}\\) `).test(explanation)) throw new Error(`${where}: a explicação não comenta a alternativa ${letter}.`);
  const prompt = text(data.prompt, `${where}.prompt`, 8000);
  checkPromptShape(prompt, data.format, where);
  if (/—/.test(prompt + explanation + options.join(""))) throw new Error(`${where}: sem travessão (—).`);
  return {
    id: data.id, kind: data.kind, format: data.format, concepts: data.concepts.map(String),
    title: text(data.title, `${where}.title`, 200), subject: text(data.subject, `${where}.subject`, 80),
    prompt, options, answer, explanation, check: text(data.check, `${where}.check`, 600),
    stimulus: stimulusOf(data.stimulus, where), figure: placedFigure(prompt, data.figure, where),
  };
}

/** A linha "[figura]" marca onde a figura entra; sem figura, o marcador não pode ficar no texto. */
function placedFigure(prompt: string, value: unknown, where: string) {
  const figure = figureOf(value, where);
  const markers = prompt.match(/^\[figura\]$/gm)?.length ?? 0;
  if (markers > 1 || (markers === 1 && !figure)) throw new Error(`${where}: "[figura]" aparece uma vez e só com figura.`);
  return figure;
}

/** Alternativas e gabarito: do molde (itens, asserção) ou escritos no arquivo (demais formas). */
function answerOf(data: any, where: string): { options: string[]; answer: Letter } {
  if (TEMPLATED.includes(data.format)) {
    if (data.options !== undefined || data.answer !== undefined)
      throw new Error(`${where}: ${data.format} usa o molde da prova; não escreva options nem answer.`);
    return data.format === "ASSERCAO" ? assertionOptions(data, where) : itemsOptions(data, data.format, where);
  }
  if (!Array.isArray(data.options) || data.options.length !== 5) throw new Error(`${where}: são cinco alternativas.`);
  const options = data.options.map((o: unknown, i: number) => text(o, `${where}.options[${i}]`, 600));
  if (new Set(options).size !== 5) throw new Error(`${where}: alternativas repetidas.`);
  if (!LETTERS.includes(data.answer)) throw new Error(`${where}: gabarito inválido.`);
  if (data.format === "ORDEM") checkSequence(options, where);
  return { options, answer: data.answer };
}

function stimulusOf(value: unknown, where: string) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((s) => !(STIMULI as readonly string[]).includes(s)) || new Set(value).size !== value.length)
    throw new Error(`${where}: estímulo inválido.`);
  return value as (typeof STIMULI)[number][];
}

/** Figura do enunciado: SVG feito a partir dos dados ou ilustração do catálogo, sempre com texto alternativo. */
function figureOf(value: any, where: string): GeneratedFigure | null {
  if (value === undefined || value === null) return null;
  if (!/^\/(figures|illustrations)\/[A-Za-z0-9-]+\.(svg|webp)$/.test(value?.src)) throw new Error(`${where}: figura inválida.`);
  const alt = text(value.alt, `${where}.figure.alt`, 600);
  if (alt.length < 20) throw new Error(`${where}: o texto alternativo da figura descreve o que ela mostra.`);
  if (!publicAssetExists(value.src)) throw new Error(`${where}: arquivo da figura não encontrado (${value.src}).`);
  return { src: value.src, alt };
}

export function parseGeneratedFile(data: any, where: string): GeneratedFile {
  if (!(AREAS as readonly string[]).includes(data?.area)) throw new Error(`${where}: área inválida.`);
  if (!AGENT.test(data.generator) || !AGENT.test(data.checker)) throw new Error(`${where}: gerador ou conferência inválidos.`);
  if (!Array.isArray(data.questions) || !data.questions.length) throw new Error(`${where}: sem questões.`);
  const questions = data.questions.map((q: any, i: number) => parseGeneratedQuestion(q, `${where}.questions[${i}]`));
  if (new Set(questions.map((q: GeneratedQuestion) => q.id)).size !== questions.length) throw new Error(`${where}: ids repetidos.`);
  return { area: data.area, generator: data.generator, checker: data.checker, questions };
}

/** Todo conceito citado existe no núcleo e pertence à área do arquivo. */
export async function checkConcepts(file: GeneratedFile, where: string) {
  const core = await loadCore();
  const area = core.areas.find((a) => a.area === file.area);
  if (!area) throw new Error(`${where}: área sem núcleo.`);
  const ids = new Set(area.concepts.map((c) => c.id));
  for (const q of file.questions)
    for (const c of q.concepts) if (!ids.has(c)) throw new Error(`${where}.${q.id}: conceito ${c} não é de ${file.area}.`);
}

export async function generatedFiles() {
  const dir = path.join(ROOT, "generated-questions");
  return (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith(".json")).sort().map((n) => path.join(dir, n));
}

export async function readGeneratedFile(file: string) {
  const parsed = parseGeneratedFile(JSON.parse(await readFile(file, "utf8")), path.basename(file));
  await checkConcepts(parsed, path.basename(file));
  return parsed;
}

export function contentDigest(area: string, q: GeneratedQuestion) {
  const { check: _check, ...content } = q;
  return createHash("sha256").update(JSON.stringify({ area, ...content })).digest("hex");
}

async function publishOne(client: PoolClient, file: GeneratedFile, q: GeneratedQuestion) {
  const digest = contentDigest(file.area, q);
  const current = (await client.query<{ digest: string }>(
    `SELECT g.content_digest AS digest FROM editorial_question c JOIN generated_question g ON g.version_id=c.current_version_id
     WHERE c.id=$1`, [q.id],
  )).rows[0];
  if (current?.digest === digest) return false;
  await client.query("INSERT INTO editorial_question(id,origin) VALUES($1,'AI_GENERATED') ON CONFLICT(id) DO NOTHING", [q.id]);
  const sequence = (await client.query<{ next: number }>(
    "SELECT COALESCE(max(version_number),0)+1 AS next FROM question_version WHERE question_id=$1", [q.id],
  )).rows[0].next;
  const versionId = `${q.id}-v${sequence}`;
  await client.query(
    `INSERT INTO question_version(id,question_id,version_number,title,topic,prompt,origin,editorial_status,explanation,
       correct_option_id,author_credit,explanation_credit,presentation,review_origin,assisted_extractor,assisted_reviewer,subject)
     VALUES($1,$2,$3,$4,$5,$6,'AI_GENERATED','DRAFT',$7,$8,$9,$9,'TEXT','GENERATED',$10,$11,$12)`,
    [versionId, q.id, sequence, q.title, file.area, q.prompt, q.explanation, q.answer, GENERATED_CREDIT,
      file.generator, file.checker, q.subject],
  );
  for (const [position, option] of q.options.entries())
    await client.query("INSERT INTO question_option(question_id,id,text,position) VALUES($1,$2,$3,$4)",
      [versionId, LETTERS[position], option, position]);
  await client.query(
    `INSERT INTO generated_question(version_id,kind,item_format,concept_ids,content_digest,check_note,stimulus,figure_src,figure_alt)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [versionId, q.kind, q.format, q.concepts, digest, q.check, q.stimulus, q.figure?.src ?? null, q.figure?.alt ?? null],
  );
  await client.query("UPDATE question_version SET editorial_status='PUBLISHED',reviewed_at=clock_timestamp() WHERE id=$1", [versionId]);
  await client.query("UPDATE editorial_question SET current_version_id=$2 WHERE id=$1", [q.id, versionId]);
  await client.query(
    `INSERT INTO editorial_event(question_id,version_id,agent,event_type,note) VALUES
       ($1,$2,$3,$4,'Questão gerada por IA a partir do núcleo da área.'),
       ($1,$2,$5,'PUBLISHED',$6)`,
    [q.id, versionId, file.generator, sequence === 1 ? "CREATED" : "VERSION_CREATED", file.checker,
      `Conferida por nova resolução sem o gabarito; sem revisão humana. ${q.check}`.slice(0, 1000)],
  );
  return true;
}

/** Publica um arquivo numa transação: ou todas as mudanças entram, ou nenhuma. */
export async function publishGeneratedFile(filePath: string): Promise<GeneratedSummary> {
  const file = await readGeneratedFile(filePath);
  const summary: GeneratedSummary = { file: path.basename(filePath), published: [], kept: [] };
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const q of file.questions) (await publishOne(client, file, q) ? summary.published : summary.kept).push(q.id);
    await client.query("COMMIT");
    return summary;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const describeGenerated = (s: GeneratedSummary) =>
  `${s.file}: ${s.published.length} publicadas ou atualizadas, ${s.kept.length} já estavam iguais.`;

/** Figura de uma versão gerada, para a tela da questão; oficiais não têm. */
export async function generatedFigure(versionId: string): Promise<GeneratedFigure | null> {
  const row = (await db.query<{ src: string | null; alt: string | null }>(
    "SELECT figure_src AS src, figure_alt AS alt FROM generated_question WHERE version_id=$1", [versionId],
  )).rows[0];
  return row?.src && row.alt ? { src: row.src, alt: row.alt } : null;
}
