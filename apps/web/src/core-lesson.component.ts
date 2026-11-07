import { Component, ElementRef, EventEmitter, Injector, Input, Output, afterNextRender, inject, signal } from "@angular/core";
import { requestJson } from "./api-request";
import type { CoreConcept, Lesson } from "./core.types";

// Lição de um conceito do núcleo (LIB-2): explicação, exemplo resolvido e
// conferido, erro comum, como o conceito caiu na prova e perguntas para
// fixar. A página da área abre a lição e oferece a anterior e a próxima.

@Component({
  selector: "app-core-lesson",
  templateUrl: "./core-lesson.component.html",
  styleUrl: "./core-lesson.component.css",
})
export class CoreLessonComponent {
  @Input({ required: true }) slug!: string;
  @Input({ required: true }) area!: string;
  @Input({ required: true }) concept!: CoreConcept;
  @Input({ required: true }) position!: { index: number; total: number };
  @Input() previous: CoreConcept | null = null;
  @Input() next: CoreConcept | null = null;
  @Input() references: string[] = [];
  @Output() back = new EventEmitter<void>();
  @Output() go = new EventEmitter<CoreConcept>();
  @Output() question = new EventEmitter<string>();

  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private injector = inject(Injector);
  lesson = signal<Lesson | null>(null);
  error = signal("");

  /** A mesma instância serve à anterior e à próxima: recarrega quando o conceito muda. */
  ngOnChanges() { void this.load(); }

  async load() {
    this.lesson.set(null);
    this.error.set("");
    try {
      const url = `/api/core/${encodeURIComponent(this.slug)}/lessons/${encodeURIComponent(this.concept.id)}`;
      this.lesson.set(await requestJson<Lesson>(url));
      afterNextRender(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        this.host.nativeElement.querySelector<HTMLElement>("#lesson-title")?.focus({ preventScroll: true });
      }, { injector: this.injector });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Não foi possível abrir a lição. Tente novamente.");
    }
  }

  isIllustration(src: string) { return src.startsWith("/illustrations/"); }
}
