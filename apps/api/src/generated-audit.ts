import type { GeneratedQuestion } from "./generated-publication.js";
import { LETTERS } from "./generated-formats.js";

// Pistas que denunciam a resposta sem ler o enunciado (docs/GENERATED-QUALITY-AUDIT.md).
// O "chutador esperto" escolhe a alternativa mais longa; no empate, a com mais
// vírgulas e depois a com mais itens romanos. Nas oficiais ele acerta 15% das simples.

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const commas = (text: string) => (text.match(/,/g) ?? []).length;
const romans = (text: string) => (text.match(/\b(I|II|III|IV)\b/g) ?? []).length;

/** Probabilidade de o chutador acertar: 1/k quando empata entre k alternativas, uma delas a certa. */
export function guesserHit(q: GeneratedQuestion) {
  const score = q.options.map((o) => [words(o), commas(o), romans(o)]);
  const best = score.reduce((a, b) => (b[0] > a[0] || (b[0] === a[0] && (b[1] > a[1] || (b[1] === a[1] && b[2] > a[2]))) ? b : a));
  const tied = score.map((s, i) => (s.join() === best.join() ? i : -1)).filter((i) => i >= 0);
  return tied.includes(LETTERS.indexOf(q.answer)) ? 1 / tied.length : 0;
}

/** A certa é sozinha a mais longa (em palavras). */
export function uniqueLongest(q: GeneratedQuestion) {
  const lengths = q.options.map(words);
  const right = lengths[LETTERS.indexOf(q.answer)];
  return lengths.filter((l) => l >= right).length === 1;
}

/** Quanto a certa passa da maior errada (1,0 = mesmo tamanho). */
export function lengthRatio(q: GeneratedQuestion) {
  const lengths = q.options.map(words);
  const index = LETTERS.indexOf(q.answer);
  return lengths[index] / Math.max(...lengths.filter((_, i) => i !== index));
}

export type AuditReport = {
  total: number;
  simple: { count: number; uniqueLongest: number; guesser: number; overLength: string[] };
  items: { count: number; firstTrue: number; byTrueCount: Record<number, number> };
  assertion: { count: number; byAnswer: Record<string, number> };
  letters: Record<string, number>;
  promptWords: { median: number; long: number };
};

const share = (part: number, whole: number) => (whole ? part / whole : 0);

export function auditGenerated(questions: GeneratedQuestion[]): AuditReport {
  const simple = questions.filter((q) => q.format === "SIMPLES");
  const items = questions.filter((q) => q.format === "ITENS3" || q.format === "ITENS4");
  const assertion = questions.filter((q) => q.format === "ASSERCAO");
  const truthOf = (q: GeneratedQuestion) => q.options[LETTERS.indexOf(q.answer)].replace(/, apenas\.|\./g, "").split(/, | e /);
  const byTrueCount: Record<number, number> = {};
  for (const q of items) byTrueCount[truthOf(q).length] = (byTrueCount[truthOf(q).length] ?? 0) + 1;
  const count = (list: GeneratedQuestion[], key: (q: GeneratedQuestion) => string) =>
    list.reduce<Record<string, number>>((acc, q) => ({ ...acc, [key(q)]: (acc[key(q)] ?? 0) + 1 }), {});
  const lengths = questions.map((q) => words(q.prompt)).sort((a, b) => a - b);
  return {
    total: questions.length,
    simple: {
      count: simple.length,
      uniqueLongest: share(simple.filter(uniqueLongest).length, simple.length),
      guesser: share(simple.reduce((sum, q) => sum + guesserHit(q), 0), simple.length),
      overLength: simple.filter((q) => lengthRatio(q) > 1.15).map((q) => q.id),
    },
    items: {
      count: items.length,
      firstTrue: share(items.filter((q) => truthOf(q).includes("I")).length, items.length),
      byTrueCount,
    },
    assertion: { count: assertion.length, byAnswer: count(assertion, (q) => q.answer) },
    letters: count(questions, (q) => q.answer),
    promptWords: { median: lengths[Math.floor(lengths.length / 2)] ?? 0, long: share(lengths.filter((l) => l >= 180).length, lengths.length) },
  };
}
