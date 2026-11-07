import { MascotComponent } from "./mascot.component";
import { CoreMapComponent } from "./core-map.component";
import { CoreAreaComponent } from "./core-area.component";
import { availableInArea, chooseAreaSimulation, type PracticeRequest } from "./practice-request";
import { ChoiceService } from "./choice-dialog";
import { requestJson } from "./api-request";
import { libraryPath, parseLibraryPath, type LibraryAddress } from "./study-navigation";
import { Component, ElementRef, EventEmitter, Output, afterNextRender, computed, effect, inject, Injector, input, signal, untracked } from "@angular/core";

// Biblioteca (LIB-1): o núcleo por área (NUC-1) no topo e as fichas de uma
// página por assunto, lidas do repositório.
// Materiais enviados por professores e o plano até a prova ficam anunciados
// como "em breve"; a base (área, assunto, fonte) já é a mesma das fichas.

type SheetSummary = { slug: string; area: string; title: string; summary: string };
type Sheet = SheetSummary & { sections: { title: string; points: string[] }[]; pitfalls: string[]; references: string[] };

@Component({
  imports: [MascotComponent, CoreMapComponent, CoreAreaComponent],
  selector: "app-library",
  templateUrl: "./library.component.html",
  styleUrl: "./library.component.css",
})
export class LibraryComponent {
  /** Caminho atual (/biblioteca, /biblioteca/<área>[/<lição>], /biblioteca/fichas/<ficha>); vem do shell. */
  address = input("/biblioteca");
  /** Pede outro ponto da Biblioteca; o shell grava no histórico e devolve em `address`. */
  @Output() navigate = new EventEmitter<{ path: string; replace?: boolean }>();
  /** Flashcards abertos no baralho da área (ou todos, com null). */
  @Output() flashcards = new EventEmitter<string | null>();
  @Output() question = new EventEmitter<string>();
  @Output() practice = new EventEmitter<PracticeRequest>();
  @Output() generated = new EventEmitter<string>();
  private place = computed<LibraryAddress>(() => parseLibraryPath(this.address()) ?? { area: null, lesson: null, sheet: null });
  /** Área do núcleo aberta e lição lida nela; a ficha aberta a partir da área volta para ela. */
  coreSlug = computed(() => this.place().area);
  lessonId = computed(() => this.place().lesson);
  private sheetReturn: string | null = null;
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private injector = inject(Injector);
  sheets = signal<SheetSummary[] | null>(null);
  open = signal<Sheet | null>(null);
  error = signal("");
  busy = signal(false);
  sheetBusy = signal(false);
  private retrySlug: string | null = null;
  retry() { return this.retrySlug ? this.read(this.retrySlug) : this.load(); }
  constructor() {
    // A ficha do endereço abre (ou fecha) quando o caminho muda, inclusive por Voltar/Avançar.
    effect(() => {
      const slug = this.place().sheet;
      untracked(() => {
        if (!slug) { this.open.set(null); return; }
        if (this.open()?.slug !== slug) void this.read(slug);
      });
    });
  }
  ngOnInit() { void this.load(); }
  private go(address: LibraryAddress, replace = false) {
    this.navigate.emit({ path: libraryPath(address), replace });
  }
  async load() {
    if (this.busy()) return;
    this.busy.set(true);
    this.retrySlug = null;
    this.error.set("");
    try {
      this.sheets.set(await requestJson<SheetSummary[]>("/api/sheets"));
    } catch (error) { this.error.set(error instanceof Error ? error.message : "Não foi possível carregar as fichas. Tente novamente."); }
    finally { this.busy.set(false); }
  }

  /** Abre uma ficha pelo endereço; o efeito do construtor carrega o conteúdo. */
  openSheet(slug: string) { this.go({ area: null, lesson: null, sheet: slug }); }

  async read(slug: string) {
    this.sheetBusy.set(true);
    this.retrySlug = slug;
    this.error.set("");
    try {
      const sheet = await requestJson<Sheet>(`/api/sheets/${encodeURIComponent(slug)}`);
      // O endereço pode ter mudado enquanto a ficha carregava.
      if (this.place().sheet !== slug) return;
      this.open.set(sheet);
      this.focus("#sheet-title");
    } catch (error) { this.error.set(error instanceof Error ? error.message : "Não foi possível abrir a ficha. Tente novamente."); }
    finally { this.sheetBusy.set(false); }
  }

  close() {
    this.retrySlug = null;
    this.error.set("");
    const area = this.sheetReturn;
    this.sheetReturn = null;
    this.go({ area, lesson: null, sheet: null });
    if (!area) this.focus("#library-title");
  }

  openCore(slug: string) {
    this.go({ area: slug, lesson: null, sheet: null });
  }
  closeCore() {
    this.go({ area: null, lesson: null, sheet: null });
    this.focus("#library-title");
  }
  /** A área abre ou fecha uma lição; `replace` corrige um endereço com lição que não existe. */
  lessonChange(change: { concept: string | null; replace?: boolean }) {
    this.go({ area: this.coreSlug(), lesson: change.concept, sheet: null }, change.replace);
  }
  sheetFromCore(slug: string) {
    this.sheetReturn = this.coreSlug();
    this.openSheet(slug);
  }

  private choice = inject(ChoiceService);
  /**
   * "Treinar <área>" da ficha: simulado só daquela área, como na página do núcleo
   * (antes o treino abria sem a área; revisão EST-EXP1 do Codex).
   */
  async trainArea(area: string) {
    this.error.set("");
    let count: number;
    try { count = await availableInArea(area); } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Não foi possível preparar o treino. Tente novamente.");
      return;
    }
    if (!count) { this.error.set("Ainda não há questões publicadas desta área para treinar."); return; }
    const request = await chooseAreaSimulation(this.choice, area, count);
    if (request) this.practice.emit(request);
  }

  print() {
    window.print();
  }

  private focus(selector: string) {
    afterNextRender(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    }, { injector: this.injector });
  }
}
