import { Component, ElementRef, EventEmitter, Injector, Input, Output, afterNextRender, computed, inject, signal, type SimpleChanges } from "@angular/core";
import { requestJson } from "./api-request";
import { ChoiceService } from "./choice-dialog";
import { availableInArea, chooseAreaSimulation, type PracticeRequest } from "./practice-request";
import type { PracticeSource } from "./exam.types";
import { CoreLessonComponent } from "./core-lesson.component";
import { ResumeService } from "./resume.service";
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
  /** Lição pedida pelo endereço (/biblioteca/<área>/<conceito>); null mostra a área. */
  @Input() lesson: string | null = null;
  /** Abrir ou fechar uma lição muda o endereço; a Biblioteca devolve em `lesson`. */
  @Output() lessonChange = new EventEmitter<{ concept: string | null; replace?: boolean }>();
  @Output() back = new EventEmitter<void>();
  @Output() question = new EventEmitter<string>();
  @Output() practice = new EventEmitter<PracticeRequest>();
  /** Pede os flashcards já abertos no baralho desta área. */
  @Output() flashcards = new EventEmitter<string>();
  @Output() sheet = new EventEmitter<string>();
  @Output() generated = new EventEmitter<string>();

  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private injector = inject(Injector);
  private choice = inject(ChoiceService);
  private resume = inject(ResumeService);
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
  ngOnChanges(changes: SimpleChanges) {
    // Voltar/Avançar pode trocar a área com este componente aberto.
    if (changes["slug"] && !changes["slug"].firstChange) {
      this.area.set(null);
      this.reading.set(null);
      void this.load();
    } else if (changes["lesson"] && !changes["lesson"].firstChange) this.showLesson();
  }

  async load() {
    this.error.set("");
    try {
      const slug = this.slug;
      const area = await requestJson<CoreArea>(`/api/core/${encodeURIComponent(slug)}`);
      if (slug !== this.slug) return;
      this.area.set(area);
      // Endereço com lição (recarga, link ou "Continuar de onde parou"): abre direto nela.
      if (this.lesson) return this.showLesson();
      afterNextRender(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        this.host.nativeElement.querySelector<HTMLElement>("#core-area-title")?.focus({ preventScroll: true });
      }, { injector: this.injector });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Não foi possível abrir a área. Tente novamente.");
    }
  }

  /** Marca na hora; se o servidor recusar, volta ao que era e avisa. */
  /** Nível escolhido pelo teclado enquanto outro ainda era gravado; vale o último. */
  private queued: { id: string; level: 0 | 1 | 2 } | null = null;

  /** Clique alterna (clicar no marcado desmarca); pelo teclado (`toggle` falso) só marca. */
  async rate(concept: CoreConcept, value: 0 | 1 | 2, toggle = true) {
    if (this.saving()) {
      if (!toggle && this.saving() === concept.id) {
        this.queued = { id: concept.id, level: value };
        this.patch(concept.id, value);
      }
      return;
    }
    const level = toggle && concept.level === value ? null : value;
    const previous = concept.level;
    this.patch(concept.id, level);
    this.saving.set(concept.id);
    /** O que o servidor guarda depois desta chamada: o nível novo, ou o anterior se falhar. */
    let confirmed = previous;
    this.error.set("");
    try {
      const result = await requestJson<{ confidence: Confidence }>(`/api/core/concepts/${concept.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level }),
      });
      this.area.update((a) => a && { ...a, confidence: result.confidence });
      confirmed = level;
    } catch (error) {
      this.patch(concept.id, previous);
      this.error.set(error instanceof Error ? error.message : "Não foi possível guardar. Tente novamente.");
    } finally {
      this.saving.set(null);
      const queued = this.queued;
      this.queued = null;
      const target = queued && this.area()?.concepts.find((c) => c.id === queued.id);
      // A tela já mostra o último nível; grava-o agora (o anterior pode ter mudado o servidor).
      if (target && queued.level !== confirmed) void this.rate({ ...target, level: confirmed }, queued.level, false);
    }
  }

  /**
   * Padrão de grupo de rádio (revisão do Codex, R10): setas, Home e End movem o foco
   * e marcam o nível; só o marcado (ou o primeiro) entra na ordem do Tab.
   */
  ratingKey(event: KeyboardEvent, concept: CoreConcept, index: number) {
    const last = this.levels.length - 1;
    const target = ({ ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: last } as Record<string, number>)[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = target < 0 ? last : target > last ? 0 : target;
    const group = (event.currentTarget as HTMLElement).parentElement;
    (group?.children[next] as HTMLElement | undefined)?.focus();
    const current = this.area()?.concepts.find((c) => c.id === concept.id)?.level ?? null;
    if (current !== this.levels[next].value) void this.rate({ ...concept, level: current }, this.levels[next].value, false);
  }

  /** Simulado da área: só oficiais ou misturado com as geradas por IA (marcadas). */
  async train(source: PracticeSource = "OFFICIAL") {
    const area = this.area();
    if (!area) return;
    let count: number;
    try { count = await availableInArea(area.area, source); } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Não foi possível preparar o treino. Tente novamente.");
      return;
    }
    if (!count) { this.error.set("Ainda não há questões publicadas desta área para treinar."); return; }
    const request = await chooseAreaSimulation(this.choice, area.area, count, undefined, source);
    if (request) this.practice.emit(request);
  }

  read(concept: CoreConcept) {
    if (concept.id !== this.lesson) this.lessonChange.emit({ concept: concept.id });
  }

  closeLesson() {
    this.lessonChange.emit({ concept: null });
  }

  /** Mostra a lição do endereço; um conceito sem lição corrige o endereço para a área. */
  private showLesson() {
    const area = this.area();
    if (!area) return;
    const concept = this.lesson ? area.concepts.find((c) => c.id === this.lesson && c.lesson) ?? null : null;
    if (this.lesson && !concept) return this.lessonChange.emit({ concept: null, replace: true });
    const previous = this.reading()?.id;
    if (previous === concept?.id) return;
    this.reading.set(concept);
    if (concept) {
      this.resume.record({ kind: "lesson", slug: this.slug, concept: concept.id, title: concept.name, area: area.area });
      return;
    }
    // Voltou para a área: o foco vai para o botão da lição que estava aberta.
    const id = previous;
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
