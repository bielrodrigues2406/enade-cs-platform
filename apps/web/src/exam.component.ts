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
  template: `
    @if (loading()) {
      <h1>Treino parcial</h1>
      <p role="status">Carregando seu treino…</p>
    } @else if (attempt(); as data) {
      @if (data.state === 'COMPLETED' && !reviewing()) {
        <section class="page-intro">
          <p class="metadata">Treino parcial · {{ data.area || 'Assuntos mistos' }}</p>
          <h1 id="practice-result-title" tabindex="-1">Resultado do treino</h1>
          @if (data.summary; as result) {
            <p class="practice-score"><strong>{{ result.correct }} de {{ result.total }}</strong> acertos</p>
            <p>{{ result.incorrect }} {{ result.incorrect === 1 ? 'errada' : 'erradas' }} · {{ result.unanswered }} {{ result.unanswered === 1 ? 'não respondida' : 'não respondidas' }}.</p>
            <p class="muted">Resultado deste treino, sem previsão de nota ENADE. As respostas ficam separadas do estudo livre.</p>
            <p class="metadata">{{ result.official }} oficiais · {{ result.author }} autorais · {{ result.demonstration }} demonstrações autorais.</p>
            <div class="practice-table-wrap">
              <table class="practice-table">
                <caption>Resultado por assunto</caption>
                <thead><tr><th scope="col">Assunto</th><th scope="col">Acertos</th><th scope="col">Em branco</th></tr></thead>
                <tbody>
                  @for (row of result.byTopic; track row.topic) {
                    <tr><th scope="row">{{ row.topic }}</th><td>{{ row.correct }} de {{ row.total }}</td><td>{{ row.unanswered }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="practice-actions">
              <button (click)="beginReview()">Rever respostas</button>
              <button class="outline" (click)="showSelection()">Voltar aos treinos</button>
            </div>
          }
        </section>
      } @else if (current(); as item) {
        <div class="practice-toolbar">
          <button class="text-button" (click)="data.state === 'COMPLETED' ? showResult() : showSelection()" [disabled]="protectedState()">{{ data.state === 'COMPLETED' ? '← Voltar ao resultado' : '← Voltar aos treinos' }}</button>
          <p class="metadata">{{ data.area || 'Assuntos mistos' }} · sem cronômetro</p>
        </div>
        <div class="practice-layout">
          <section class="practice-sheet">
            <p id="practice-position" class="practice-position" tabindex="-1">Questão {{ position() }} de {{ data.size }}</p>
            <article class="resolution">
              <app-question-content [question]="item.question" />
              <fieldset class="practice-options" [class.answer-sheet]="isImage(item)" [disabled]="saving() || saveUncertain() || data.state === 'COMPLETED'">
                <legend>{{ isImage(item) ? 'Marque a alternativa da imagem' : 'Selecione uma alternativa' }}</legend>
                @for (option of item.question.options; track option.id; let i = $index) {
                  <div class="option-row" [class.is-correct]="outcome(item, option.id) === 'correct'" [class.is-wrong]="outcome(item, option.id) === 'wrong'">
                    <label class="option" [class.selected]="draftOption() === option.id">
                      <input type="radio" name="practice-answer" [value]="option.id" [checked]="draftOption() === option.id" (change)="selectOption(option.id)" [attr.aria-label]="isImage(item) ? 'Alternativa ' + option.id : null" />
                      <span class="letter" aria-hidden="true">{{ 'ABCDE'[i] }}</span>
                      @if (!isImage(item)) { <span>{{ option.text }}</span> }
                    </label>
                    @if (outcome(item, option.id); as state) {
                      <span class="option-tag">{{ state === 'correct' ? 'Alternativa correta' : 'Sua resposta' }}</span>
                    }
                  </div>
                }
              </fieldset>
              @if (data.state === 'IN_PROGRESS') {
                <div class="practice-answer-actions">
                  <label class="practice-mark"><input type="checkbox" [checked]="draftMarked()" (change)="setMarked($any($event.target).checked)" [disabled]="saving() || saveUncertain()" /> Marcar para revisar</label>
                  <button class="text-button" (click)="selectOption(null)" [disabled]="saving() || saveUncertain() || draftOption() === null">Limpar resposta</button>
                </div>
                <p class="practice-save-status" role="status">{{ saving() ? 'Salvando…' : dirty() ? 'Seleção ainda não salva.' : item.answer.revision ? 'Alterações salvas.' : 'Ainda não respondida.' }}</p>
              } @else if (item.result; as result) {
                <section class="feedback" [class.is-correct]="result.correct === true" [class.is-wrong]="result.correct === false" aria-label="Correção da questão">
                  <h2>{{ result.correct === null ? 'Não respondida' : result.correct ? 'Resposta correta' : 'Resposta incorreta' }}</h2>
                  <p><strong>Alternativa correta:</strong> {{ correctText(item) }}</p>
                  @if (result.explanation) {
                    <p class="feedback-explanation">{{ result.explanation }}</p>
                    @if (result.explanationCredit) { <p class="metadata">{{ result.explanationCredit }}</p> }
                  } @else { <p>Ainda não há explicação para esta questão.</p> }
                  @if (result.answerKey; as key) {
                    <p><a [href]="key.officialUrl" target="_blank" rel="noopener noreferrer">{{ key.finality === 'ONLY_PUBLISHED' ? 'Gabarito publicado pelo Inep' : 'Gabarito definitivo' }}: {{ key.title }}</a> · página {{ key.page }}</p>
                    @if (key.finality === 'ONLY_PUBLISHED') { <p class="metadata">O Inep não indicou este gabarito como definitivo. É o único gabarito publicado que foi localizado para esta prova.</p> }
                  }
                </section>
              }
            </article>
            <div class="practice-actions practice-item-actions">
              <button class="outline" (click)="go(position() - 1)" [disabled]="protectedState() || position() === 1">Anterior</button>
              <button class="outline" (click)="go(position() + 1)" [disabled]="protectedState() || position() === data.size">Próxima questão</button>
            </div>
          </section>
          <nav class="practice-map" aria-label="Questões do treino">
            <details [open]="mapExpanded()" (toggle)="mapExpanded.set($any($event.target).open)">
              <summary><strong>Folha de respostas</strong><span>{{ answered() }} de {{ data.size }} respondidas</span></summary>
            <ol>
              @for (row of data.items; track row.position) {
                <li><button class="outline" [class.is-answered]="row.answer.optionId !== null" [class.is-marked]="row.answer.marked" [attr.aria-current]="position() === row.position ? 'step' : null" [attr.aria-label]="'Questão ' + row.position + ', ' + (row.answer.optionId !== null ? 'respondida' : 'em branco') + (row.answer.marked ? ', marcada para revisar' : '')" (click)="go(row.position)" [disabled]="protectedState()">{{ row.position }}<span aria-hidden="true">{{ row.answer.marked ? '*' : row.answer.optionId !== null ? '✓' : '' }}</span></button></li>
              }
            </ol>
            <p class="metadata">✓ Respondida · * Revisar</p>
            </details>
            @if (data.state === 'IN_PROGRESS') {
              <button (click)="openFinish()" [disabled]="protectedState()">Revisar e finalizar</button>
              <p class="metadata">Gabarito e resultado aparecem ao finalizar.</p>
            }
          </nav>
        </div>
        @if (data.state === 'IN_PROGRESS') {
          <dialog #finishDialog class="practice-confirm" aria-labelledby="practice-confirm-title">
            <h2 id="practice-confirm-title">Finalizar este treino?</h2>
            <p>{{ answered() }} respondidas · {{ data.size - answered() }} em branco · {{ marked() }} {{ marked() === 1 ? 'marcada' : 'marcadas' }} para revisar.</p>
            <p>Depois de finalizar, as respostas não poderão ser alteradas.</p>
            <div class="practice-actions">
              <button class="outline" (click)="finishDialog.close()" [disabled]="saving()" autofocus>Continuar respondendo</button>
              <button (click)="finish()" [disabled]="protectedState()">{{ saving() ? 'Finalizando…' : 'Finalizar treino' }}</button>
            </div>
          </dialog>
        }
      }
    } @else {
      <section class="page-intro">
        <h1 id="practice-setup-title" tabindex="-1">Treino parcial</h1>
        <p>Resolva 10, 20 ou 30 questões e confira o resultado ao finalizar. Você pode sair e retomar o treino salvo.</p>
        <p class="metadata">Sem cronômetro. As questões mantêm sua origem e versão. Este treino não reproduz uma prova oficial.</p>
      </section>
      @if (availability(); as data) {
        @if (data.active; as active) {
          <section class="practice-active" aria-label="Treino em andamento">
            <h2>Continue seu treino</h2>
            <p>{{ active.answered }} de {{ active.size }} respondidas · {{ active.area || 'Assuntos mistos' }}</p>
            <button (click)="openAttempt(active.id)" [disabled]="saving()">Retomar treino</button>
          </section>
        } @else {
          <form class="practice-setup" (ngSubmit)="start()">
            <div><label for="practice-area">Área do treino</label><select id="practice-area" name="area" [(ngModel)]="area" [disabled]="saving()"><option value="">Assuntos mistos</option>@for (row of data.areas; track row.name) { <option [value]="row.name">{{ row.name }} ({{ row.count }})</option> }</select></div>
            <fieldset [disabled]="saving()" aria-describedby="practice-availability"><legend>Quantidade de questões</legend><div class="practice-sizes">@for (value of data.sizes; track value) { <label><input type="radio" name="size" [value]="value" [(ngModel)]="size" [disabled]="eligibleCount() < value" /> {{ value }} questões</label> }</div></fieldset>
            <p class="muted" id="practice-availability">{{ eligibleCount() }} questões publicadas disponíveis nesta seleção.</p>
            @if (eligibleCount() < size) { <p>Para {{ size }} questões, faltam {{ size - eligibleCount() }}. Escolha um tamanho disponível ou volte ao banco enquanto o acervo é ampliado.</p> }
            <button type="submit" [disabled]="saving() || eligibleCount() < size">{{ saving() ? 'Preparando treino…' : 'Começar treino' }}</button>
          </form>
        }
        <div class="practice-actions"><button class="text-button" (click)="browse.emit()" [disabled]="saving()">Abrir banco de questões</button><button class="text-button" (click)="loadAvailability()" [disabled]="saving()">Atualizar disponibilidade</button></div>
        @if (data.recent.length) {
          <section class="practice-history" aria-labelledby="practice-recent-title"><h2 id="practice-recent-title">Treinos concluídos recentes</h2><ol>@for (row of data.recent; track row.id) { <li><div><strong>{{ row.size }} questões · {{ row.area || 'Assuntos mistos' }}</strong><p><time [attr.datetime]="row.finishedAt">{{ dateLabel(row.finishedAt) }}</time></p></div><button class="outline" (click)="openAttempt(row.id)" [disabled]="saving()">Ver resultado</button></li> }</ol></section>
        }
      }
    }
    @if (error()) {
      <section class="notice practice-error" role="alert">
        <h2>{{ dirty() ? 'Não foi possível salvar' : 'Não foi possível concluir a operação' }}</h2><p>{{ error() }}</p>
        @if (dirty()) {
          <p>Sua seleção continua nesta tela. Salve ou descarte antes de sair.</p>
          @if (!conflict()) { <button (click)="save()" [disabled]="saving()">Tentar salvar novamente</button> }
          <button class="outline" (click)="openDiscard()" [disabled]="saving()">{{ conflict() ? 'Reabrir treino' : 'Descartar seleção local' }}</button>
        } @else { <button (click)="retry()" [disabled]="saving()">Tentar novamente</button> }
      </section>
    }
    @if (discardOpen()) {
      <section class="notice" role="alert" id="practice-discard" tabindex="-1"><h2>Descartar a seleção não salva?</h2><p>O treino será recarregado com as respostas confirmadas no servidor.</p><div class="practice-actions"><button class="outline" (click)="cancelDiscard()">Continuar editando</button><button (click)="discardAndReload()">Descartar e reabrir</button></div></section>
    }
  `,
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
