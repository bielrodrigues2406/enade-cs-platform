import { requestJson } from "./api-request";
import { MascotComponent } from "./mascot.component";
import { Component, EventEmitter, HostListener, Input, Output, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ChoiceService } from "./choice-dialog";

// Discursivas (DISC-1): o aluno escreve a resposta (o rascunho é salvo
// sozinho), envia, vê o padrão de resposta do Inep e se autoavalia em cada
// item. A nota é uma estimativa dele, não uma correção. Dentro da prova
// completa (`embedded`), mostra só o enunciado e o rascunho: o envio acontece
// ao finalizar a prova.
type Image = { url: string; width: number; height: number; page: number };
type Criterion = { label: string | null; points: number };
type Level = 0 | 1 | 2;
type Status = "NEW" | "DRAFT" | "SUBMITTED" | "ASSESSED";
type Summary = { id: string; title: string; area: string; subject: string | null; status: Status; score: number | null };
type Response = { body: string; revision: number; submittedAt: string | null; assessment: { levels: Level[]; score: number } | null };
type Detail = {
  id: string; title: string; area: string; subject: string | null; criteria: Criterion[];
  examUrl: string; standardUrl: string | null;
  /** Aviso de conferência por agente, quando houver. */
  reviewCredit?: string | null; reviewNote?: string | null; promptImages: Image[]; standardImages: Image[]; response: Response | null;
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
  imports: [MascotComponent, FormsModule],
  templateUrl: "./discursive.component.html",
  styleUrl: "./discursive.component.css",
})
export class DiscursiveComponent {
  @Input() questionId: string | null = null;
  @Input() embedded = false;
  /** Simulado: rascunho e padrão pertencem a esta tentativa, separados do estudo livre. */
  @Input() attemptId: string | null = null;
  @Input() locked = false;
  @Output() draftStateChange = new EventEmitter<{ dirty: boolean; saving: boolean }>();
  private choice = inject(ChoiceService);
  private pendingSave: Promise<void> | null = null;
  private destroyed = false;

  private endpoint(id: string) {
    return this.attemptId ? `practice/${this.attemptId}/discursive` : `discursive/${id}`;
  }
  private publishDraftState() {
    if (!this.destroyed) this.draftStateChange.emit({
      dirty: this.body() !== (this.detail()?.response?.body ?? ""), saving: this.saveState() === "saving",
    });
  }
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
    void (this.questionId ? this.open(this.questionId) : this.loadList());
  }
  ngOnDestroy() {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    // Uma troca de conta pode já ter mudado o cookie; não enviar o texto antigo aqui.
    this.draftStateChange.emit({ dirty: false, saving: false });
  }

  @HostListener("window:beforeunload", ["$event"])
  warnUnsaved(event: BeforeUnloadEvent) {
    if (!this.submitted() && (this.body() !== (this.detail()?.response?.body ?? "") || this.saveState() === "saving")) {
      event.preventDefault(); event.returnValue = "";
    }
  }

  async loadList() {
    await this.flush();
    if (!this.submitted() && this.body() !== (this.detail()?.response?.body ?? "")) return;
    this.detail.set(null);
    await this.attempt(async () => this.list.set(await this.request<Summary[]>("discursive")));
  }
  async open(id: string) {
    await this.attempt(async () => {
      const detail = await this.request<Detail>(this.endpoint(id));
      this.detail.set(detail);
      this.body.set(detail.response?.body ?? "");
      this.levelsDraft.set(detail.criteria.map((_, i) => detail.response?.assessment?.levels[i] ?? null));
      this.saveState.set(detail.response ? "saved" : "idle");
      this.publishDraftState();
    });
  }
  criterionLabel(criterion: Criterion) {
    return criterion.label ? `Item ${criterion.label})` : "Resposta completa";
  }

  // Rascunho: salva um pouco depois de parar de digitar e ao sair do campo.
  write(value: string) {
    if (this.locked) return;
    this.body.set(value);
    this.saveState.set("idle");
    this.publishDraftState();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), AUTOSAVE_MS);
  }
  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.pendingSave) return this.pendingSave;
    this.pendingSave = this.saveDrafts();
    try { await this.pendingSave; } finally { this.pendingSave = null; }
  }

  /** A prova só troca de questão depois da confirmação do rascunho. */
  async saveBeforeLeave(): Promise<boolean> {
    await this.flush();
    return !!this.detail() && !this.busy()
      && (this.submitted() || this.body() === (this.detail()?.response?.body ?? ""));
  }

  /** Uma gravação por vez; texto digitado durante o pedido usa a revisão confirmada. */
  private async saveDrafts() {
    while (!this.locked && !this.destroyed) {
      const detail = this.detail();
      if (!detail || this.submitted() || this.body() === (detail.response?.body ?? "")) break;
      const body = this.body(), endpoint = this.endpoint(detail.id);
      this.saveState.set("saving"); this.publishDraftState();
      const ok = await this.attempt(async () => {
        const { revision } = await this.request<{ revision: number }>(`${endpoint}/response`,
          { body, baseRevision: detail.response?.revision ?? 0 }, "PUT");
        if (this.detail()?.id === detail.id)
          this.detail.set({ ...detail, response: { body, revision, submittedAt: null, assessment: null } });
      }, false);
      this.saveState.set(ok ? "saved" : "idle");
      this.publishDraftState();
      if (!ok) break;
    }
  }

  async reloadDraft() {
    const detail = this.detail();
    if (!detail || this.pendingSave) return;
    const dirty = this.body() !== (detail.response?.body ?? "");
    if (dirty && !await this.choice.confirm({ title: "Descartar alterações locais?",
      message: "A discursiva será reaberta com o texto confirmado no servidor.",
      cancel: "Continuar escrevendo", confirm: "Descartar e reabrir" })) return;
    if (this.timer) clearTimeout(this.timer);
    this.body.set(detail.response?.body ?? ""); this.publishDraftState();
    await this.open(detail.id);
  }
  async submit() {
    const detail = this.detail();
    if (!detail || this.attemptId || !this.body().trim()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.attempt(async () => {
      const result = await this.request<{ response: Response; standardImages: Image[]; standardUrl: string }>(`discursive/${detail.id}/submit`,
        { body: this.body(), baseRevision: detail.response?.revision ?? 0 });
      this.detail.set({ ...detail, response: result.response, standardImages: result.standardImages, standardUrl: result.standardUrl });
    });
  }
  rate(index: number, level: Level) {
    this.levelsDraft.update((levels) => levels.map((current, i) => (i === index ? level : current)));
  }
  async saveAssessment() {
    const detail = this.detail();
    if (!detail || !this.assessed()) return;
    await this.attempt(async () => {
      const assessment = await this.request<{ levels: Level[]; score: number }>(`${this.endpoint(detail.id)}/assessment`,
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
    return requestJson<T>("/api/" + path, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
}
