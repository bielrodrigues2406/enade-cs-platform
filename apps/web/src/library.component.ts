import { MascotComponent } from "./mascot.component";
import { CoreMapComponent } from "./core-map.component";
import { CoreAreaComponent } from "./core-area.component";
import type { PracticeRequest } from "./practice-request";
import { requestJson } from "./api-request";
import { ResumeService } from "./resume.service";
import { Component, ElementRef, EventEmitter, Output, afterNextRender, inject, Injector, signal } from "@angular/core";

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
  @Output() practiceArea = new EventEmitter<string>();
  @Output() flashcards = new EventEmitter<void>();
  @Output() question = new EventEmitter<string>();
  @Output() practice = new EventEmitter<PracticeRequest>();
  @Output() generated = new EventEmitter<string>();
  /** Área do núcleo aberta; a ficha aberta a partir dela volta para ela. */
  coreSlug = signal<string | null>(null);
  private sheetReturn: string | null = null;
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private injector = inject(Injector);
  sheets = signal<SheetSummary[] | null>(null);
  open = signal<Sheet | null>(null);
  error = signal("");
  busy = signal(false);
  private retrySlug: string | null = null;
  retry() { return this.retrySlug ? this.read(this.retrySlug) : this.load(); }
  private resume = inject(ResumeService);
  ngOnInit() {
    void this.load();
    // "Continuar de onde parou" pede uma lição: a área abre e mostra a lição.
    const pending = this.resume.pendingLesson();
    if (pending) this.coreSlug.set(pending.slug);
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

  async read(slug: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.retrySlug = slug;
    this.error.set("");
    try {
      this.open.set(await requestJson<Sheet>(`/api/sheets/${encodeURIComponent(slug)}`));
      this.focus("#sheet-title");
    } catch (error) { this.error.set(error instanceof Error ? error.message : "Não foi possível abrir a ficha. Tente novamente."); }
    finally { this.busy.set(false); }
  }

  close() {
    this.retrySlug = null;
    this.error.set("");
    this.open.set(null);
    if (this.sheetReturn) {
      this.coreSlug.set(this.sheetReturn);
      this.sheetReturn = null;
      return;
    }
    this.focus("#library-title");
  }

  openCore(slug: string) {
    this.coreSlug.set(slug);
  }
  closeCore() {
    this.coreSlug.set(null);
    this.focus("#library-title");
  }
  sheetFromCore(slug: string) {
    this.sheetReturn = this.coreSlug();
    this.coreSlug.set(null);
    void this.read(slug);
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
