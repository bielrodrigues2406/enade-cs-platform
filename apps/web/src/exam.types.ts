import type { QuestionContent } from "./question-content.component";

export type AttemptSummary = {
  id: string;
  state: "IN_PROGRESS" | "COMPLETED";
  size: number;
  area: string | null;
  createdAt: string;
  finishedAt: string | null;
  answered: number;
  kind?: "PARTIAL" | "EDITION";
  /** Prova da edição: prazo do servidor; o cronômetro só o exibe. */
  deadlineAt?: string | null;
  /** Pausada desde; null quando o cronômetro corre. */
  pausedAt?: string | null;
  /** Tempo restante calculado pelo servidor no momento da resposta. */
  remainingMs?: number | null;
};
export type Edition = {
  id: string; year: number; modality: string; title: string; officialUrl: string;
  objectives: number; general: number; discursive: number;
  /** Números sem objetiva publicada (anuladas ou ainda não conferidas). */
  missing: number[];
};
export type EditionList = { minutes: number; editions: Edition[] };
export type PracticeAvailability = {
  sizes: number[];
  defaultSize: number;
  total: number;
  areas: { name: string; count: number }[];
  active: AttemptSummary | null;
  recent: AttemptSummary[];
};
export type PracticeAnswer = { optionId: string | null; marked: boolean; revision: number };
export type PracticeFeedback = {
  correct: boolean | null;
  correctOptionId: string;
  explanation: string;
  explanationCredit: string | null;
  reviewNote?: string | null;
  answerKey?: { title: string; officialUrl: string; page: number; finality?: string | null };
};
export type PracticeItem = {
  position: number;
  question: QuestionContent;
  answer: PracticeAnswer;
  result?: PracticeFeedback;
};
export type PracticeTotals = { total: number; correct: number; incorrect: number; unanswered: number };
export type PracticeView = AttemptSummary & {
  items: PracticeItem[];
  summary: (PracticeTotals & {
    official: number;
    author: number;
    demonstration: number;
    byTopic: (PracticeTotals & { topic: string })[];
    /** Ausente em resultados anteriores à prova completa. */
    byBlock?: { general: PracticeTotals; specific: PracticeTotals };
  }) | null;
  edition?: { year: number; modality: string; title: string; officialUrl: string } | null;
  discursive?: { id: string; number: number }[];
};
