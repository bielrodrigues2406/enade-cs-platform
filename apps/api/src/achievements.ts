import { db } from "./database.js";
import { ELIGIBLE } from "./practice-eligibility.js";

// Conquistas (ENG-1): poucas e ligadas a marcos reais de estudo. Calculadas no
// servidor a partir das respostas; a primeira vez que a condição vale, a
// conquista é gravada e a tela mostra um aviso animado uma única vez.

export type Tier = "bronze" | "silver" | "gold";
export type Achievement = { code: string; title: string; description: string; icon: string; tier: Tier };
export type AchievementView = Achievement & { unlockedAt: string | null; isNew: boolean; progress: { value: number; target: number } | null };

export const ACHIEVEMENTS: Achievement[] = [
  { code: "primeira-resposta", title: "Primeiro passo", description: "Responda sua primeira questão.", icon: "spark", tier: "bronze" },
  { code: "meta-batida", title: "Meta do dia", description: "Bata sua meta diária pela primeira vez.", icon: "target", tier: "bronze" },
  { code: "sequencia-3", title: "Três dias seguidos", description: "Bata a meta em 3 dias seguidos.", icon: "flame", tier: "bronze" },
  { code: "sequencia-7", title: "Uma semana", description: "Bata a meta em 7 dias seguidos.", icon: "flame", tier: "silver" },
  { code: "sequencia-30", title: "Um mês de constância", description: "Bata a meta em 30 dias seguidos.", icon: "flame", tier: "gold" },
  { code: "questoes-50", title: "Cinquenta", description: "Responda 50 questões diferentes.", icon: "stack", tier: "bronze" },
  { code: "questoes-150", title: "Cento e cinquenta", description: "Responda 150 questões diferentes.", icon: "stack", tier: "silver" },
  { code: "acervo-completo", title: "Acervo completo", description: "Responda todas as questões publicadas.", icon: "crown", tier: "gold" },
  { code: "area-completa", title: "Área fechada", description: "Responda todas as questões de uma área.", icon: "compass", tier: "silver" },
  { code: "erros-revistos", title: "Volta por cima", description: "Termine um treino com os seus erros.", icon: "loop", tier: "bronze" },
  { code: "prova-completa", title: "Ensaio geral", description: "Finalize uma prova completa de edição.", icon: "trophy", tier: "silver" },
  { code: "prova-70", title: "Acima de 70%", description: "Acerte 70% ou mais numa prova completa.", icon: "trophy", tier: "gold" },
  { code: "discursiva", title: "Mão na massa", description: "Envie a resposta de uma discursiva.", icon: "pen", tier: "bronze" },
  { code: "flashcards-100", title: "Memória em dia", description: "Faça 100 revisões de flashcards.", icon: "cards", tier: "silver" },
];

type Stats = {
  answered: number; published: number; areaComplete: boolean; errorsDone: boolean;
  editions: number; edition70: boolean; discursive: boolean; flashcards: number;
};

async function stats(owner: string): Promise<Stats> {
  return (await db.query<Stats>(
    `WITH seen AS (
       SELECT v.question_id,v.topic FROM answer_event e JOIN question_version v ON v.id=e.version_id WHERE e.owner_id=$1
       UNION SELECT v.question_id,v.topic FROM practice_item i JOIN practice_attempt p ON p.id=i.attempt_id
       JOIN question_version v ON v.id=i.version_id WHERE p.owner_id=$1 AND i.option_id IS NOT NULL),
     published AS (${ELIGIBLE}),
     per_area AS (
       SELECT p.topic,count(DISTINCT p.question_id) AS total,
         count(DISTINCT s.question_id) AS seen
       FROM published p LEFT JOIN seen s ON s.question_id=p.question_id GROUP BY p.topic)
     SELECT (SELECT count(DISTINCT question_id) FROM seen)::int AS answered,
       (SELECT count(DISTINCT question_id) FROM published)::int AS published,
       EXISTS(SELECT 1 FROM per_area WHERE total >= 3 AND seen >= total) AS "areaComplete",
       EXISTS(SELECT 1 FROM practice_attempt WHERE owner_id=$1 AND state='COMPLETED' AND focus='ERRORS') AS "errorsDone",
       (SELECT count(*) FROM practice_attempt WHERE owner_id=$1 AND state='COMPLETED' AND kind='EDITION')::int AS editions,
       EXISTS(SELECT 1 FROM practice_attempt WHERE owner_id=$1 AND state='COMPLETED' AND kind='EDITION'
         AND (summary->>'correct')::numeric >= 0.7 * (summary->>'total')::numeric) AS edition70,
       EXISTS(SELECT 1 FROM discursive_response WHERE owner_id=$1 AND submitted_at IS NOT NULL) AS discursive,
       (SELECT count(*) FROM flashcard_review WHERE identity_id=$1)::int AS flashcards`, [owner],
  )).rows[0];
}

/** Progresso rumo a cada conquista; null quando é sim ou não. */
function progressOf(code: string, s: Stats, best: number): { value: number; target: number } | null {
  const of = (value: number, target: number) => ({ value: Math.min(value, target), target });
  switch (code) {
    case "sequencia-3": return of(best, 3);
    case "sequencia-7": return of(best, 7);
    case "sequencia-30": return of(best, 30);
    case "questoes-50": return of(s.answered, 50);
    case "questoes-150": return of(s.answered, 150);
    case "acervo-completo": return of(s.answered, Math.max(1, s.published));
    case "flashcards-100": return of(s.flashcards, 100);
    default: return null;
  }
}

function reached(code: string, s: Stats, extra: { best: number; metGoal: boolean }) {
  const progress = progressOf(code, s, extra.best);
  if (progress) return progress.value >= progress.target && (code !== "acervo-completo" || s.published > 0);
  return ({
    "primeira-resposta": s.answered > 0,
    "meta-batida": extra.metGoal,
    "area-completa": s.areaComplete,
    "erros-revistos": s.errorsDone,
    "prova-completa": s.editions > 0,
    "prova-70": s.edition70,
    discursiva: s.discursive,
  } as Record<string, boolean>)[code] ?? false;
}

/** Avalia, grava o que acabou de ser alcançado e devolve todas, na ordem da lista. */
export async function evaluateAchievements(owner: string, extra: { best: number; metGoal: boolean }): Promise<AchievementView[]> {
  const s = await stats(owner);
  const earned = ACHIEVEMENTS.filter((a) => reached(a.code, s, extra)).map((a) => a.code);
  if (earned.length)
    await db.query(
      "INSERT INTO achievement_unlock(identity_id,code) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING", [owner, earned],
    );
  const unlocked = new Map((await db.query<{ code: string; unlocked_at: Date; seen_at: Date | null }>(
    "SELECT code,unlocked_at,seen_at FROM achievement_unlock WHERE identity_id=$1", [owner],
  )).rows.map((row) => [row.code, row]));
  return ACHIEVEMENTS.map((a) => {
    const row = unlocked.get(a.code);
    return {
      ...a, unlockedAt: row ? row.unlocked_at.toISOString() : null, isNew: Boolean(row && !row.seen_at),
      progress: row ? null : progressOf(a.code, s, extra.best),
    };
  });
}
