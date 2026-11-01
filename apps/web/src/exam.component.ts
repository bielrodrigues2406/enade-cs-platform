import {
  afterNextRender, Component, ElementRef, EventEmitter, HostListener, Injector, Input, Output,
  ViewChild, computed, inject, signal, type SimpleChanges,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ChoiceService } from "./choice-dialog";
import { QuestionContentComponent } from "./question-content.component";
import { DiscursiveComponent } from "./discursive.component";
import type {
  Edition, EditionList, PracticeAvailability, PracticeView, PracticeItem, PracticeAnswer,
} from "./exam.types";
import { AREA_SIMULATION_LIMIT, attemptLabel, chooseAreaSimulation, type PracticeRequest } from "./practice-request";

/** Folga para o servidor encerrar a prova depois do prazo (igual à da API). */
const DEADLINE_GRACE_MS = 16000;
/** A partir daqui o cronômetro pede atenção. */
const WARNING_MS = 15 * 60000;

/** Tempo restante em h:mm:ss. */
export function clock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

class PracticeError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

@Component({
  selector: "app-exam",
  imports: [FormsModule, QuestionContentComponent, DiscursiveComponent],
  templateUrl: "./exam.component.html",
  styleUrl: "./exam.component.css",
})
export class ExamComponent {
  @Input() attemptId: string | null = null;
  @Input() itemPosition = 1;
  @Output() locationChange = new EventEmitter<{ attemptId: string | null; position: number }>();
  @Output() busyChange = new EventEmitter<boolean>();
  @Output() browse = new EventEmitter<void>();
  /** Depois da prova completa: ver o padrão de resposta e se autoavaliar. */
  @Output() discursiveStudy = new EventEmitter<void>();
  /** Prova completa com o cronômetro correndo (o shell pede confirmação para sair). */
  @Output() examRunningChange = new EventEmitter<boolean>();
  @ViewChild("finishDialog") finishDialog?: ElementRef<HTMLDialogElement>;
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private injector = inject(Injector);
  private choice = inject(ChoiceService);
  availability = signal<PracticeAvailability | null>(null);
  attempt = signal<PracticeView | null>(null);
  position = signal(1);
  /** 1 ao avançar, -1 ao voltar: a próxima questão entra pelo lado certo. */
  stepDirection = signal(1);
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
  /** Treino com tempo (minutos por questão vêm da API). */
  timed = false;
  // Prova completa da edição (SIM-1).
  editions = signal<EditionList | null>(null);
  chosenEdition = signal<Edition | null>(null);
  discursiveOpen = signal<string | null>(null);
  now = signal(Date.now());
  /** Tempo restante do servidor e o instante em que chegou: o relógio local só desconta daí. */
  private clockAt = 0;
  remaining = computed(() => {
    const data = this.attempt();
    if (data?.remainingMs == null || data.state !== "IN_PROGRESS") return null;
    return data.pausedAt ? data.remainingMs : data.remainingMs - (this.now() - this.clockAt);
  });
  readonly clock = clock;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private expiryReload: ReturnType<typeof setTimeout> | null = null;
  private pendingEditionStart: { requestId: string; source: string } | null = null;
  private abort = new AbortController();
  private generation = 0;
  private destroyed = false;
  private lastOperation: "load" | "start" | "save" | "finish" = "load";
  private pendingSave: { attemptId: string; position: number; body: { optionId: string | null; marked: boolean; baseRevision: number } } | null = null;
  private lastLoadId: string | null = null;
  private pendingStart: { key: string; body: PracticeRequest & { requestId: string } } | null = null;

  ngOnInit() { if (this.attemptId) void this.loadAttempt(this.attemptId); else void this.loadAvailability(); }
  ngOnChanges(changes: SimpleChanges) {
    if (changes["attemptId"] && !changes["attemptId"].firstChange && this.attemptId !== (this.attempt()?.id ?? null)) {
      if (this.attemptId) void this.loadAttempt(this.attemptId); else void this.loadAvailability();
    } else if (changes["itemPosition"] && !changes["itemPosition"].firstChange && !this.protectedState()) {
      this.position.set(this.validPosition(this.itemPosition)); this.syncDraft();
    }
  }
  ngOnDestroy() {
    this.pauseOnExit();
    this.destroyed = true; this.generation++; this.abort.abort(); this.stopClock(); this.busyChange.emit(false); this.examRunningChange.emit(false);
  }
  @HostListener("window:beforeunload", ["$event"])
  beforeUnload(event: BeforeUnloadEvent) { if (this.protectedState() || this.running()) { event.preventDefault(); event.returnValue = ""; } }
  /** Fechar ou recarregar a página pausa a prova; as respostas já estão no servidor. */
  @HostListener("window:pagehide")
  pageHide() { this.pauseOnExit(); }
  @HostListener("window:resize")
  resizeMap() {
    const wide = window.innerWidth > 1000;
    if (wide !== this.wideViewport) { this.wideViewport = wide; this.mapExpanded.set(wide); }
  }
  protectedState() { return this.saving() || this.dirty() || this.saveUncertain(); }
  current() { return this.attempt()?.items.find((item) => item.position === this.position()) ?? null; }
  eligibleCount() { return this.areaRow()?.count ?? (this.area ? 0 : this.availability()?.total ?? 0); }
  unseenCount() { return this.areaRow()?.unseen ?? (this.area ? 0 : this.availability()?.unseen ?? 0); }
  private areaRow() { return this.area ? this.availability()?.areas.find((row) => row.name === this.area) : undefined; }
  /** Com área: 5/10/20/30 que caibam e, se o total for outro número, "todas". Sem área: 10/20/30. */
  sizeOptions(): { value: number; label: string }[] {
    const data = this.availability();
    if (!data) return [];
    if (!this.area) return data.sizes.map((value) => ({ value, label: `${value} questões` }));
    const count = this.eligibleCount();
    const options = data.areaSizes.filter((value) => value <= count).map((value) => ({ value, label: `${value} questões` }));
    if (count > 0 && count <= 30 && !data.areaSizes.includes(count)) options.push({ value: count, label: `Todas (${count})` });
    return options;
  }
  /** Ao trocar a área, mantém o tamanho se ele existir nela; senão, o maior possível. */
  areaChanged() {
    const options = this.sizeOptions();
    if (!options.some((option) => option.value === this.size)) this.size = options.at(-1)?.value ?? this.size;
  }
  timedMinutes() { return this.size * (this.availability()?.minutesPerQuestion ?? 4); }
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
  private async api<T>(path: string, init: RequestInit = {}, base = "/api/practice"): Promise<T> {
    const response = await fetch(base + path, { ...init, signal: this.abort.signal, headers: { "Content-Type": "application/json" } });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new PracticeError(body?.message || "Verifique a conexão e tente novamente.", response.status);
    return body;
  }
  private message(error: unknown) { return error instanceof Error ? error.message : "Verifique a conexão e tente novamente."; }
  async loadAvailability() {
    if (this.protectedState()) return;
    this.pauseOnExit();
    const generation = ++this.generation;
    this.loading.set(true); this.error.set(""); this.lastOperation = "load";
    this.attempt.set(null); this.reviewing.set(false); this.lastLoadId = null;
    try {
      const [data, editions] = await Promise.all([
        this.api<PracticeAvailability>(""), this.api<EditionList>("", {}, "/api/editions"),
      ]);
      if (this.alive(generation)) {
        this.availability.set(data); this.editions.set(editions); this.chosenEdition.set(null);
        this.locationChange.emit({ attemptId: null, position: 1 }); this.focusContent();
      }
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
  /** Treino montado no formulário: área, quantidade e cronômetro. */
  start() {
    if (this.eligibleCount() < this.size) return;
    void this.begin({ area: this.area || null, size: this.size, timed: this.timed });
  }
  /** Simulado de uma área: até 30 questões; a pessoa escolhe se corre o cronômetro. */
  async simulateArea(row: { name: string; count: number }) {
    const request = await chooseAreaSimulation(this.choice, row.name, row.count, this.availability()?.minutesPerQuestion);
    if (request) void this.begin(request);
  }
  /** Erros do estudo livre que já passaram do intervalo de revisão. */
  practiceErrors() { void this.begin({ area: null, focus: "ERRORS" }); }
  /** Erradas e em branco do treino ou prova finalizado. */
  retryMisses() {
    const data = this.attempt();
    if (data?.state === "COMPLETED") void this.begin({ area: null, focus: "RETRY", retryOf: data.id });
  }
  misses() { const summary = this.attempt()?.summary; return summary ? summary.incorrect + summary.unanswered : 0; }
  readonly attemptLabel = attemptLabel;
  simulationSize(count: number) { return Math.min(count, AREA_SIMULATION_LIMIT); }
  /**
   * Cria o treino. Repetir o mesmo pedido (como em "Tentar novamente") reusa o
   * requestId: se a resposta anterior se perdeu, o servidor devolve o mesmo treino.
   */
  private async begin(request?: PracticeRequest) {
    if (this.saving()) return;
    const key = request && JSON.stringify(request);
    if (request && this.pendingStart?.key !== key) this.pendingStart = { key: key!, body: { ...request, requestId: crypto.randomUUID() } };
    if (!this.pendingStart) return;
    const generation = this.generation;
    this.saving.set(true); this.error.set(""); this.lastOperation = "start"; this.emitBusy();
    try {
      const data = await this.api<PracticeView>("", { method: "POST", body: JSON.stringify(this.pendingStart.body) });
      if (this.alive(generation)) { this.applyAttempt(data, 1); this.pendingStart = null; this.locationChange.emit({ attemptId: data.id, position: 1 }); }
    } catch (error) {
      if (this.alive(generation)) {
        this.error.set(this.message(error));
        // A lost response may already have created the active attempt.
        try { const data = await this.api<PracticeAvailability>(""); if (this.alive(generation)) this.availability.set(data); } catch {}
      }
    } finally { if (this.alive(generation)) { this.saving.set(false); this.emitBusy(); } }
  }
  /** Começa a prova da edição escolhida; repetir a mesma solicitação devolve a mesma prova. */
  async startEdition() {
    const edition = this.chosenEdition();
    if (!edition || this.saving()) return;
    if (this.pendingEditionStart?.source !== edition.id) this.pendingEditionStart = { requestId: crypto.randomUUID(), source: edition.id };
    const { requestId, source } = this.pendingEditionStart;
    const generation = this.generation;
    this.saving.set(true); this.error.set(""); this.emitBusy();
    try {
      const data = await this.api<PracticeView>(`/${source}/attempts`, { method: "POST", body: JSON.stringify({ requestId }) }, "/api/editions");
      if (this.alive(generation)) { this.applyAttempt(data, 1); this.pendingEditionStart = null; this.locationChange.emit({ attemptId: data.id, position: 1 }); }
    } catch (error) {
      if (this.alive(generation)) this.error.set(this.message(error));
    } finally { if (this.alive(generation)) { this.saving.set(false); this.emitBusy(); } }
  }
  missingLabel(edition: Edition) {
    const list = edition.missing;
    if (!list.length) return "";
    if (list.length === 1) return `falta a ${list[0]}`;
    // Lista longa polui o cartão: acima de três, só a quantidade.
    if (list.length > 3) return `faltam ${list.length} questões`;
    return `faltam ${list.slice(0, -1).join(", ")} e ${list.at(-1)}`;
  }
  modalityLabel(modality: string) {
    return ({ BACHARELADO: "Bacharelado", LICENCIATURA: "Licenciatura", COMUM: "Caderno compartilhado" } as Record<string, string>)[modality] ?? modality;
  }
  openDiscursiveItem(id: string) {
    if (this.protectedState()) return;
    this.discursiveOpen.set(id); this.error.set("");
    this.focusContent();
  }
  /** O cronômetro só mostra o prazo do servidor; ao zerar, recarrega o resultado registrado. */
  private syncClock() {
    this.stopClock();
    const data = this.attempt();
    if (data?.remainingMs == null || data.state !== "IN_PROGRESS" || data.pausedAt) return;
    this.now.set(Date.now());
    this.ticker = setInterval(() => {
      this.now.set(Date.now());
      if ((this.remaining() ?? 1) <= 0 && !this.expiryReload) {
        const id = data.id;
        this.expiryReload = setTimeout(() => { this.expiryReload = null; this.discursiveOpen.set(null); void this.loadAttempt(id, 1); }, DEADLINE_GRACE_MS);
      }
    }, 1000);
  }
  private stopClock() {
    if (this.ticker) clearInterval(this.ticker);
    if (this.expiryReload) clearTimeout(this.expiryReload);
    this.ticker = null; this.expiryReload = null;
  }
  timeUp() { return (this.remaining() ?? 1) <= 0; }
  /** Prova ou treino cronometrado em andamento, sem pausa. */
  running() { const data = this.attempt(); return Boolean(data?.deadlineAt) && data!.state === "IN_PROGRESS" && !data!.pausedAt; }
  async pause() { await this.setPaused(true); }
  async resume() { await this.setPaused(false); }
  private async setPaused(paused: boolean) {
    const data = this.attempt();
    if (!data || this.protectedState()) return;
    const generation = this.generation;
    this.saving.set(true); this.error.set(""); this.emitBusy();
    try {
      const next = await this.api<PracticeView>(`/${data.id}/${paused ? "pause" : "resume"}`, { method: "POST", body: "{}" });
      if (this.alive(generation)) this.applyAttempt(next, this.position());
    } catch (error) { if (this.alive(generation)) this.error.set(this.message(error)); }
    finally { if (this.alive(generation)) { this.saving.set(false); this.emitBusy(); } }
  }
  /** Saída sem esperar resposta: keepalive deixa o pedido terminar mesmo com a página fechando. */
  private pauseOnExit() {
    if (!this.running()) return;
    const id = this.attempt()!.id;
    this.examRunningChange.emit(false);
    void fetch(`/api/practice/${id}/pause`, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => undefined);
  }
  timeWarning() { const left = this.remaining(); return left !== null && left > 0 && left <= WARNING_MS; }
  private applyAttempt(data: PracticeView, position: number) {
    this.attempt.set(data); this.position.set(this.validPosition(position)); this.discursiveOpen.set(null);
    this.clockAt = Date.now(); this.syncClock(); this.examRunningChange.emit(this.running());
    this.reviewing.set(false); this.conflict.set(false); this.discardOpen.set(false); this.syncDraft(); this.focusContent();
  }
  private validPosition(position: number) { const total = this.attempt()?.size ?? 1; return Number.isInteger(position) && position >= 1 && position <= total ? position : 1; }
  private syncDraft() {
    const answer = this.current()?.answer;
    this.draftOption.set(answer?.optionId ?? null); this.draftMarked.set(answer?.marked ?? false); this.dirty.set(false); this.saveUncertain.set(false); this.pendingSave = null; this.emitBusy();
  }
  selectOption(optionId: string | null) {
    if (this.saving() || this.saveUncertain() || this.attempt()?.state !== "IN_PROGRESS" || this.timeUp()) return;
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
    this.stepDirection.set(position >= this.position() ? 1 : -1);
    this.position.set(position); this.discursiveOpen.set(null); this.syncDraft(); this.error.set("");
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
  /** Nome do que está aberto, para os rótulos de saída. */
  kindLabel(data: PracticeView) { return data.edition ? "prova" : data.deadlineAt ? "simulado" : "treino"; }
  async showSelection() {
    if (this.protectedState()) return;
    const data = this.attempt();
    if (data?.state === "IN_PROGRESS") {
      const kind = this.kindLabel(data);
      const timed = this.running();
      const choice = await this.choice.choose({
        eyebrow: timed ? "Cronômetro correndo" : "Respostas salvas",
        title: `Sair ${kind === "prova" ? "da" : "do"} ${kind}?`,
        message: timed
          ? "Ao sair, o cronômetro pausa e suas respostas ficam salvas. Você retoma de onde parou."
          : "Suas respostas ficam salvas e você retoma de onde parou. Se já terminou, finalize para ver o resultado.",
        cancel: null,
        actions: [
          { value: "cancel", label: `Cancelar ${kind === "prova" ? "a" : "o"} ${kind}`, kind: "danger-link" },
          { value: "leave", label: timed ? "Pausar e sair" : "Sair", kind: "outline" },
          { value: "finish", label: "Finalizar agora" },
        ],
      });
      if (choice === "finish") { this.openFinish(); return; }
      if (choice === "cancel") { await this.cancelAttempt(data.id, kind); return; }
      if (choice !== "leave") return;
      if (this.running()) { await this.pause(); if (this.running()) return; }
    }
    void this.loadAvailability(); this.locationChange.emit({ attemptId: null, position: 1 });
  }
  /** Apaga o treino em andamento e suas respostas, depois de confirmar. */
  async cancelAttempt(id: string, kind: string) {
    const article = kind === "prova" ? "a" : "o";
    const ok = await this.choice.confirm({
      eyebrow: "Sem volta",
      title: `Cancelar ${article} ${kind}?`,
      message: `As respostas ${kind === "prova" ? "desta" : "deste"} ${kind} são apagadas e não entram no resultado. Use para recomeçar do zero.`,
      cancel: "Voltar",
      confirm: `Cancelar ${article} ${kind}`,
      danger: true,
    });
    if (!ok || this.protectedState()) return;
    const generation = this.generation;
    this.saving.set(true); this.error.set(""); this.emitBusy();
    try {
      await this.api(`/${id}/cancel`, { method: "POST", body: "{}" });
      if (!this.alive(generation)) return;
      this.attempt.set(null); this.examRunningChange.emit(false);
      this.saving.set(false);
      await this.loadAvailability();
      this.locationChange.emit({ attemptId: null, position: 1 });
    } catch (error) { if (this.alive(generation)) this.error.set(this.message(error)); }
    finally { if (this.alive(generation)) { this.saving.set(false); this.emitBusy(); } }
  }
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
  retry() { if (this.lastOperation === "start") void this.begin(); else if (this.lastOperation === "finish") void this.finish(); else if (this.lastLoadId) void this.loadAttempt(this.lastLoadId); else void this.loadAvailability(); }
}
