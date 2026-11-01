import { Component, ElementRef, HostListener, Injector, afterNextRender, computed, inject, signal } from "@angular/core";
import { EngagementService } from "./engagement.service";

// Flashcards (FLASH-1). Prática de recuperação (tentar lembrar antes de ver a
// resposta) com repetição espaçada pelo FSRS-5 no servidor. Quem erra revê o
// cartão no fim da mesma sessão; quem acerta só volta a vê-lo no prazo.

type DeckSummary = { deck: string; area: string; title: string; description: string; total: number; due: number; fresh: number; mastered: number };
type Card = { id: string; front: string; back: string; deck: string; area: string; isNew: boolean; preview: number[] };
type Grade = 1 | 2 | 3 | 4;

export const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: 1, label: "Errei", key: "1" },
  { grade: 2, label: "Difícil", key: "2" },
  { grade: 3, label: "Bom", key: "3" },
  { grade: 4, label: "Fácil", key: "4" },
];

/** "10 min", "1 dia", "3 dias", "2 meses". */
export function intervalLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const days = Math.round(minutes / 1440);
  if (days < 30) return days === 1 ? "1 dia" : `${days} dias`;
  const months = Math.round(days / 30);
  return months === 1 ? "1 mês" : `${months} meses`;
}

@Component({
  selector: "app-flashcards",
  templateUrl: "./flashcards.component.html",
  styleUrl: "./flashcards.component.css",
})
export class FlashcardsComponent {
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private injector = inject(Injector);
  private engagement = inject(EngagementService);
  readonly grades = GRADES;
  readonly intervalLabel = intervalLabel;
  decks = signal<DeckSummary[] | null>(null);
  reviewedToday = signal(0);
  error = signal("");
  /** Sessão em andamento: fila, cartão virado e contagem por nota. */
  queue = signal<Card[]>([]);
  sessionTitle = signal("");
  flipped = signal(false);
  saving = signal(false);
  done = signal<{ total: number; byGrade: number[] } | null>(null);
  private tally = [0, 0, 0, 0];
  private reviewed = new Set<string>();

  readonly current = computed(() => this.queue()[0] ?? null);
  readonly totalDue = computed(() => (this.decks() ?? []).reduce((sum, d) => sum + d.due, 0));
  readonly progress = computed(() => {
    const left = this.queue().length;
    const total = this.reviewed.size + left;
    return total ? this.reviewed.size / total : 0;
  });

  async ngOnInit() {
    await this.loadDecks();
  }

  async loadDecks() {
    try {
      const response = await fetch("/api/flashcards");
      if (!response.ok) throw new Error();
      const data = await response.json();
      this.decks.set(data.decks);
      this.reviewedToday.set(data.reviewedToday);
    } catch {
      this.error.set("Não foi possível carregar os baralhos. Verifique a conexão e tente de novo.");
    }
  }

  async start(deck: DeckSummary | null) {
    this.error.set("");
    const response = await fetch(`/api/flashcards/session${deck ? `?deck=${deck.deck}` : ""}`);
    if (!response.ok) { this.error.set("Não foi possível abrir a sessão."); return; }
    const { cards } = await response.json();
    if (!cards.length) { this.error.set("Nada para revisar agora neste baralho. Volte mais tarde."); return; }
    this.tally = [0, 0, 0, 0];
    this.reviewed = new Set();
    this.done.set(null);
    this.flipped.set(false);
    this.sessionTitle.set(deck ? deck.title : "Todos os baralhos");
    this.queue.set(cards);
    this.focus(".flash-card");
  }

  flip() {
    if (this.current() && !this.saving()) this.flipped.set(!this.flipped());
  }

  async rate(grade: Grade) {
    const card = this.current();
    if (!card || !this.flipped() || this.saving()) return;
    this.saving.set(true);
    try {
      const response = await fetch(`/api/flashcards/${card.id}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grade }),
      });
      if (!response.ok) throw new Error();
      this.tally[grade - 1]++;
      this.reviewed.add(card.id);
      // Errou: o cartão volta no fim desta sessão, já com os prazos de quem errou.
      const rest = this.queue().slice(1);
      this.queue.set(grade === 1 ? [...rest, { ...card, isNew: false, preview: [10, 10, 1440, 2880] }] : rest);
      this.flipped.set(false);
      if (!this.queue().length) await this.finish();
      void this.engagement.refresh();
    } catch {
      this.error.set("Não foi possível salvar a resposta. Tente de novo.");
    } finally {
      this.saving.set(false);
    }
  }

  async finish() {
    this.done.set({ total: this.tally.reduce((a, b) => a + b, 0), byGrade: [...this.tally] });
    this.queue.set([]);
    await this.loadDecks();
    this.focus("#flash-done");
  }

  leave() {
    this.queue.set([]);
    this.done.set(null);
    void this.loadDecks();
    this.focus("#flash-title");
  }

  /** Espaço vira o cartão; 1 a 4 dão a nota (depois de virar). */
  @HostListener("document:keydown", ["$event"]) keys(event: KeyboardEvent) {
    if (!this.current() || (event.target as HTMLElement)?.closest("input, textarea, select")) return;
    if (event.key === " " && !(event.target as HTMLElement)?.closest("button")) { event.preventDefault(); this.flip(); }
    const grade = GRADES.find((g) => g.key === event.key);
    if (grade && this.flipped()) { event.preventDefault(); void this.rate(grade.grade); }
  }

  masteredRatio(deck: DeckSummary) {
    return deck.total ? deck.mastered / deck.total : 0;
  }
  percent(value: number, total: number) {
    return total ? Math.round((100 * value) / total) : 0;
  }

  private focus(selector: string) {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), { injector: this.injector });
  }
}
