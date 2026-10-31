import { Component, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

// Importação de provas (IMP-1): envio dos PDFs e editor das caixas de cada
// questão. As caixas ficam em pontos do PDF; na tela são posicionadas em
// porcentagem da página, para valer em qualquer largura.
type Box = { page: number; x0: number; y0: number; x1: number; y1: number };
type ItemStatus = "PENDING" | "CONFIRMED" | "EXCLUDED";
type ImportItem = {
  key: string; number: number; kind: "OBJECTIVE" | "DISCURSIVE"; answer: string | null;
  keyAnswer: string | null; answerNote: string | null;
  boxes: Box[]; status: ItemStatus; area: string | null; subject: string | null;
  warnings: string[]; revision: number;
};
type ImportBatch = {
  id: string; year: number; modality: string; state: string; failure: string | null;
  pageCount: number | null; pageSizes: { width: number; height: number }[] | null; issues: string[];
  areas: string[]; items: ImportItem[];
};
type BatchSummary = { id: string; year: number; modality: string; state: string; total: number; confirmed: number; excluded: number };
type Drag = { index: number; mode: "move" | "resize"; startX: number; startY: number; origin: Box; width: number; height: number };

export const STATUS_LABEL: Record<ItemStatus, string> = { PENDING: "A conferir", CONFIRMED: "Confirmada", EXCLUDED: "Fora" };
export const STATE_LABEL: Record<string, string> = {
  PROCESSING: "Processando", READY: "Pronta para conferir", FAILED: "Falhou", PUBLISHED: "Publicada",
};

@Component({
  selector: "app-exam-import",
  imports: [FormsModule],
  templateUrl: "./exam-import.component.html",
})
export class ExamImportComponent {
  readonly statusLabel = STATUS_LABEL;
  readonly stateLabel = STATE_LABEL;
  batches = signal<BatchSummary[]>([]);
  batch = signal<ImportBatch | null>(null);
  selectedKey = signal<string | null>(null);
  page = signal(1);
  busy = signal(false);
  error = signal("");
  notice = signal("");
  form = { year: new Date().getFullYear(), modality: "BACHARELADO", examUrl: "", keyUrl: "" };
  files: { exam?: File; key?: File } = {};
  // Troca de letra em edição: só é salva junto com a justificativa.
  answerDraft = signal<string | null>(null);
  noteDraft = "";
  private drag: Drag | null = null;
  private poll: ReturnType<typeof setTimeout> | null = null;

  selected = computed(() => this.batch()?.items.find((item) => item.key === this.selectedKey()) ?? null);
  pageBoxes = computed(() =>
    (this.selected()?.boxes ?? []).map((box, index) => ({ box, index })).filter(({ box }) => box.page === this.page()));
  counts = computed(() => {
    const items = this.batch()?.items ?? [];
    return {
      confirmed: items.filter((i) => i.status === "CONFIRMED").length,
      pending: items.filter((i) => i.status === "PENDING" && i.kind === "OBJECTIVE").length,
      total: items.length,
    };
  });

  ngOnInit() {
    void this.loadList();
  }
  ngOnDestroy() {
    if (this.poll) clearTimeout(this.poll);
  }

  async loadList() {
    await this.attempt(async () => this.batches.set(await this.request<BatchSummary[]>("imports")));
  }
  pickFile(kind: "exam" | "key", event: Event) {
    this.files[kind] = (event.target as HTMLInputElement).files?.[0];
  }
  async create() {
    if (!this.files.exam || !this.files.key) {
      this.error.set("Escolha o PDF da prova e o do gabarito.");
      return;
    }
    const data = new FormData();
    for (const [name, value] of Object.entries(this.form)) data.set(name, String(value));
    data.set("exam", this.files.exam);
    data.set("key", this.files.key);
    await this.attempt(async () => {
      const res = await fetch("/api/imports", { method: "POST", body: data });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Não foi possível enviar.");
      const { id } = await res.json();
      await this.open(id);
      void this.loadList();
    });
  }
  async open(id: string) {
    if (this.poll) clearTimeout(this.poll);
    await this.attempt(async () => {
      const batch = await this.request<ImportBatch>(`imports/${id}`);
      this.batch.set(batch);
      if (batch.state === "PROCESSING") this.poll = setTimeout(() => void this.open(id), 1500);
      else if (!this.selectedKey() || !batch.items.some((i) => i.key === this.selectedKey()))
        this.select(batch.items.find((i) => i.kind === "OBJECTIVE")?.key ?? null);
    });
  }
  close() {
    this.batch.set(null);
    this.selectedKey.set(null);
    void this.loadList();
  }
  select(key: string | null) {
    this.selectedKey.set(key);
    this.answerDraft.set(null);
    this.noteDraft = "";
    const first = this.batch()?.items.find((i) => i.key === key)?.boxes[0];
    if (first) this.page.set(first.page);
  }
  pageUrl() {
    return `/api/imports/${this.batch()!.id}/pages/${this.page()}`;
  }
  // Posição em porcentagem da página (pontos do PDF → CSS).
  boxStyle(box: Box) {
    const size = this.batch()!.pageSizes![box.page - 1];
    return {
      "--x": `${(box.x0 / size.width) * 100}%`, "--y": `${(box.y0 / size.height) * 100}%`,
      "--w": `${((box.x1 - box.x0) / size.width) * 100}%`, "--h": `${((box.y1 - box.y0) / size.height) * 100}%`,
    };
  }
  addBox() {
    const size = this.batch()?.pageSizes?.[this.page() - 1];
    const item = this.selected();
    if (!size || !item) return;
    const box = { page: this.page(), x0: size.width * 0.1, y0: size.height * 0.1, x1: size.width * 0.9, y1: size.height * 0.4 };
    this.updateItem({ ...item, boxes: [...item.boxes, box] });
  }
  removeBox(index: number) {
    const item = this.selected();
    if (item) this.updateItem({ ...item, boxes: item.boxes.filter((_, i) => i !== index) });
  }
  startDrag(event: PointerEvent, index: number, mode: Drag["mode"]) {
    const item = this.selected();
    const surface = (event.currentTarget as HTMLElement).closest(".import-page") as HTMLElement | null;
    if (!item || !surface) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const rect = surface.getBoundingClientRect();
    this.drag = { index, mode, startX: event.clientX, startY: event.clientY, origin: { ...item.boxes[index] }, width: rect.width, height: rect.height };
  }
  moveDrag(event: PointerEvent) {
    const item = this.selected(), drag = this.drag;
    if (!item || !drag) return;
    const size = this.batch()!.pageSizes![drag.origin.page - 1];
    const dx = ((event.clientX - drag.startX) / drag.width) * size.width;
    const dy = ((event.clientY - drag.startY) / drag.height) * size.height;
    const o = drag.origin;
    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
    const next = drag.mode === "move"
      ? (() => {
          const x0 = clamp(o.x0 + dx, 0, size.width - (o.x1 - o.x0));
          const y0 = clamp(o.y0 + dy, 0, size.height - (o.y1 - o.y0));
          return { ...o, x0, y0, x1: x0 + (o.x1 - o.x0), y1: y0 + (o.y1 - o.y0) };
        })()
      : { ...o, x1: clamp(o.x1 + dx, o.x0 + 12, size.width), y1: clamp(o.y1 + dy, o.y0 + 12, size.height) };
    this.patchLocal({ ...item, boxes: item.boxes.map((b, i) => (i === drag.index ? next : b)) });
  }
  endDrag() {
    if (!this.drag) return;
    this.drag = null;
    const item = this.selected();
    if (item) void this.save(item);
  }
  // Teclado: setas movem a caixa 2 pontos; com Shift, redimensionam.
  nudge(event: KeyboardEvent, index: number) {
    const delta: Record<string, [number, number]> = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] };
    const step = delta[event.key];
    const item = this.selected();
    if (!step || !item) return;
    event.preventDefault();
    const b = item.boxes[index];
    const next = event.shiftKey
      ? { ...b, x1: b.x1 + step[0], y1: b.y1 + step[1] }
      : { ...b, x0: b.x0 + step[0], x1: b.x1 + step[0], y0: b.y0 + step[1], y1: b.y1 + step[1] };
    this.updateItem({ ...item, boxes: item.boxes.map((box, i) => (i === index ? next : box)) });
  }
  setStatus(status: ItemStatus) {
    const item = this.selected();
    if (item) void this.save({ ...item, status }).then((ok) => ok && status !== "PENDING" && this.selectNextPending());
  }
  setField(field: "area" | "subject", value: string) {
    const item = this.selected();
    if (item) this.updateItem({ ...item, [field]: value.trim() || null });
  }
  chooseAnswer(value: string) {
    const item = this.selected();
    if (!item) return;
    const answer = value || null;
    if (answer === item.keyAnswer) {
      this.answerDraft.set(null);
      this.updateItem({ ...item, answer, answerNote: null });
    } else this.answerDraft.set(answer);
  }
  saveAnswer() {
    const item = this.selected(), answer = this.answerDraft();
    if (!item || this.noteDraft.trim().length < 5) return;
    void this.save({ ...item, answer, answerNote: this.noteDraft.trim() }).then((ok) => ok && this.answerDraft.set(null));
  }
  async publish() {
    const batch = this.batch();
    if (!batch) return;
    await this.attempt(async () => {
      const result = await this.request<{ published: number; alreadyPublished: number }>(`imports/${batch.id}/publish`, {});
      this.notice.set(`${result.published} questões publicadas.` + (result.alreadyPublished ? ` ${result.alreadyPublished} já estavam publicadas.` : ""));
      await this.open(batch.id);
    });
  }

  private selectNextPending() {
    const items = this.batch()?.items ?? [];
    const next = items.find((i) => i.kind === "OBJECTIVE" && i.status === "PENDING");
    if (next) this.select(next.key);
  }
  private updateItem(item: ImportItem) {
    this.patchLocal(item);
    void this.save(item);
  }
  private patchLocal(item: ImportItem) {
    this.batch.update((batch) => batch && { ...batch, items: batch.items.map((i) => (i.key === item.key ? item : i)) });
  }
  private async save(item: ImportItem) {
    const batch = this.batch();
    if (!batch) return false;
    return this.attempt(async () => {
      const { revision } = await this.request<{ revision: number }>(`imports/${batch.id}/items/${item.key}`, {
        boxes: item.boxes, status: item.status, area: item.area, subject: item.subject, revision: item.revision,
        answer: item.answer, answerNote: item.answerNote,
      }, "PUT");
      this.patchLocal({ ...item, revision });
    });
  }
  private async attempt(work: () => Promise<void>) {
    this.busy.set(true);
    this.error.set("");
    try {
      await work();
      return true;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Não foi possível concluir.");
      const batch = this.batch();
      if (batch && batch.state !== "PROCESSING") void this.reload(batch.id);
      return false;
    } finally {
      this.busy.set(false);
    }
  }
  private async reload(id: string) {
    try {
      this.batch.set(await this.request<ImportBatch>(`imports/${id}`));
    } catch {
      /* mantém a tela; o erro já foi mostrado */
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
