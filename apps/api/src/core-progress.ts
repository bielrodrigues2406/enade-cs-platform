import { Body, Controller, Get, HttpCode, Param, Put, Req } from "@nestjs/common";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";
import { areaProgress, type AreaProgress } from "./progress.js";
import { loadDecks } from "./study-content.js";
import { FORMACAO_GERAL, loadCore, type CoreArea } from "./core-concepts.js";
import { loadLessons } from "./core-lessons.js";

// Núcleo por área (NUC-1): conteúdo, autoavaliação e confiança por área.
// A confiança junta três sinais independentes e mostra cada um separado:
// o que a pessoa diz saber, o que ela acerta e o que ela lembra nos cartões.

const STABLE_DAYS = 21;
/** A partir de 5 respostas o acerto da área conta inteiro; antes, proporcionalmente. */
const ENOUGH_ANSWERS = 5;

export type Confidence = {
  value: number;
  self: number; rated: number;
  answers: number | null; attempts: number;
  cards: number | null;
};

export function confidence(area: CoreArea, ratings: Map<string, number>, progress: AreaProgress | undefined, cards: number | null): Confidence {
  const levels = area.concepts.map((c) => ratings.get(c.id));
  const rated = levels.filter((l) => l !== undefined).length;
  const self = levels.reduce<number>((sum, l) => sum + (l ?? 0), 0) / (2 * area.concepts.length);
  const attempts = progress?.firstAttempts ?? 0;
  const answers = attempts ? (progress!.firstCorrect / attempts) * Math.min(1, attempts / ENOUGH_ANSWERS) : null;
  const parts: [number, number][] = [[0.4, self], [0.4, answers ?? 0]];
  if (cards !== null) parts.push([0.2, cards]);
  const weight = parts.reduce((s, [w]) => s + w, 0);
  const value = Math.round((100 * parts.reduce((s, [w, v]) => s + w * v, 0)) / weight);
  const pct = (v: number) => Math.round(100 * v);
  return { value, self: pct(self), rated, answers: answers === null ? null : pct(answers), attempts, cards: cards === null ? null : pct(cards) };
}

async function ratingsOf(owner: string) {
  return new Map((await db.query<{ concept_id: string; level: number }>(
    "SELECT concept_id,level FROM core_concept_rating WHERE identity_id=$1", [owner],
  )).rows.map((r) => [r.concept_id, r.level]));
}

/** Memória média do baralho da área: estabilidade/21 dias, limitada a 1; cartão nunca visto conta 0. */
async function deckMemory(owner: string): Promise<Map<string, number>> {
  const [decks, rows] = await Promise.all([
    loadDecks(),
    db.query<{ card_id: string; stability: number }>("SELECT card_id,stability FROM flashcard_state WHERE identity_id=$1", [owner]),
  ]);
  const stability = new Map(rows.rows.map((r) => [r.card_id, r.stability]));
  return new Map(decks.map((d) => [d.deck,
    d.cards.reduce((sum, c) => sum + Math.min(1, (stability.get(c.id) ?? 0) / STABLE_DAYS), 0) / d.cards.length]));
}

/** Versão publicada de cada questão neste banco (o acervo pode estar incompleto num ambiente). */
async function publishedVersions(ids: string[]) {
  return new Map((await db.query<{ id: string; version: string }>(
    `SELECT q.id,v.id AS version FROM editorial_question q JOIN question_version v ON v.id=q.current_version_id
     WHERE v.editorial_status='PUBLISHED' AND q.id=ANY($1::text[])`, [ids],
  )).rows.map((r) => [r.id, r.version]));
}

/** Questões geradas por IA publicadas, por conceito do núcleo (versão atual). */
async function generatedByConcept(conceptIds: string[]) {
  const rows = (await db.query<{ id: string; title: string; concepts: string[] }>(
    `SELECT v.id,v.title,g.concept_ids AS concepts FROM editorial_question c
     JOIN question_version v ON v.id=c.current_version_id AND v.editorial_status='PUBLISHED'
     JOIN generated_question g ON g.version_id=v.id
     WHERE g.concept_ids && $1::text[] ORDER BY v.id`, [conceptIds],
  )).rows;
  const byConcept = new Map<string, { id: string; title: string }[]>();
  for (const row of rows) for (const c of row.concepts)
    byConcept.set(c, [...(byConcept.get(c) ?? []), { id: row.id, title: row.title }]);
  return { byConcept, total: rows.length };
}

async function snapshot(owner: string) {
  const [core, ratings, progress, memory] = await Promise.all([loadCore(), ratingsOf(owner), areaProgress(owner), deckMemory(owner)]);
  const byArea = new Map(progress.map((p) => [p.area, p]));
  const of = (area: CoreArea) => confidence(area, ratings, byArea.get(area.area), area.deck ? memory.get(area.deck) ?? 0 : null);
  return { core, ratings, of };
}

@Controller("api/core")
export class CoreConceptsController {
  /** Mapa de confiança: áreas com histórico, confiança e prioridade (peso na prova × o que falta saber). */
  @Get() async areas(@Req() req: any) {
    const user = await requireIdentity(req);
    const { core, of } = await snapshot(user.id);
    const specificTotal = core.areas.filter((a) => a.area !== FORMACAO_GERAL)
      .reduce((s, a) => s + core.history.get(a.slug)!.total, 0);
    return {
      areas: core.areas.map((area) => {
        const history = core.history.get(area.slug)!;
        const conf = of(area);
        const share = area.area === FORMACAO_GERAL ? null : history.total / specificTotal;
        return {
          slug: area.slug, area: area.area, title: area.title, summary: area.summary,
          history, share: share === null ? null : Math.round(1000 * share) / 10,
          concepts: area.concepts.length, confidence: conf,
          priority: share === null ? null : Math.round(1000 * share * (1 - conf.value / 100)) / 10,
        };
      }),
    };
  }

  @Get(":slug") async area(@Req() req: any, @Param("slug") slug: string) {
    const user = await requireIdentity(req);
    const { core, ratings, of } = await snapshot(user.id);
    const area = core.areas.find((a) => a.slug === slug) ?? fail("Área não encontrada.", 404);
    const linked = area.concepts.flatMap((c) => core.links.get(c.id) ?? []);
    const [published, generated, lessons] = await Promise.all([
      publishedVersions([...new Set(linked.map((q) => q.id))]),
      generatedByConcept(area.concepts.map((c) => c.id)),
      loadLessons(core.areas),
    ]);
    const ofArea = lessons.get(area.slug);
    const { concepts, ...rest } = area;
    return {
      ...rest,
      history: core.history.get(area.slug),
      confidence: of(area),
      generatedTotal: generated.total,
      cover: ofArea?.cover ?? null,
      concepts: concepts.map(({ match: _match, ...c }) => ({
        ...c,
        lesson: ofArea?.lessons.has(c.id) ?? false,
        level: ratings.get(c.id) ?? null,
        // O estudo abre a questão pela versão publicada.
        questions: (core.links.get(c.id) ?? []).filter((q) => published.has(q.id))
          .map((q) => ({ ...q, id: published.get(q.id)! })),
        generated: generated.byConcept.get(c.id) ?? [],
      })),
    };
  }

  /** Lição de um conceito (LIB-2); as questões ligadas já vêm na página da área. */
  @Get(":slug/lessons/:concept") async lesson(@Req() req: any, @Param("slug") slug: string, @Param("concept") concept: string) {
    await requireIdentity(req);
    const core = await loadCore();
    const lesson = (await loadLessons(core.areas)).get(slug)?.lessons.get(concept) ?? fail("Lição não encontrada.", 404);
    return lesson;
  }

  /** Autoavaliação: 0 não sei, 1 mais ou menos, 2 sei explicar; null apaga. */
  @Put("concepts/:id") @HttpCode(200) async rate(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const user = await requireIdentity(req);
    const level = body?.level;
    if (level !== null && ![0, 1, 2].includes(level)) fail("Escolha não sei, mais ou menos ou sei explicar.", 400);
    const core = await loadCore();
    const area = core.areas.find((a) => a.concepts.some((c) => c.id === id)) ?? fail("Conceito não encontrado.", 404);
    if (level === null) await db.query("DELETE FROM core_concept_rating WHERE identity_id=$1 AND concept_id=$2", [user.id, id]);
    else await db.query(
      `INSERT INTO core_concept_rating(identity_id,concept_id,level) VALUES($1,$2,$3)
       ON CONFLICT(identity_id,concept_id) DO UPDATE SET level=$3,updated_at=clock_timestamp()`, [user.id, id, level],
    );
    const { of } = await snapshot(user.id);
    return { slug: area.slug, level, confidence: of(area) };
  }
}
