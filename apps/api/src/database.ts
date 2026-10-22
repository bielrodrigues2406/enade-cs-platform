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
  explanation: string;
  correctOptionId: string;
  options: { id: string; text: string }[];
};
export type Answer = { optionId: string; revision: number };
