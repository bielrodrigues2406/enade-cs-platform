import { Component, EventEmitter, HostListener, Output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { OfficialSource } from "./sources.component";

type State = "PENDING" | "HOLD" | "DRAFTED";
type Content = {
  title: string;
  topic: string;
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  explanationCredit: string;
  keyPage: number | null;
};
type Row = {
  id: string;
  sourceKey: string;
  number: number;
  kind: string;
  state: State;
  revision: number;
  title: string;
  year: number;
  modality: string;
  flags: string[];
  unresolvedCount?: number;
  assistedReviewStatus: string;
  draftedVersionId: string | null;
};
type Source = {
  id: string;
  title: string;
  status: string;
  pageCount: number;
  sha256: string;
  area?: string;
  isFinal?: boolean;
};
type Detail = Row & {
  content: Content;
  pages: number[];
  raw: { prompt?: string; answer?: string; status?: string; courseScope?: string[] };
  resolvedFlags: string[];
  source: Source;
  answerKey: Source | null;
  assistedReview: {
    status: string;
    author?: string;
    notes?: string[];
    issues?: { code: string; note: string }[];
    duplicateOf?: unknown;
  };
  events: { type: string; note: string | null; createdAt: string; revision: number; byCurator: boolean }[];
};
type Queue = {
  items: Row[];
  total: number;
  offset: number;
  limit: number;
  counts: Record<State, number>;
};

@Component({
  selector: "app-question-imports",
  imports: [FormsModule],
  template: `
    @if (!selected()) {
      <section class="page-intro">
        <h1 id="imports-heading" tabindex="-1">Questões importadas</h1>
        <p>Confira a extração e a análise assistida antes de criar um rascunho editorial.</p>
      </section>
      @if (queue(); as data) {
        <dl class="intake-counts" aria-label="Situação da importação">
          <div><dt>Para conferir</dt><dd>{{ data.counts.PENDING }}</dd></div>
          <div><dt>Com pendências</dt><dd>{{ data.counts.HOLD }}</dd></div>
          <div><dt>Rascunhos criados</dt><dd>{{ data.counts.DRAFTED }}</dd></div>
        </dl>
      }
      <div class="intake-toolbar">
        <label for="intake-state">Situação
          <select id="intake-state" [(ngModel)]="filter" (ngModelChange)="load(0)" [disabled]="loading()">
            <option value="">Todas</option><option value="PENDING">Para conferir</option>
            <option value="HOLD">Com pendências</option><option value="DRAFTED">Rascunhos criados</option>
          </select>
        </label>
        <button class="text-button" (click)="load(offset)" [disabled]="loading()">Atualizar importação</button>
      </div>
      @if (loading()) { <p role="status">Carregando questões importadas…</p> }
      @if (error()) {
        <div class="notice" role="alert"><p>{{ error() }}</p><button (click)="load(offset)">Tentar novamente</button></div>
      } @else if (!loading() && queue(); as data) {
        @if (!data.total) {
          <div class="empty"><h2>Nenhuma questão nesta seleção</h2>
            <p>A administração importa os relatórios de extração. Depois, cada item fica disponível para conferência aqui.</p>
            @if (filter) { <button class="outline" (click)="filter = ''; load(0)">Ver todas as situações</button> }
          </div>
        } @else {
          <table class="editorial-table intake-table">
            <caption class="visually-hidden">Questões importadas para conferência</caption>
            <thead><tr><th scope="col">Questão e caderno</th><th scope="col">Situação</th><th scope="col">Pendências</th><th scope="col"><span class="visually-hidden">Ação</span></th></tr></thead>
            <tbody>
              @for (row of data.items; track row.id) {
                <tr><td><strong>{{ row.title }}</strong><span class="editorial-row-meta">{{ row.year }} · {{ modality(row.modality) }} · {{ row.sourceKey }}</span></td>
                  <td><span class="editorial-status">{{ stateLabel(row.state) }}</span></td>
                  <td><span class="mobile-label">Pendências: </span>{{ row.unresolvedCount ?? row.flags.length }}</td>
                  <td><button class="outline" (click)="open(row.id)" [disabled]="loading()" [attr.aria-label]="'Conferir: ' + row.title">Conferir →</button></td>
                </tr>
              }
            </tbody>
          </table>
          <nav class="intake-pagination" aria-label="Páginas da importação">
            <button class="outline" (click)="load(offset - data.limit)" [disabled]="loading() || offset === 0">Anterior</button>
            <span>{{ offset + 1 }}–{{ offset + data.items.length }} de {{ data.total }}</span>
            <button class="outline" (click)="load(offset + data.limit)" [disabled]="loading() || offset + data.limit >= data.total">Próxima</button>
          </nav>
        }
      }
    } @else if (selected(); as item) {
      <button class="back text-button" (click)="back()" [disabled]="busy()">← Voltar à importação</button>
      @if (discard()) {
        <section class="notice" aria-label="Alterações locais">
          <p>Há alterações que ainda não foram salvas.</p>
          <button class="outline" (click)="discard.set(false)">Continuar editando</button>
          <button (click)="discardAndContinue()">Descartar alterações</button>
        </section>
      }
      <article class="editorial-document intake-document">
        <h1 id="intake-detail-heading" tabindex="-1">{{ item.title }}</h1>
        <p>{{ item.year }} · {{ modality(item.modality) }} · {{ item.sourceKey }} · {{ stateLabel(item.state) }}</p>
        @if (loading()) { <p role="status">Recarregando a conferência…</p> }
        @if (notice()) { <p class="account-success" role="status">{{ notice() }}</p> }
        @if (error()) {
          <div class="notice" role="alert"><p>{{ error() }}</p>
            <p>Seu texto local foi preservado. Recarregue para conferir o que ficou salvo.</p>
            <button class="outline" (click)="reload()" [disabled]="busy()">Recarregar versão salva</button>
          </div>
        }
        <section class="intake-evidence" aria-labelledby="intake-evidence-heading">
          <h2 id="intake-evidence-heading">Conferência com os documentos</h2>
          <p><a [href]="file(item.source.id, item.pages[0])">Baixar prova arquivada</a>
            · {{ item.source.title }} · páginas {{ item.pages.join(', ') || 'não identificadas' }}
            · {{ item.source.status === 'VERIFIED' ? 'fonte conferida' : 'fonte pendente de conferência' }}</p>
          @if (item.answerKey; as key) {
            <p><a [href]="file(key.id, draft.keyPage || undefined)">Baixar gabarito arquivado</a>
              · {{ key.status === 'VERIFIED' && key.isFinal ? 'definitivo conferido' : 'conferência do gabarito definitivo pendente' }}</p>
          } @else { <p>Gabarito ainda não associado a este item.</p> }
          @if (item.raw.courseScope?.length) { <p>Bloco do caderno: {{ item.raw.courseScope.join(', ') }}</p> }
          <details><summary>Identidade dos arquivos</summary><p class="source-hash">Prova: {{ item.source.sha256 }}</p>
            @if (item.answerKey; as key) { <p class="source-hash">Gabarito: {{ key.sha256 }}</p> }
          </details>
          <p class="muted">Confira as fontes na seção Fontes da curadoria. A importação e a análise assistida não aprovam o conteúdo.</p>
        </section>
        <section class="intake-analysis" aria-labelledby="intake-analysis-heading">
          <h2 id="intake-analysis-heading">Análise assistida</h2>
          <p>{{ item.assistedReview.author || 'Análise automática da extração' }} · revisão humana pendente</p>
          @if (item.assistedReview.notes?.length) {
            <ul>@for (note of item.assistedReview.notes; track $index) { <li>{{ note }}</li> }</ul>
          }
          @if (item.assistedReview.issues?.length) {
            <ul>@for (issue of item.assistedReview.issues; track $index) { <li><strong>{{ flagLabel(issue.code) }}:</strong> {{ issue.note }}</li> }</ul>
          }
          @if (item.assistedReview.status === 'NOT_REVIEWED') { <p>O conteúdo ainda precisa de análise. Confira enunciado, alternativas e resposta com os documentos.</p> }
          @if (item.assistedReview.duplicateOf) { <p>Há conteúdo compartilhado com outro caderno. A numeração e a procedência de cada ocorrência foram preservadas.</p> }
        </section>
        <form (ngSubmit)="save()" class="intake-form" (input)="changed()" (change)="changed()">
          <fieldset [disabled]="busy() || loading() || item.state === 'DRAFTED'">
            <legend>Texto para conferência</legend>
            <label for="intake-pages">Páginas da questão na prova<input id="intake-pages" name="pages" [(ngModel)]="pagesText" aria-describedby="intake-pages-hint" /></label>
            <p id="intake-pages-hint" class="muted">Use os números das páginas do arquivo, separados por vírgula. Exemplo: 18, 19.</p>
            <label for="intake-key">Documento do gabarito<select id="intake-key" name="keySource" [(ngModel)]="keySourceId" (ngModelChange)="draft.keyPage = null; changed()">
              <option value="">Sem documento associado</option>
              @for (key of compatibleKeys(); track key.id) { <option [value]="key.id">{{ key.title }}</option> }
            </select></label>
            @if (keySourceError()) { <p class="notice" role="alert">{{ keySourceError() }} <button type="button" class="text-button" (click)="loadKeySources()">Tentar carregar gabaritos</button></p> }
            <label for="intake-title">Título<input id="intake-title" name="title" maxlength="160" [(ngModel)]="draft.title" /></label>
            <label for="intake-topic">Assunto<input id="intake-topic" name="topic" maxlength="80" [(ngModel)]="draft.topic" /></label>
            <label for="intake-prompt">Enunciado<textarea id="intake-prompt" name="prompt" rows="12" maxlength="24000" [(ngModel)]="draft.prompt"></textarea></label>
            @for (option of draft.options; track $index) {
              <label [for]="'intake-option-' + $index">Alternativa {{ option.id }}<textarea [id]="'intake-option-' + $index" [name]="'option-' + $index" rows="3" maxlength="4000" [(ngModel)]="option.text"></textarea></label>
            }
            <div class="intake-option-actions">
              <button type="button" class="text-button" (click)="addOption()" [disabled]="draft.options.length >= 5">Adicionar alternativa</button>
              <button type="button" class="text-button" (click)="removeOption()" [disabled]="!draft.options.length">Remover última alternativa</button>
            </div>
            <label for="intake-answer">Resposta do gabarito
              <select id="intake-answer" name="answer" [(ngModel)]="draft.correctOptionId"><option value="">Sem resposta identificada</option>
                @for (option of draft.options; track $index) { <option [value]="option.id">{{ option.id }}</option> }
              </select>
            </label>
            <label for="intake-key-page">Página do gabarito<input id="intake-key-page" name="keyPage" type="number" min="1" [max]="keySources().find(keyById)?.pageCount || 1000" [(ngModel)]="draft.keyPage" /></label>
            <label for="intake-explanation">Comentário de resolução<textarea id="intake-explanation" name="explanation" rows="6" maxlength="4000" [(ngModel)]="draft.explanation"></textarea></label>
            <label for="intake-credit">Crédito do comentário<input id="intake-credit" name="explanationCredit" maxlength="160" [(ngModel)]="draft.explanationCredit" /></label>
            <fieldset class="intake-flags"><legend>Pendências identificadas na importação</legend>
              @if (!item.flags.length) { <p>Nenhuma pendência automática. A conferência com o PDF continua necessária.</p> }
              @for (flag of item.flags; track flag) {
                <label class="check"><input type="checkbox" [name]="'flag-' + $index" [checked]="resolvedFlags.includes(flag)" (change)="resolveFlag(flag, $event)" />Conferi e resolvi: {{ flagLabel(flag) }}</label>
              }
              <p class="muted">O registro original das pendências permanece no histórico. Explique as correções na nota abaixo.</p>
            </fieldset>
            <label for="intake-note">Nota da conferência <span class="muted">(obrigatória ao salvar)</span><textarea id="intake-note" name="note" rows="3" maxlength="2000" [(ngModel)]="note"></textarea></label>
            <button type="submit" [disabled]="!dirty() || note.trim().length < 10">{{ busy() ? 'Salvando…' : 'Salvar conferência' }}</button>
          </fieldset>
        </form>
        <section class="intake-promote" aria-labelledby="intake-promote-heading">
          <h2 id="intake-promote-heading">Preparar revisão editorial</h2>
          @if (item.state === 'DRAFTED') {
            <p>O rascunho já foi criado. Abra a seção Questões para continuar a revisão editorial.</p>
          } @else {
            <p>{{ promotionReason() }}</p>
            <label class="check"><input type="checkbox" [(ngModel)]="fidelityConfirmed" [disabled]="busy() || loading() || !!promotionBlock()" />Conferi o texto, as alternativas e a resposta com os PDFs arquivados.</label>
            <button (click)="promote()" [disabled]="busy() || loading() || !fidelityConfirmed || !!promotionBlock()">{{ busy() ? 'Preparando…' : 'Criar rascunho editorial' }}</button>
          }
        </section>
        <details class="intake-original"><summary>Texto original da extração</summary><p class="intake-raw">{{ item.raw.prompt }}</p><p>Resposta extraída: {{ item.raw.answer || 'não identificada' }}</p></details>
        <details class="intake-original"><summary>Histórico da conferência</summary>
          <ol>@for (event of item.events; track $index) { <li>Revisão {{ event.revision }} · {{ event.byCurator ? 'Curadoria' : 'Importação administrativa' }} · {{ event.note || eventLabel(event.type) }}</li> }</ol>
        </details>
      </article>
    }
  `,
})
export class QuestionImportsComponent {
  @Output() busyChange = new EventEmitter<boolean>();
  queue = signal<Queue | null>(null);
  selected = signal<Detail | null>(null);
  loading = signal(false);
  busy = signal(false);
  dirty = signal(false);
  error = signal("");
  notice = signal("");
  discard = signal(false);
  keySources = signal<OfficialSource[]>([]);
  keySourceError = signal("");
  pagesText = "";
  keySourceId = "";
  filter = "";
  offset = 0;
  note = "";
  draft!: Content;
  resolvedFlags: string[] = [];
  fidelityConfirmed = false;
  private active = true;
  private sequence = 0;
  private saved = "";
  private discardAction: "back" | "reload" = "back";
  private abort = new AbortController();
  constructor() { void this.load(0); void this.loadKeySources(); }
  ngOnDestroy() { this.active = false; this.sequence++; this.abort.abort(); this.busyChange.emit(false); }
  @HostListener("window:beforeunload", ["$event"])
  beforeUnload(event: BeforeUnloadEvent) { if (this.dirty() || this.busy()) event.preventDefault(); }
  private async api<T>(path = "", init?: RequestInit): Promise<T> {
    const response = await fetch("/api/curation/imports" + path, { ...init, headers: { "Content-Type": "application/json" }, signal: this.abort.signal });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message || "Não foi possível confirmar a operação. Tente novamente.");
    }
    return response.json();
  }
  async load(offset: number) {
    const seq = ++this.sequence;
    this.offset = Math.max(0, offset);
    this.loading.set(true); this.error.set("");
    try {
      const data = await this.api<Queue>(`?offset=${this.offset}&limit=25${this.filter ? '&state=' + this.filter : ''}`);
      if (this.active && seq === this.sequence) this.queue.set(data);
    } catch (err) { if (this.active && seq === this.sequence) this.error.set(this.message(err)); }
    finally { if (this.active && seq === this.sequence) this.loading.set(false); }
  }
  async open(id: string) {
    const seq = ++this.sequence;
    this.loading.set(true); this.error.set("");
    try {
      const data = await this.api<Detail>("/" + encodeURIComponent(id));
      if (this.active && seq === this.sequence) { this.apply(data); this.focus("intake-detail-heading"); }
    } catch (err) { if (this.active && seq === this.sequence) this.error.set(this.message(err)); }
    finally { if (this.active && seq === this.sequence) this.loading.set(false); }
  }
  private apply(item: Detail) {
    this.selected.set(item); this.draft = structuredClone(item.content);
    this.resolvedFlags = [...item.resolvedFlags]; this.pagesText = item.pages.join(', '); this.keySourceId = item.answerKey?.id || ""; this.note = ""; this.fidelityConfirmed = false;
    this.saved = this.snapshot(); this.discard.set(false); this.dirty.set(false); this.notice.set(""); this.emitBusy();
  }
  private snapshot() { return JSON.stringify([this.draft, this.resolvedFlags, this.note, this.pagesText, this.keySourceId]); }
  changed() { this.dirty.set(this.snapshot() !== this.saved); this.fidelityConfirmed = false; this.emitBusy(); }
  private emitBusy() { this.busyChange.emit(this.busy() || this.dirty()); }
  addOption() {
    const id = [..."ABCDE"].find(letter => !this.draft.options.some(option => option.id === letter));
    if (id) { this.draft.options.push({id, text: ""}); this.draft.options.sort((a, b) => a.id.localeCompare(b.id)); this.changed(); }
  }
  removeOption() { const removed = this.draft.options.pop(); if (removed?.id === this.draft.correctOptionId) this.draft.correctOptionId = ""; this.changed(); }
  resolveFlag(flag: string, event: Event) {
    this.resolvedFlags = (event.target as HTMLInputElement).checked ? [...this.resolvedFlags, flag] : this.resolvedFlags.filter(x => x !== flag);
    this.changed();
  }
  back() { this.discardAction = "back"; if (this.dirty()) this.discard.set(true); else this.exit(); }
  reload() { this.discardAction = "reload"; if (this.dirty()) this.discard.set(true); else void this.open(this.selected()!.id); }
  discardAndContinue() { this.dirty.set(false); this.emitBusy(); this.discard.set(false); if (this.discardAction === "reload") void this.open(this.selected()!.id); else this.exit(); }
  private exit() { this.selected.set(null); this.dirty.set(false); this.notice.set(""); this.emitBusy(); void this.load(this.offset); this.focus("imports-heading"); }
  async save() {
    const item = this.selected();
    if (!item || this.busy() || this.loading() || !this.dirty() || this.note.trim().length < 10) return;
    const pages = this.pagesText.trim() ? this.pagesText.split(',').map(value => /^\s*[1-9][0-9]{0,3}\s*$/.test(value) ? Number(value.trim()) : NaN) : [];
    if (pages.some(page => !Number.isInteger(page) || page > item.source.pageCount)) { this.error.set("Páginas inválidas. Use números do arquivo separados por vírgula."); return; }
    this.busy.set(true); this.emitBusy(); this.error.set(""); this.notice.set("");
    try {
      const data = await this.api<Detail>("/" + item.id, { method: "PUT", body: JSON.stringify({baseRevision: item.revision, content: this.draft, pages, keySourceId: this.keySourceId || null, resolvedFlags: this.resolvedFlags, note: this.note}) });
      if (this.active) { this.apply(data); this.notice.set("Conferência salva. A questão continua privada."); }
    } catch (err) { if (this.active) this.error.set(this.message(err)); }
    finally { if (this.active) { this.busy.set(false); this.emitBusy(); } }
  }
  promotionBlock() {
    const item = this.selected();
    if (!item || item.state === 'DRAFTED') return "Rascunho já criado.";
    if (item.flags.includes('FONTE_AUXILIAR_DERIVADA')) return "Este item usa um trecho derivado de compilação. A procedência precisa ser reconciliada com o caderno original antes de criar um rascunho.";
    if (item.flags.includes('ANULADA') || item.raw.status === 'anulada') return "Questões anuladas permanecem arquivadas para conferência e não são encaminhadas como itens pontuáveis.";
    if (item.flags.includes('fora-escopo-ciencia-computacao')) return "Este bloco pertence a outro curso. A ocorrência fica arquivada com seu escopo original.";
    if (this.dirty()) return "Salve a conferência antes de criar o rascunho.";
    if (item.kind !== 'OBJECTIVE') return "Este tipo de questão ainda requer preparação editorial específica.";
    if (item.flags.some(f => !item.resolvedFlags.includes(f))) return "Resolva as pendências e registre a conferência antes de continuar.";
    if (item.source.status !== 'VERIFIED' || item.answerKey?.status !== 'VERIFIED' || !item.answerKey?.isFinal) return "Confira a prova e o gabarito definitivo na seção Fontes antes de criar o rascunho.";
    return "";
  }
  promotionReason() { return this.promotionBlock() || "O rascunho seguirá para revisão por outra conta antes da publicação."; }
  async promote() {
    const item = this.selected();
    if (!item || this.busy() || this.loading() || this.promotionBlock() || !this.fidelityConfirmed) return;
    this.busy.set(true); this.emitBusy(); this.error.set(""); this.notice.set("");
    try {
      await this.api("/" + item.id + "/draft", {method: "POST", body: JSON.stringify({baseRevision:item.revision, fidelityConfirmed:true})});
      if (this.active) { await this.open(item.id); this.notice.set("Rascunho editorial criado. Continue a revisão na seção Questões."); }
    } catch (err) { if (this.active) this.error.set(this.message(err)); }
    finally { if (this.active) { this.busy.set(false); this.emitBusy(); } }
  }
  file(id: string, page?: number) { return "/api/curation/sources/" + encodeURIComponent(id) + "/file" + (page ? "#page=" + page : ""); }
  keyById = (key: OfficialSource) => key.id === this.keySourceId;
  compatibleKeys() { const item = this.selected(); return this.keySources().filter(key => key.kind === 'ANSWER_KEY' && (key.status !== 'REJECTED' || key.id === this.keySourceId) && key.year === item?.year && key.modality === item?.modality && (!item.source.area || key.area === item.source.area)); }
  async loadKeySources() {
    this.keySourceError.set("");
    try {
      const response = await fetch('/api/curation/sources', {signal:this.abort.signal});
      if (!response.ok) throw new Error('Não foi possível carregar a lista de gabaritos. Tente novamente.');
      const sources: OfficialSource[] = await response.json();
      if (this.active) this.keySources.set(sources);
    } catch (err) { if (this.active) this.keySourceError.set(this.message(err)); }
  }
  stateLabel(state: State) { return {PENDING:"Para conferir", HOLD:"Com pendências", DRAFTED:"Rascunho criado"}[state]; }
  modality(value: string) { return ({BACHARELADO:"Bacharelado", LICENCIATURA:"Licenciatura", COMUM:"Caderno compartilhado", CST:"Tecnólogo"} as Record<string,string>)[value] || value; }
  flagLabel(flag: string) { return ({figura:"Figura ou diagrama precisa de conferência", ocr:"Texto obtido por reconhecimento de imagem", anulada:"Questão anulada", discursiva:"Questão discursiva", "revisao-assistida-pendente":"Análise do conteúdo pendente"} as Record<string,string>)[flag] || flag.replaceAll("_", " ").replaceAll("-", " "); }
  eventLabel(type: string) { return ({IMPORTED:"Questão importada para conferência", REEXTRACTED:"Extração atualizada", EDITED:"Conferência salva", DRAFTED:"Rascunho editorial criado"} as Record<string,string>)[type] || type; }
  private message(err: unknown) { return err instanceof Error ? err.message : "Não foi possível confirmar a operação. Tente novamente."; }
  private focus(id: string) { setTimeout(() => { if (this.active) document.getElementById(id)?.focus(); }); }
}
