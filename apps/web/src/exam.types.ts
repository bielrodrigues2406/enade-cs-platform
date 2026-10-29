import type { QuestionContent } from "./question-content.component";

export type AttemptSummary = {
  id: string;
  state: "IN_PROGRESS" | "COMPLETED";
  size: number;
  area: string | null;
  createdAt: string;
  finishedAt: string | null;
  answered: number;
};
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
  }) | null;
};
