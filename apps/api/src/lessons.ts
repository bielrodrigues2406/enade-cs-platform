import { randomUUID } from "node:crypto";
import { Body, Controller, Get, HttpCode, Param, Post, Put, Req, Res } from "@nestjs/common";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";
import { rolesOf } from "./roles.js";

// Turmas, aulas e presença (AULA-1, D13). Professores e administração
// gerenciam; o aluno vê as aulas da turma em que seu prontuário está.

const ID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const ENROLLMENT = /^[A-Z]{2}[0-9]{6,8}X?$/;
const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
const STATUS_CSV: Record<string, string> = { PRESENT: "P", ABSENT: "F", LATE: "A", EXCUSED: "J" };

export async function requireStaff(req: any) {
  const user = await requireIdentity(req);
  const roles = user.email ? await rolesOf(user.id) : [];
  if (!roles.includes("PROFESSOR") && !roles.includes("ADMIN")) fail("Área de professores.", 403);
  return user;
}
const uuid = (value: string, label: string) => (ID.test(value) ? value : fail(`${label} não encontrada.`, 404));
function text(value: unknown, label: string, min: number, max: number) {
  const clean = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (clean.length < min || clean.length > max) fail(`${label}: use de ${min} a ${max} caracteres.`, 400);
  return clean;
}

export type RosterRow = { name: string; enrollment: string; email: string | null };
/**
 * Lê a lista colada da planilha: uma pessoa por linha, com nome e prontuário
 * (e-mail opcional), separados por tabulação, ponto e vírgula ou vírgula. A
 * ordem das colunas não importa; linhas sem prontuário (cabeçalho) são puladas.
 */
export function parseRoster(input: string): { rows: RosterRow[]; skipped: number } {
  const rows: RosterRow[] = [];
  let skipped = 0;
  for (const line of input.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line.split(/\t|;|,/).map((cell) => cell.trim()).filter(Boolean);
    const enrollment = cells.find((cell) => ENROLLMENT.test(cell.toUpperCase()))?.toUpperCase();
    const email = cells.find((cell) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cell))?.toLowerCase() ?? null;
    const name = cells.find((cell) => cell.toUpperCase() !== enrollment && cell.toLowerCase() !== email && /\p{L}{2,}/u.test(cell));
    if (!enrollment || !name || name.length > 120) skipped++;
    else rows.push({ name, enrollment, email });
  }
  return { rows, skipped };
}

@Controller("api")
export class LessonsController {
  @Get("classes") async classes(@Req() req: any) {
    await requireStaff(req);
    return (await db.query(
      `SELECT c.id,c.name,c.edition_year AS "editionYear",
         (SELECT count(*)::int FROM class_member m WHERE m.class_id=c.id) AS members,
         (SELECT count(*)::int FROM lesson l WHERE l.class_id=c.id) AS lessons,
         (SELECT min(l.starts_at) FROM lesson l WHERE l.class_id=c.id AND l.ends_at>now()) AS "nextLesson"
       FROM study_class c ORDER BY c.edition_year DESC,c.name`,
    )).rows;
  }

  @Post("classes") @HttpCode(201) async createClass(@Req() req: any, @Body() body: any) {
    const user = await requireStaff(req);
    const year = Number(body?.editionYear);
    if (!Number.isInteger(year) || year < 2004 || year > 2100) fail("Ano inválido.", 400);
    const id = randomUUID();
    await db.query("INSERT INTO study_class(id,name,edition_year,created_by) VALUES($1,$2,$3,$4)",
      [id, text(body?.name, "Nome da turma", 2, 120), year, user.id]);
    return { id };
  }

  @Get("classes/:id") async classDetail(@Req() req: any, @Param("id") id: string) {
    await requireStaff(req);
    uuid(id, "Turma");
    const info = (await db.query(`SELECT id,name,edition_year AS "editionYear" FROM study_class WHERE id=$1`, [id])).rows[0];
    if (!info) fail("Turma não encontrada.", 404);
    // Presença de cada aluno e se já tem conta (mesmo prontuário).
    const members = (await db.query(
      `SELECT m.id,m.name,m.enrollment,m.email,(a.identity_id IS NOT NULL) AS "hasAccount",
         count(t.*) FILTER (WHERE t.status IN ('PRESENT','LATE'))::int AS present,
         count(t.*)::int AS recorded
       FROM class_member m LEFT JOIN account a ON a.enrollment=m.enrollment
       LEFT JOIN attendance t ON t.member_id=m.id
       WHERE m.class_id=$1 GROUP BY m.id,a.identity_id ORDER BY m.name`, [id],
    )).rows;
    const lessons = (await db.query(
      `SELECT l.id,l.starts_at AS "startsAt",l.ends_at AS "endsAt",l.room,l.subject,l.topic,
         COALESCE(a.display_name,a.email) AS teacher,
         count(t.*) FILTER (WHERE t.status IN ('PRESENT','LATE'))::int AS present,
         count(t.*)::int AS recorded
       FROM lesson l JOIN account a ON a.identity_id=l.teacher_id
       LEFT JOIN attendance t ON t.lesson_id=l.id
       WHERE l.class_id=$1 GROUP BY l.id,a.display_name,a.email ORDER BY l.starts_at`, [id],
    )).rows;
    const teachers = (await db.query(
      `SELECT DISTINCT a.identity_id AS id,COALESCE(a.display_name,a.email) AS name FROM account a
       JOIN account_role r ON r.identity_id=a.identity_id ORDER BY name`,
    )).rows;
    return { ...info, members, lessons, teachers };
  }

  @Post("classes/:id/members") @HttpCode(200) async importMembers(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    await requireStaff(req);
    uuid(id, "Turma");
    if (typeof body?.text !== "string" || body.text.length > 60000) fail("Cole a lista da planilha.", 400);
    const { rows, skipped } = parseRoster(body.text);
    if (!rows.length) fail("Nenhuma linha com nome e prontuário foi encontrada.", 400);
    let added = 0, updated = 0;
    for (const row of rows) {
      const result = await db.query(
        `INSERT INTO class_member(id,class_id,name,enrollment,email) VALUES($1,$2,$3,$4,$5)
         ON CONFLICT (class_id,enrollment) DO UPDATE SET name=EXCLUDED.name,email=COALESCE(EXCLUDED.email,class_member.email)
         RETURNING (xmax = 0) AS inserted`,
        [randomUUID(), id, row.name, row.enrollment, row.email],
      );
      if (result.rows[0].inserted) added++; else updated++;
    }
    return { added, updated, skipped };
  }

  @Post("classes/:id/members/:member/remove") @HttpCode(200) async removeMember(
    @Req() req: any, @Param("id") id: string, @Param("member") member: string,
  ) {
    await requireStaff(req);
    await db.query("DELETE FROM class_member WHERE id=$1 AND class_id=$2", [uuid(member, "Pessoa"), uuid(id, "Turma")]);
    return { removed: true };
  }

  @Post("classes/:id/lessons") @HttpCode(201) async createLesson(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const user = await requireStaff(req);
    uuid(id, "Turma");
    const startsAt = new Date(body?.startsAt), endsAt = new Date(body?.endsAt);
    if (Number.isNaN(+startsAt) || Number.isNaN(+endsAt) || endsAt <= startsAt) fail("Horário inválido: o fim deve ser depois do início.", 400);
    const teacher = uuid(String(body?.teacherId ?? ""), "Professor");
    if (!(await rolesOf(teacher)).length) fail("Escolha um professor cadastrado.", 400);
    const lessonId = randomUUID();
    await db.query(
      `INSERT INTO lesson(id,class_id,starts_at,ends_at,room,subject,topic,teacher_id,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [lessonId, id, startsAt, endsAt, text(body?.room, "Sala", 1, 60), text(body?.subject, "Matéria", 2, 80),
        body?.topic ? text(body.topic, "Tema", 1, 200) : null, teacher, user.id],
    );
    return { id: lessonId };
  }

  // Chamada: lista da turma com a situação de cada um nesta aula.
  @Get("lessons/:id") async lessonDetail(@Req() req: any, @Param("id") id: string) {
    await requireStaff(req);
    uuid(id, "Aula");
    const info = (await db.query(
      `SELECT l.id,l.class_id AS "classId",c.name AS "className",l.starts_at AS "startsAt",l.ends_at AS "endsAt",
         l.room,l.subject,l.topic,COALESCE(a.display_name,a.email) AS teacher
       FROM lesson l JOIN study_class c ON c.id=l.class_id JOIN account a ON a.identity_id=l.teacher_id WHERE l.id=$1`, [id],
    )).rows[0];
    if (!info) fail("Aula não encontrada.", 404);
    const roll = (await db.query(
      `SELECT m.id,m.name,m.enrollment,t.status,t.note FROM class_member m
       LEFT JOIN attendance t ON t.member_id=m.id AND t.lesson_id=$1
       WHERE m.class_id=$2 ORDER BY m.name`, [id, info.classId],
    )).rows;
    return { ...info, roll };
  }

  @Put("lessons/:id/attendance") async mark(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const user = await requireStaff(req);
    uuid(id, "Aula");
    const entries: unknown[] = Array.isArray(body?.entries) ? body.entries : [];
    if (!entries.length || entries.length > 500) fail("Informe a presença.", 400);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (const raw of entries) {
        const entry = raw as Record<string, unknown>;
        if (!STATUSES.includes(entry?.status as never)) fail("Situação de presença inválida.", 400);
        const note = typeof entry.note === "string" && entry.note.trim() ? entry.note.trim().slice(0, 200) : null;
        await client.query(
          `INSERT INTO attendance(lesson_id,member_id,status,note,recorded_by) VALUES($1,$2,$3,$4,$5)
           ON CONFLICT (lesson_id,member_id) DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,
             recorded_by=EXCLUDED.recorded_by,recorded_at=now()`,
          [id, uuid(String(entry.memberId ?? ""), "Pessoa"), entry.status, note, user.id],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "23514") fail("Essa pessoa não é da turma desta aula.", 400);
      throw error;
    } finally {
      client.release();
    }
    return { saved: entries.length };
  }

  // Exportação no formato da planilha: uma linha por aluno, uma coluna por aula.
  @Get("classes/:id/attendance.csv") async exportCsv(@Req() req: any, @Res() res: any, @Param("id") id: string) {
    await requireStaff(req);
    uuid(id, "Turma");
    const lessons = (await db.query("SELECT id,starts_at FROM lesson WHERE class_id=$1 ORDER BY starts_at", [id])).rows;
    const members = (await db.query("SELECT id,name,enrollment FROM class_member WHERE class_id=$1 ORDER BY name", [id])).rows;
    const marks = (await db.query(
      "SELECT t.lesson_id,t.member_id,t.status FROM attendance t JOIN lesson l ON l.id=t.lesson_id WHERE l.class_id=$1", [id],
    )).rows;
    const status = new Map(marks.map((m) => [`${m.lesson_id}:${m.member_id}`, STATUS_CSV[m.status]]));
    const cell = (value: string) => (/[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const date = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const lines = [["Nome", "Prontuário", ...lessons.map((l) => date(l.starts_at)), "Presenças", "%"].join(";")];
    for (const member of members) {
      const row = lessons.map((l) => status.get(`${l.id}:${member.id}`) ?? "");
      const present = row.filter((s) => s === "P" || s === "A").length;
      lines.push([cell(member.name), member.enrollment, ...row, String(present),
        lessons.length ? String(Math.round((present / lessons.length) * 100)) : ""].join(";"));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="presenca-${id.slice(0, 8)}.csv"`);
    res.end("﻿" + lines.join("\r\n") + "\r\n");
  }

  // Aluno: aulas da(s) turma(s) do seu prontuário e a própria presença.
  @Get("my/lessons") async myLessons(@Req() req: any) {
    const user = await requireIdentity(req);
    if (!user.email) return { lessons: [] };
    const lessons = (await db.query(
      `SELECT l.id,c.name AS "className",l.starts_at AS "startsAt",l.ends_at AS "endsAt",l.room,l.subject,l.topic,
         COALESCE(t2.display_name,t2.email) AS teacher,t.status
       FROM account a JOIN class_member m ON m.enrollment=a.enrollment
       JOIN study_class c ON c.id=m.class_id JOIN lesson l ON l.class_id=c.id
       JOIN account t2 ON t2.identity_id=l.teacher_id
       LEFT JOIN attendance t ON t.lesson_id=l.id AND t.member_id=m.id
       WHERE a.identity_id=$1 ORDER BY l.starts_at`, [user.id],
    )).rows;
    return { lessons };
  }
}
