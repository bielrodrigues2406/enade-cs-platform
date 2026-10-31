import { Component, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

// Discursivas (DISC-1): o aluno escreve a resposta (o rascunho é salvo
// sozinho), envia, vê o padrão de resposta do Inep e se autoavalia em cada
// item. A nota é uma estimativa dele, não uma correção.
type Image = { url: string; width: number; height: number; page: number };
type Criterion = { label: string | null; points: number };
type Level = 0 | 1 | 2;
type Status = "NEW" | "DRAFT" | "SUBMITTED" | "ASSESSED";
type Summary = { id: string; title: string; area: string; subject: string | null; status: Status; score: number | null };
type Response = { body: string; revision: number; submittedAt: string | null; assessment: { levels: Level[]; score: number } | null };
type Detail = {
  id: string; title: string; area: string; subject: string | null; criteria: Criterion[];
  examUrl: string; standardUrl: string; promptImages: Image[]; standardImages: Image[]; response: Response | null;
};

export const STATUS_LABEL: Record<Status, string> = {
  NEW: "Não começada", DRAFT: "Rascunho", SUBMITTED: "Enviada", ASSESSED: "Autoavaliada",
};
export const LEVELS: { value: Level; label: string }[] = [
  { value: 0, label: "Não contemplei" },
  { value: 1, label: "Em parte" },
  { value: 2, label: "Contemplei" },
];
export const MAX_BODY = 6000;
const AUTOSAVE_MS = 1200;

/** Pontos com uma casa no formato brasileiro: 7,5. */
export function points(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

@Component({
  selector: "app-discursive",
  imports: [FormsModule],
  templateUrl: "./discursive.component.html",
  styleUrl: "./discursive.component.css",
})
export class DiscursiveComponent {
  readonly statusLabel = STATUS_LABEL;
  readonly levels = LEVELS;
  readonly maxBody = MAX_BODY;
  readonly points = points;
  list = signal<Summary[] | null>(null);
  detail = signal<Detail | null>(null);
  body = signal("");
  levelsDraft = signal<(Level | null)[]>([]);
  saveState = signal<"idle" | "saving" | "saved">("idle");
  busy = signal(false);
  error = signal("");
  private timer: ReturnType<typeof setTimeout> | null = null;

  submitted = computed(() => Boolean(this.detail()?.response?.submittedAt));
  assessed = computed(() => this.levelsDraft().every((level) => level !== null));
  estimate = computed(() => {
    const criteria = this.detail()?.criteria ?? [];
    return criteria.reduce((sum, c, i) => sum + (c.points * (this.levelsDraft()[i] ?? 0)) / 2, 0);
  });

  ngOnInit() {
    void this.loadList();
  }
  ngOnDestroy() {
    void this.flush();
  }

  async loadList() {
    await this.flush();
    this.detail.set(null);
    await this.attempt(async () => this.list.set(await this.request<Summary[]>("discursive")));
  }
  async open(id: string) {
    await this.attempt(async () => {
      const detail = await this.request<Detail>(`discursive/${id}`);
      this.detail.set(detail);
      this.body.set(detail.response?.body ?? "");
      this.levelsDraft.set(detail.criteria.map((_, i) => detail.response?.assessment?.levels[i] ?? null));
      this.saveState.set(detail.response ? "saved" : "idle");
    });
  }
  criterionLabel(criterion: Criterion) {
    return criterion.label ? `Item ${criterion.label})` : "Resposta completa";
  }

  // Rascunho: salva um pouco depois de parar de digitar e ao sair do campo.
  write(value: string) {
    this.body.set(value);
    this.saveState.set("idle");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), AUTOSAVE_MS);
  }
  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const detail = this.detail();
    if (!detail || this.submitted() || this.saveState() !== "idle" || this.body() === (detail.response?.body ?? "")) return;
    const body = this.body();
    this.saveState.set("saving");
    const ok = await this.attempt(async () => {
      const { revision } = await this.request<{ revision: number }>(`discursive/${detail.id}/response`,
        { body, baseRevision: detail.response?.revision ?? 0 }, "PUT");
      this.detail.set({ ...detail, response: { body, revision, submittedAt: null, assessment: null } });
    }, false);
    // Texto digitado durante o envio: salva de novo.
    const changed = this.body() !== body;
    this.saveState.set(ok && !changed ? "saved" : "idle");
    if (ok && changed) this.write(this.body());
  }
  async submit() {
    const detail = this.detail();
    if (!detail || !this.body().trim()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.attempt(async () => {
      const result = await this.request<{ response: Response; standardImages: Image[] }>(`discursive/${detail.id}/submit`,
        { body: this.body(), baseRevision: detail.response?.revision ?? 0 });
      this.detail.set({ ...detail, response: result.response, standardImages: result.standardImages });
    });
  }
  rate(index: number, level: Level) {
    this.levelsDraft.update((levels) => levels.map((current, i) => (i === index ? level : current)));
  }
  async saveAssessment() {
    const detail = this.detail();
    if (!detail || !this.assessed()) return;
    await this.attempt(async () => {
      const assessment = await this.request<{ levels: Level[]; score: number }>(`discursive/${detail.id}/assessment`,
        { levels: this.levelsDraft() }, "PUT");
      this.detail.set({ ...detail, response: { ...detail.response!, assessment } });
    });
  }

  private async attempt(work: () => Promise<void>, block = true) {
    if (block) this.busy.set(true);
    this.error.set("");
    try {
      await work();
      return true;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Não foi possível concluir.");
      return false;
    } finally {
      if (block) this.busy.set(false);
    }
  }
  private async request<T>(path: string, body?: unknown, method?: string): Promise<T> {
    const res = await fetch("/api/" + path, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Não foi possível concluir.");
    return res.json();
  }
}
