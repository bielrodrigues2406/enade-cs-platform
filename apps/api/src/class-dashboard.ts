import { Controller, Get, Param, Req } from "@nestjs/common";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireStaff } from "./lessons.js";

// Painel do professor (PROF-1): presença e desempenho da turma. O desempenho
// usa só a primeira tentativa de cada questão, para não premiar quem repete
// até acertar, e sempre traz o tamanho da amostra. Só entram alunos cujo
// prontuário da conta está na lista da turma (D13).

const ID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;

export type StudentRow = {
  id: string; name: string; enrollment: string; hasAccount: boolean;
  present: number; recorded: number;
  firstAttempts: number; firstCorrect: number; practiceDone: number; lastActivity: string | null;
};
export type AreaRow = { area: string; students: number; firstAttempts: number; firstCorrect: number };
export type ClassDashboard = {
  id: string; name: string; editionYear: number; lessonsWithRoll: number;
  students: StudentRow[]; areas: AreaRow[];
  /** Respostas anteriores ao histórico: contam a última escolha, não a primeira. */
  backfilled: number;
};

// Primeira resposta de cada aluno da turma a cada questão (por questão
// editorial, para que uma nova versão não conte como outra tentativa).
const FIRST_ATTEMPTS = `
  WITH roster AS (
    SELECT m.id AS member_id,a.identity_id FROM class_member m
    JOIN account a ON a.enrollment=m.enrollment WHERE m.class_id=$1
  )
  SELECT DISTINCT ON (e.owner_id,v.question_id)
    r.member_id,e.owner_id,v.topic AS area,e.correct,e.origin
  FROM answer_event e
  JOIN roster r ON r.identity_id=e.owner_id
  JOIN question_version v ON v.id=e.version_id
  ORDER BY e.owner_id,v.question_id,e.answered_at,e.id`;

async function students(classId: string): Promise<StudentRow[]> {
  return (await db.query(
    `WITH first AS (${FIRST_ATTEMPTS})
     SELECT m.id,m.name,m.enrollment,(a.identity_id IS NOT NULL) AS "hasAccount",
       (SELECT count(*) FILTER (WHERE t.status IN ('PRESENT','LATE'))::int FROM attendance t WHERE t.member_id=m.id) AS present,
       (SELECT count(*)::int FROM attendance t WHERE t.member_id=m.id) AS recorded,
       (SELECT count(*)::int FROM first f WHERE f.member_id=m.id) AS "firstAttempts",
       (SELECT count(*) FILTER (WHERE f.correct)::int FROM first f WHERE f.member_id=m.id) AS "firstCorrect",
       (SELECT count(*)::int FROM practice_attempt p WHERE p.owner_id=a.identity_id AND p.state='COMPLETED') AS "practiceDone",
       (SELECT max(e.answered_at) FROM answer_event e WHERE e.owner_id=a.identity_id) AS "lastActivity"
     FROM class_member m LEFT JOIN account a ON a.enrollment=m.enrollment
     WHERE m.class_id=$1 ORDER BY m.name`, [classId],
  )).rows;
}

async function areas(classId: string): Promise<AreaRow[]> {
  return (await db.query(
    `WITH first AS (${FIRST_ATTEMPTS})
     SELECT area,count(DISTINCT owner_id)::int AS students,count(*)::int AS "firstAttempts",
       count(*) FILTER (WHERE correct)::int AS "firstCorrect"
     FROM first GROUP BY area ORDER BY area`, [classId],
  )).rows;
}

async function backfilled(classId: string): Promise<number> {
  return (await db.query(
    `WITH first AS (${FIRST_ATTEMPTS}) SELECT count(*)::int AS n FROM first WHERE origin='BACKFILL'`, [classId],
  )).rows[0].n;
}

export async function classDashboard(classId: string): Promise<ClassDashboard> {
  const info = (await db.query(
    `SELECT c.id,c.name,c.edition_year AS "editionYear",
       (SELECT count(*)::int FROM lesson l WHERE l.class_id=c.id
         AND EXISTS(SELECT 1 FROM attendance t WHERE t.lesson_id=l.id)) AS "lessonsWithRoll"
     FROM study_class c WHERE c.id=$1`, [classId],
  )).rows[0];
  if (!info) fail("Turma não encontrada.", 404);
  const [studentRows, areaRows, backfill] = await Promise.all([students(classId), areas(classId), backfilled(classId)]);
  return { ...info, students: studentRows, areas: areaRows, backfilled: backfill };
}

@Controller("api")
export class ClassDashboardController {
  @Get("classes/:id/dashboard") async dashboard(@Req() req: any, @Param("id") id: string) {
    await requireStaff(req);
    if (!ID.test(id)) fail("Turma não encontrada.", 404);
    return classDashboard(id);
  }
}
