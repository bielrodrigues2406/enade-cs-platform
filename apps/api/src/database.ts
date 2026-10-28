import "dotenv/config";
import { Pool } from "pg";
export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
});
export type Question = {
  id: string;
  title: string;
  topic: string;
  prompt: string;
  origin: string;
  authorCredit: string;
  demonstration: boolean;
  versionNumber: number;
  explanation: string;
  explanationCredit: string | null;
  examSourceId: string | null;
  keySourceId: string | null;
  sourcePage: number | null;
  sourceQuestionNumber: number | null;
  keyPage: number | null;
  correctOptionId: string;
  presentation: "TEXT" | "IMAGE";
  reviewOrigin: "HUMAN" | "ASSISTED";
  options: { id: string; text: string }[];
};
export type Answer = { optionId: string; revision: number };
