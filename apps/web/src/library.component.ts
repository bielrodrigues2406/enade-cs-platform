import { MascotComponent } from "./mascot.component";
import { requestJson } from "./api-request";
import { Component, ElementRef, EventEmitter, Output, afterNextRender, inject, Injector, signal } from "@angular/core";

// Biblioteca (LIB-1): fichas de uma página por assunto, lidas do repositório.
// Materiais enviados por professores e o plano até a prova ficam anunciados
// como "em breve"; a base (área, assunto, fonte) já é a mesma das fichas.

type SheetSummary = { slug: string; area: string; title: string; summary: string };
type Sheet = SheetSummary & { sections: { title: string; points: string[] }[]; pitfalls: string[]; references: string[] };

@Component({
  imports: [MascotComponent],
  selector: "app-library",
  templateUrl: "./library.component.html",
  styleUrl: "./library.component.css",
})
export class LibraryComponent {
  @Output() practiceArea = new EventEmitter<string>();
  @Output() flashcards = new EventEmitter<void>();
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private injector = inject(Injector);
  sheets = signal<SheetSummary[] | null>(null);
  open = signal<Sheet | null>(null);
  error = signal("");
  busy = signal(false);
  private retrySlug: string | null = null;
  retry() { return this.retrySlug ? this.read(this.retrySlug) : this.load(); }
  ngOnInit() { void this.load(); }
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
    this.focus("#library-title");
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
