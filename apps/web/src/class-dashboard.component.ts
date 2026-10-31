import { Component, Input, computed, signal } from "@angular/core";

// Painel do professor (PROF-1): presença e desempenho de uma turma. Mostra só
// a primeira tentativa de cada questão e sempre o tamanho da amostra; abaixo
// de MIN_SAMPLE respostas o percentual não aparece, para não induzir leitura.
type Student = {
  id: string; name: string; enrollment: string; hasAccount: boolean;
  present: number; recorded: number;
  firstAttempts: number; firstCorrect: number; practiceDone: number; lastActivity: string | null;
};
type Area = { area: string; students: number; firstAttempts: number; firstCorrect: number };
type Dashboard = { id: string; name: string; editionYear: number; lessonsWithRoll: number; students: Student[]; areas: Area[]; backfilled: number };

export const MIN_SAMPLE = 10;
/** Frequência mínima usada como alerta (a mesma exigida nos cursos regulares). */
export const MIN_ATTENDANCE = 0.75;

export function share(part: number, total: number) {
  return total ? part / total : null;
}
export function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

@Component({
  selector: "app-class-dashboard",
  templateUrl: "./class-dashboard.component.html",
  styleUrl: "./class-dashboard.component.css",
})
export class ClassDashboardComponent {
  @Input({ required: true }) classId = "";
  readonly minSample = MIN_SAMPLE;
  readonly percent = percent;
  data = signal<Dashboard | null>(null);
  error = signal("");

  summary = computed(() => {
    const students = this.data()?.students ?? [];
    const recorded = students.reduce((sum, s) => sum + s.recorded, 0);
    const present = students.reduce((sum, s) => sum + s.present, 0);
    return {
      total: students.length,
      withAccount: students.filter((s) => s.hasAccount).length,
      attendance: share(present, recorded),
      lowAttendance: students.filter((s) => this.lowAttendance(s)).length,
    };
  });

  async ngOnInit() {
    const res = await fetch(`/api/classes/${this.classId}/dashboard`);
    if (res.ok) this.data.set(await res.json());
    else this.error.set((await res.json().catch(() => null))?.message ?? "Não foi possível carregar o painel.");
  }

  attendance(student: Student) {
    return percent(share(student.present, student.recorded));
  }
  lowAttendance(student: Student) {
    const value = share(student.present, student.recorded);
    return value !== null && value < MIN_ATTENDANCE;
  }
  accuracy(correct: number, attempts: number) {
    return attempts >= MIN_SAMPLE ? percent(share(correct, attempts)) : null;
  }
  barWidth(area: Area) {
    return `${Math.round((share(area.firstCorrect, area.firstAttempts) ?? 0) * 100)}%`;
  }
  plural(count: number, one: string, many: string) {
    return `${count} ${count === 1 ? one : many}`;
  }
  lastSeen(iso: string | null) {
    return iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";
  }
}
