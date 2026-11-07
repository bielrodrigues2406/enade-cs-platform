import { Component, ElementRef, EventEmitter, Injector, Input, Output, afterNextRender, computed, inject, signal } from "@angular/core";
import { requestJson } from "./api-request";
import { ChoiceService } from "./choice-dialog";
import { chooseAreaSimulation, type PracticeRequest } from "./practice-request";
import { CoreLessonComponent } from "./core-lesson.component";
import { LEVELS, TRAP_LABELS, type Confidence, type CoreArea, type CoreConcept, type TrapPattern } from "./core.types";

// Página de uma área do núcleo (NUC-1): conceitos com autoavaliação e as
// questões oficiais em que cada um caiu, fatos de referência, pares que
// confundem, pistas do enunciado e pegadinhas por padrão. A pessoa sai daqui
// para a questão, o treino da área, os flashcards ou a ficha.

@Component({
  imports: [CoreLessonComponent],
  selector: "app-core-area",
  templateUrl: "./core-area.component.html",
  styleUrl: "./core-area.component.css",
})
export class CoreAreaComponent {
  @Input({ required: true }) slug!: string;
  @Output() back = new EventEmitter<void>();
  @Output() question = new EventEmitter<string>();
  @Output() practice = new EventEmitter<PracticeRequest>();
  @Output() flashcards = new EventEmitter<void>();
  @Output() sheet = new EventEmitter<string>();
  @Output() generated = new EventEmitter<string>();

  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private injector = inject(Injector);
  private choice = inject(ChoiceService);
  readonly levels = LEVELS;
  readonly trapLabels = TRAP_LABELS;

  area = signal<CoreArea | null>(null);
  error = signal("");
  saving = signal<string | null>(null);
  /** Lição aberta (LIB-2); fechar volta ao cartão do conceito. */
  reading = signal<CoreConcept | null>(null);
  /** Conceitos com lição, na ordem do núcleo: a sequência de leitura. */
  lessons = computed(() => (this.area()?.concepts ?? []).filter((c) => c.lesson));
  readingAt = computed(() => this.lessons().findIndex((c) => c.id === this.reading()?.id));

  conceptName = computed(() => new Map((this.area()?.concepts ?? []).map((c) => [c.id, c.name])));
  /** Pegadinhas agrupadas por padrão, na ordem em que aparecem. */
  trapGroups = computed(() => {
    const groups = new Map<TrapPattern, string[]>();
    for (const trap of this.area()?.traps ?? []) groups.set(trap.pattern, [...(groups.get(trap.pattern) ?? []), trap.text]);
    return [...groups.entries()].map(([pattern, texts]) => ({ pattern, texts }));
  });
  /** Questões publicadas da área, sem repetir as que caem em mais de um conceito. */
  publishedCount = computed(() => new Set((this.area()?.concepts ?? []).flatMap((c) => c.questions.map((q) => q.id))).size);
  maxEdition = computed(() => Math.max(1, ...(this.area()?.history.editions ?? []).map((e) => e.count)));

  ngOnInit() { void this.load(); }

  async load() {
    this.error.set("");
    try {
      this.area.set(await requestJson<CoreArea>(`/api/core/${encodeURIComponent(this.slug)}`));
      afterNextRender(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        this.host.nativeElement.querySelector<HTMLElement>("#core-area-title")?.focus({ preventScroll: true });
      }, { injector: this.injector });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Não foi possível abrir a área. Tente novamente.");
    }
  }

  /** Marca na hora; se o servidor recusar, volta ao que era e avisa. */
  async rate(concept: CoreConcept, value: 0 | 1 | 2) {
    if (this.saving()) return;
    const level = concept.level === value ? null : value;
    const previous = concept.level;
    this.patch(concept.id, level);
    this.saving.set(concept.id);
    this.error.set("");
    try {
      const result = await requestJson<{ confidence: Confidence }>(`/api/core/concepts/${concept.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level }),
      });
      this.area.update((a) => a && { ...a, confidence: result.confidence });
    } catch (error) {
      this.patch(concept.id, previous);
      this.error.set(error instanceof Error ? error.message : "Não foi possível guardar. Tente novamente.");
    } finally {
      this.saving.set(null);
    }
  }

  async train() {
    const area = this.area();
    if (!area || !this.publishedCount()) return;
    const request = await chooseAreaSimulation(this.choice, area.area, this.publishedCount());
    if (request) this.practice.emit(request);
  }

  read(concept: CoreConcept) { this.reading.set(concept); }

  closeLesson() {
    const id = this.reading()?.id;
    this.reading.set(null);
    afterNextRender(() => {
      const button = this.host.nativeElement.querySelector<HTMLElement>(`[data-lesson="${id}"]`);
      button?.scrollIntoView({ block: "center", behavior: "instant" });
      button?.focus({ preventScroll: true });
    }, { injector: this.injector });
  }

  rated() { return (this.area()?.concepts ?? []).filter((c) => c.level !== null).length; }
  tone(value: number) { return value >= 70 ? "is-high" : value >= 40 ? "is-mid" : "is-low"; }

  private patch(id: string, level: CoreConcept["level"]) {
    this.area.update((a) => a && { ...a, concepts: a.concepts.map((c) => (c.id === id ? { ...c, level } : c)) });
  }
}
