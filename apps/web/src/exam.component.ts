import {
  afterNextRender, Component, ElementRef, EventEmitter, HostListener, Injector, Input, Output,
  ViewChild, inject, signal, type SimpleChanges,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { QuestionContentComponent } from "./question-content.component";
import type {
  PracticeAvailability, PracticeView, PracticeItem, PracticeAnswer,
} from "./exam.types";

class PracticeError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

@Component({
  selector: "app-exam",
  imports: [FormsModule, QuestionContentComponent],
  templateUrl: "./exam.component.html",
})
export class ExamComponent {
  @Input() attemptId: string | null = null;
  @Input() itemPosition = 1;
  @Output() locationChange = new EventEmitter<{ attemptId: string | null; position: number }>();
  @Output() busyChange = new EventEmitter<boolean>();
  @Output() browse = new EventEmitter<void>();
  @ViewChild("finishDialog") finishDialog?: ElementRef<HTMLDialogElement>;
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private injector = inject(Injector);
  availability = signal<PracticeAvailability | null>(null);
  attempt = signal<PracticeView | null>(null);
  position = signal(1);
  loading = signal(false);
  saving = signal(false);
  error = signal("");
  conflict = signal(false);
  dirty = signal(false);
  // A failed response may already have committed. Keep controls and exit guards
  // locked until the exact pending operation is acknowledged or reloaded.
  saveUncertain = signal(false);
  draftOption = signal<string | null>(null);
  draftMarked = signal(false);
  reviewing = signal(false);
  discardOpen = signal(false);
  mapExpanded = signal(window.innerWidth > 1000);
  private wideViewport = window.innerWidth > 1000;
  size = 20;
  area = "";
  private abort = new AbortController();
  private generation = 0;
  private destroyed = false;
  private lastOperation: "load" | "start" | "save" | "finish" = "load";
  private pendingSave: { attemptId: string; position: number; body: { optionId: string | null; marked: boolean; baseRevision: number } } | null = null;
  private lastLoadId: string | null = null;
  private pendingStart: { requestId: string; size: number; area: string | null } | null = null;

  ngOnInit() { if (this.attemptId) void this.loadAttempt(this.attemptId); else void this.loadAvailability(); }
  ngOnChanges(changes: SimpleChanges) {
    if (changes["attemptId"] && !changes["attemptId"].firstChange && this.attemptId !== (this.attempt()?.id ?? null)) {
      if (this.attemptId) void this.loadAttempt(this.attemptId); else void this.loadAvailability();
    } else if (changes["itemPosition"] && !changes["itemPosition"].firstChange && !this.protectedState()) {
      this.position.set(this.validPosition(this.itemPosition)); this.syncDraft();
    }
  }
  ngOnDestroy() { this.destroyed = true; this.generation++; this.abort.abort(); this.busyChange.emit(false); }
  @HostListener("window:beforeunload", ["$event"])
  beforeUnload(event: BeforeUnloadEvent) { if (this.protectedState()) { event.preventDefault(); event.returnValue = ""; } }
  @HostListener("window:resize")
  resizeMap() {
    const wide = window.innerWidth > 1000;
    if (wide !== this.wideViewport) { this.wideViewport = wide; this.mapExpanded.set(wide); }
  }
  protectedState() { return this.saving() || this.dirty() || this.saveUncertain(); }
  current() { return this.attempt()?.items.find((item) => item.position === this.position()) ?? null; }
  eligibleCount() { return this.area ? this.availability()?.areas.find((row) => row.name === this.area)?.count ?? 0 : this.availability()?.total ?? 0; }
  answered() { return this.attempt()?.items.filter((item) => item.answer.optionId !== null).length ?? 0; }
  marked() { return this.attempt()?.items.filter((item) => item.answer.marked).length ?? 0; }
  isImage(item: PracticeItem) { return item.question.presentation === "IMAGE" && !!item.question.images?.length; }
  outcome(item: PracticeItem, optionId: string) {
    if (!item.result) return null;
    if (item.result.correctOptionId === optionId) return "correct";
    return item.answer.optionId === optionId ? "wrong" : null;
  }
  correctText(item: PracticeItem) { return this.isImage(item) ? item.result?.correctOptionId ?? "" : item.question.options.find((option) => option.id === item.result?.correctOptionId)?.text ?? ""; }
  dateLabel(date: string | null) { return date ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(date)) : ""; }
  private alive(generation: number) { return !this.destroyed && generation === this.generation; }
  private emitBusy() { this.busyChange.emit(this.protectedState()); }
  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch("/api/practice" + path, { ...init, signal: this.abort.signal, headers: { "Content-Type": "application/json" } });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new PracticeError(body?.message || "Verifique a conexão e tente novamente.", response.status);
    return body;
  }
  private message(error: unknown) { return error instanceof Error ? error.message : "Verifique a conexão e tente novamente."; }
  async loadAvailability() {
    if (this.protectedState()) return;
    const generation = ++this.generation;
    this.loading.set(true); this.error.set(""); this.lastOperation = "load";
    this.attempt.set(null); this.reviewing.set(false); this.lastLoadId = null;
    try {
      const data = await this.api<PracticeAvailability>("");
      if (this.alive(generation)) { this.availability.set(data); this.locationChange.emit({ attemptId: null, position: 1 }); this.focusContent(); }
    } catch (error) { if (this.alive(generation)) this.error.set(this.message(error)); }
    finally { if (this.alive(generation)) this.loading.set(false); }
  }
  async openAttempt(id: string) {
    if (this.protectedState()) return;
    await this.loadAttempt(id, 1);
    if (this.attempt()?.id === id) this.locationChange.emit({ attemptId: id, position: this.position() });
  }
  private async loadAttempt(id: string, requestedPosition = this.itemPosition) {
    this.lastLoadId = id;
    const generation = ++this.generation;
    this.loading.set(true); this.error.set(""); this.lastOperation = "load";
    try {
      const data = await this.api<PracticeView>("/" + encodeURIComponent(id));
      if (this.alive(generation)) this.applyAttempt(data, requestedPosition);
    } catch (error) { if (this.alive(generation)) { this.attempt.set(null); this.error.set(this.message(error)); } }
    finally { if (this.alive(generation)) this.loading.set(false); }
  }
  async start() {
    if (this.saving() || this.eligibleCount() < this.size) return;
    const area = this.area || null;
    if (!this.pendingStart || this.pendingStart.size !== this.size || this.pendingStart.area !== area) this.pendingStart = { requestId: crypto.randomUUID(), size: this.size, area };
    const generation = this.generation;
    this.saving.set(true); this.error.set(""); this.lastOperation = "start"; this.emitBusy();
    try {
      const data = await this.api<PracticeView>("", { method: "POST", body: JSON.stringify(this.pendingStart) });
      if (this.alive(generation)) { this.applyAttempt(data, 1); this.pendingStart = null; this.locationChange.emit({ attemptId: data.id, position: 1 }); }
    } catch (error) {
      if (this.alive(generation)) {
        this.error.set(this.message(error));
        // A lost response may already have created the active attempt.
        try { const data = await this.api<PracticeAvailability>(""); if (this.alive(generation)) this.availability.set(data); } catch {}
      }
    } finally { if (this.alive(generation)) { this.saving.set(false); this.emitBusy(); } }
  }
  private applyAttempt(data: PracticeView, position: number) {
    this.attempt.set(data); this.position.set(this.validPosition(position));
    this.reviewing.set(false); this.conflict.set(false); this.discardOpen.set(false); this.syncDraft(); this.focusContent();
  }
  private validPosition(position: number) { const total = this.attempt()?.size ?? 1; return Number.isInteger(position) && position >= 1 && position <= total ? position : 1; }
  private syncDraft() {
    const answer = this.current()?.answer;
    this.draftOption.set(answer?.optionId ?? null); this.draftMarked.set(answer?.marked ?? false); this.dirty.set(false); this.saveUncertain.set(false); this.pendingSave = null; this.emitBusy();
  }
  selectOption(optionId: string | null) {
    if (this.saving() || this.saveUncertain() || this.attempt()?.state !== "IN_PROGRESS") return;
    this.draftOption.set(optionId); this.changed();
  }
  setMarked(marked: boolean) {
    if (this.saving() || this.saveUncertain() || this.attempt()?.state !== "IN_PROGRESS") return;
    this.draftMarked.set(marked); this.changed();
  }
  private changed() {
    const answer = this.current()?.answer;
    this.dirty.set(!!answer && (answer.optionId !== this.draftOption() || answer.marked !== this.draftMarked()));
    this.error.set(""); this.conflict.set(false); this.emitBusy();
    if (this.dirty()) void this.save();
  }
  async save() {
    const item = this.current(), data = this.attempt();
    if (!item || !data || !this.dirty() || this.saving() || data.state !== "IN_PROGRESS") return;
    const generation = this.generation;
    const pending = this.pendingSave ?? { attemptId: data.id, position: item.position,
      body: { optionId: this.draftOption(), marked: this.draftMarked(), baseRevision: item.answer.revision } };
    this.pendingSave = pending;
    this.saving.set(true); this.error.set(""); this.conflict.set(false); this.lastOperation = "save"; this.emitBusy();
    try {
      const answer = await this.api<PracticeAnswer & { position: number }>(`/${pending.attemptId}/items/${pending.position}`, { method: "PUT", body: JSON.stringify(pending.body) });
      if (this.alive(generation)) {
        this.attempt.set({ ...data, items: data.items.map((row) => row.position === item.position ? { ...row, answer: { optionId: answer.optionId, marked: answer.marked, revision: answer.revision } } : row) });
        this.dirty.set(false); this.saveUncertain.set(false); this.pendingSave = null;
      }
    } catch (error) { if (this.alive(generation)) { this.dirty.set(true); this.saveUncertain.set(true); this.error.set(this.message(error)); this.conflict.set(error instanceof PracticeError && error.status === 409); } }
    finally { if (this.alive(generation)) { this.saving.set(false); this.emitBusy(); } }
  }
  go(position: number) {
    if (this.protectedState() || position < 1 || position > (this.attempt()?.size ?? 0)) return;
    this.position.set(position); this.syncDraft(); this.error.set("");
    this.locationChange.emit({ attemptId: this.attempt()!.id, position });
    this.focusContent();
  }
  private focusContent() {
    afterNextRender(() => {
      if (this.destroyed) return;
      const target = !this.attempt() ? "#practice-setup-title"
        : this.attempt()?.state === "COMPLETED" && !this.reviewing() ? "#practice-result-title" : "#practice-position";
      this.host.nativeElement.querySelector<HTMLElement>(target)?.focus();
    }, { injector: this.injector });
  }
  showResult() { this.reviewing.set(false); this.focusContent(); }
  beginReview() { this.reviewing.set(true); this.go(this.position()); }
  showSelection() { if (!this.protectedState()) { void this.loadAvailability(); this.locationChange.emit({ attemptId: null, position: 1 }); } }
  openFinish() { if (!this.protectedState()) { this.error.set(""); this.finishDialog?.nativeElement.showModal(); } }
  async finish() {
    const data = this.attempt(); if (!data || this.protectedState()) return;
    const generation = this.generation;
    this.saving.set(true); this.error.set(""); this.lastOperation = "finish"; this.emitBusy();
    try {
      const completed = await this.api<PracticeView>(`/${data.id}/finish`, { method: "POST", body: "{}" });
      if (this.alive(generation)) {
        this.finishDialog?.nativeElement.close(); this.applyAttempt(completed, 1);
        this.locationChange.emit({ attemptId: completed.id, position: 1 });
        this.focusContent();
      }
    } catch (error) { if (this.alive(generation)) { this.error.set(this.message(error)); this.finishDialog?.nativeElement.close(); } }
    finally { if (this.alive(generation)) { this.saving.set(false); this.emitBusy(); } }
  }
  openDiscard() {
    this.discardOpen.set(true);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>("#practice-discard")?.focus(), 0);
  }
  cancelDiscard() {
    this.discardOpen.set(false);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(".practice-error .outline")?.focus(), 0);
  }
  async discardAndReload() {
    const id = this.attempt()?.id; if (!id || this.saving()) return;
    this.dirty.set(false); this.saveUncertain.set(false); this.pendingSave = null; this.discardOpen.set(false); this.emitBusy(); await this.loadAttempt(id);
    this.focusContent();
  }
  retry() { if (this.lastOperation === "start") void this.start(); else if (this.lastOperation === "finish") void this.finish(); else if (this.lastLoadId) void this.loadAttempt(this.lastLoadId); else void this.loadAvailability(); }
}
