import { MascotComponent } from "./mascot.component";
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
  async ngOnInit() {
    try {
      const response = await fetch("/api/sheets");
      if (!response.ok) throw new Error();
      this.sheets.set(await response.json());
    } catch {
      this.error.set("Não foi possível carregar as fichas. Verifique a conexão e tente de novo.");
    }
  }

  async read(slug: string) {
    const response = await fetch(`/api/sheets/${slug}`);
    if (!response.ok) { this.error.set("Ficha não encontrada."); return; }
    this.open.set(await response.json());
    this.focus("#sheet-title");
  }

  close() {
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
