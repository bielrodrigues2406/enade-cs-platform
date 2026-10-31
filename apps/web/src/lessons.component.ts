import { Component, Input, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

// Aulas de preparação e presença (AULA-1). Professores e administração
// gerenciam turmas, aulas e a chamada; o aluno vê as próprias aulas.
type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
type ClassSummary = { id: string; name: string; editionYear: number; members: number; lessons: number; nextLesson: string | null };
type Member = { id: string; name: string; enrollment: string; email: string | null; hasAccount: boolean; present: number; recorded: number };
type LessonRow = { id: string; startsAt: string; endsAt: string; room: string; subject: string; topic: string | null; teacher: string; present: number; recorded: number };
type ClassDetail = { id: string; name: string; editionYear: number; members: Member[]; lessons: LessonRow[]; teachers: { id: string; name: string }[] };
type RollEntry = { id: string; name: string; enrollment: string; status: Status | null; note: string | null };
type Roll = { id: string; classId: string; className: string; startsAt: string; endsAt: string; room: string; subject: string; topic: string | null; teacher: string; roll: RollEntry[] };
type MyLesson = { id: string; className: string; startsAt: string; endsAt: string; room: string; subject: string; topic: string | null; teacher: string; status: Status | null };

export const STATUS_OPTIONS: { value: Status; short: string; label: string }[] = [
  { value: "PRESENT", short: "P", label: "Presente" },
  { value: "LATE", short: "A", label: "Atraso" },
  { value: "ABSENT", short: "F", label: "Falta" },
  { value: "EXCUSED", short: "J", label: "Justificada" },
];
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label])) as Record<Status, string>;

@Component({
  selector: "app-lessons",
  imports: [FormsModule],
  templateUrl: "./lessons.component.html",
})
export class LessonsComponent {
  @Input() staff = false;
  readonly statusOptions = STATUS_OPTIONS;
  readonly statusLabel = STATUS_LABEL;
  classes = signal<ClassSummary[]>([]);
  detail = signal<ClassDetail | null>(null);
  roll = signal<Roll | null>(null);
  mine = signal<MyLesson[] | null>(null);
  busy = signal(false);
  error = signal("");
  notice = signal("");
  newClass = { name: "", editionYear: new Date().getFullYear() };
  rosterText = "";
  newLesson = { date: "", start: "19:00", end: "21:00", room: "", subject: "", topic: "", teacherId: "" };

  rollCount = computed(() => {
    const roll = this.roll()?.roll ?? [];
    return { present: roll.filter((r) => r.status === "PRESENT" || r.status === "LATE").length, total: roll.length };
  });

  ngOnInit() {
    void (this.staff ? this.loadClasses() : this.loadMine());
  }
  when(iso: string) {
    return new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  isPast(iso: string) {
    return new Date(iso).getTime() < Date.now();
  }
  async loadClasses() {
    this.notice.set("");
    this.detail.set(null);
    this.roll.set(null);
    await this.attempt(async () => this.classes.set(await this.request<ClassSummary[]>("classes")));
  }
  async loadMine() {
    await this.attempt(async () => this.mine.set((await this.request<{ lessons: MyLesson[] }>("my/lessons")).lessons));
  }
  async createClass() {
    await this.attempt(async () => {
      const { id } = await this.request<{ id: string }>("classes", this.newClass);
      this.newClass.name = "";
      await this.openClass(id);
    });
  }
  async openClass(id: string) {
    this.roll.set(null);
    await this.attempt(async () => {
      const detail = await this.request<ClassDetail>(`classes/${id}`);
      this.detail.set(detail);
      if (!this.newLesson.teacherId && detail.teachers.length) this.newLesson.teacherId = detail.teachers[0].id;
    });
  }
  async importRoster() {
    const detail = this.detail();
    if (!detail || !this.rosterText.trim()) return;
    await this.attempt(async () => {
      const result = await this.request<{ added: number; updated: number; skipped: number }>(`classes/${detail.id}/members`, { text: this.rosterText });
      this.notice.set(`${result.added} adicionadas, ${result.updated} atualizadas` + (result.skipped ? `, ${result.skipped} linhas ignoradas (sem nome ou prontuário).` : "."));
      this.rosterText = "";
      await this.openClass(detail.id);
    });
  }
  async removeMember(member: Member) {
    const detail = this.detail();
    if (!detail || !confirm(`Remover ${member.name} da turma? A presença dela nesta turma também sai.`)) return;
    await this.attempt(async () => {
      await this.request(`classes/${detail.id}/members/${member.id}/remove`, {});
      await this.openClass(detail.id);
    });
  }
  async createLesson() {
    const detail = this.detail();
    const l = this.newLesson;
    if (!detail || !l.date) return;
    await this.attempt(async () => {
      const at = (time: string) => new Date(`${l.date}T${time}`).toISOString();
      await this.request(`classes/${detail.id}/lessons`, {
        startsAt: at(l.start), endsAt: at(l.end), room: l.room, subject: l.subject, topic: l.topic || undefined, teacherId: l.teacherId,
      });
      this.notice.set("Aula marcada.");
      this.newLesson = { ...l, date: "", topic: "" };
      await this.openClass(detail.id);
    });
  }
  async openRoll(id: string) {
    this.notice.set("");
    await this.attempt(async () => this.roll.set(await this.request<Roll>(`lessons/${id}`)));
  }
  async closeRoll() {
    const roll = this.roll();
    if (roll) await this.openClass(roll.classId);
  }
  mark(entry: RollEntry, status: Status) {
    void this.save([{ ...entry, status }]);
  }
  markAllPresent() {
    void this.save((this.roll()?.roll ?? []).filter((r) => !r.status).map((r) => ({ ...r, status: "PRESENT" as Status })));
  }
  exportUrl() {
    return `/api/classes/${this.detail()!.id}/attendance.csv`;
  }

  private async save(entries: RollEntry[]) {
    const roll = this.roll();
    if (!roll || !entries.length) return;
    // Mostra na hora; se o servidor recusar, recarrega a chamada.
    const changed = new Map(entries.map((e) => [e.id, e.status]));
    this.roll.set({ ...roll, roll: roll.roll.map((r) => (changed.has(r.id) ? { ...r, status: changed.get(r.id)! } : r)) });
    const ok = await this.attempt(async () => {
      await this.request(`lessons/${roll.id}/attendance`, { entries: entries.map((e) => ({ memberId: e.id, status: e.status, note: e.note })) }, "PUT");
    });
    if (!ok) await this.openRoll(roll.id);
  }
  private async attempt(work: () => Promise<void>) {
    this.busy.set(true);
    this.error.set("");
    try {
      await work();
      return true;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Não foi possível concluir.");
      return false;
    } finally {
      this.busy.set(false);
    }
  }
  private async request<T = unknown>(path: string, body?: unknown, method?: string): Promise<T> {
    const res = await fetch("/api/" + path, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Não foi possível concluir.");
    return res.json();
  }
}
