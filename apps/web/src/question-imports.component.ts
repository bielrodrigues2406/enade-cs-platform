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
  templateUrl: "./question-imports.component.html",
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
