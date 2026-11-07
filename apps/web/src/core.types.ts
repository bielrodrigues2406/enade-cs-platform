// Contratos do núcleo por área (NUC-1), espelhando /api/core.

export type Confidence = {
  value: number;
  self: number; rated: number;
  answers: number | null; attempts: number;
  cards: number | null;
};
export type AreaHistory = { editions: { year: number; count: number }[]; total: number };
export type CoreAreaSummary = {
  slug: string; area: string; title: string; summary: string;
  history: AreaHistory; share: number | null; concepts: number;
  confidence: Confidence; priority: number | null;
};
export type TrapPattern = "VIZINHO" | "PAR" | "INVERTIDA" | "GRANDEZA" | "CONDICAO" | "ABSOLUTO" | "CAUSA";
export type CoreConcept = {
  id: string; name: string; definition: string; example: string;
  level: 0 | 1 | 2 | null;
  questions: { id: string; year: number; subject: string }[];
  /** Questões geradas por IA ligadas ao conceito (versão publicada). */
  generated: { id: string; title: string }[];
  /** Há lição da Biblioteca para o conceito (LIB-2). */
  lesson: boolean;
};
/** Lição de um conceito, espelhando /api/core/:slug/lessons/:concept. */
export type Lesson = {
  concept: string;
  body: string[];
  figure: { src: string; alt: string } | null;
  example: { title: string; code: string | null; steps: string[]; check: string };
  mistake: string;
  recall: { q: string; a: string }[];
};
export type CoreArea = {
  slug: string; area: string; title: string; summary: string; deck: string | null; sheet: string | null;
  history: AreaHistory; confidence: Confidence; generatedTotal: number;
  /** Capa ilustrada da área, quando ela já tem lições. */
  cover: string | null;
  concepts: CoreConcept[]; facts: string[];
  pairs: { a: string; b: string; difference: string }[];
  cues: { cue: string; concept: string }[];
  traps: { pattern: TrapPattern; text: string }[];
  references: string[];
};

/** Os sete padrões de alternativa errada (ver docs/CORE-CONCEPTS.md). */
export const TRAP_LABELS: Record<TrapPattern, { name: string; tip: string }> = {
  VIZINHO: { name: "Termo da área vizinha", tip: "Um conceito real, mas de outro assunto. Pergunte: isso resolve este problema?" },
  PAR: { name: "Par confundido", tip: "Dois conceitos parecidos trocados. Lembre a diferença em uma frase." },
  INVERTIDA: { name: "Relação invertida", tip: "A relação certa, ao contrário. Confira a direção." },
  GRANDEZA: { name: "Ordem de grandeza", tip: "Custo, tamanho ou proporção fora da referência." },
  CONDICAO: { name: "Condição esquecida", tip: "Vale só sob uma condição que a alternativa omite." },
  ABSOLUTO: { name: "Absoluto suspeito", tip: "'Sempre', 'nunca', 'garante': poucas afirmações absolutas são verdadeiras." },
  CAUSA: { name: "Causa trocada", tip: "Duas afirmações verdadeiras em que uma não explica a outra." },
};

export const LEVELS = [
  { value: 0, label: "Não sei" },
  { value: 1, label: "Mais ou menos" },
  { value: 2, label: "Sei explicar" },
] as const;
