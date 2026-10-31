import { Component, EventEmitter, Input, Output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

export type ReviewItem = {
  id: string;
  questionId: string;
  title: string;
  topic: string;
  origin: string;
  demonstration: boolean;
  versionNumber: number;
  answeredAt: string;
  currentVersionId: string | null;
  /** Revisão espaçada: o erro volta um dia depois de ver o gabarito. */
  reviewAt: string;
  ready: boolean;
};
type Notebook = {
  summary: {
    answered: number;
    correct: number;
    incorrect: number;
    demonstration: number;
    /** Erros que já passaram do intervalo e estão prontos para refazer. */
    ready: number;
  };
  topics: { topic: string; answered: number; incorrect: number }[];
  items: ReviewItem[];
  total: number;
  offset: number;
  pageSize: number;
};
export type ReviewPosition = { topic: string; offset: number };

@Component({
  selector: "app-review",
  imports: [FormsModule],
  templateUrl: "./review.component.html",
})
export class ReviewComponent {
  @Input() position: ReviewPosition = { topic: "", offset: 0 };
  @Input() opening = false;
  @Output() positionChange = new EventEmitter<ReviewPosition>();
  @Output() resolve = new EventEmitter<ReviewItem>();
  @Output() browse = new EventEmitter<void>();
  /** Treino só com os erros prontos; acertar lá tira a questão do caderno. */
  @Output() practiceErrors = new EventEmitter<void>();
  notebook = signal<Notebook | null>(null);
  loading = signal(false);
  error = signal("");
  topic = "";
  private offset = 0;
  private active = true;
  private request = 0;
  private abort = new AbortController();
  ngOnInit() {
    this.topic = this.position.topic;
    void this.load(this.position.offset);
  }
  ngOnDestroy() {
    this.active = false;
    this.request++;
    this.abort.abort();
  }
  page(data: Notebook) {
    return Math.floor(data.offset / data.pageSize) + 1;
  }
  pages(data: Notebook) {
    return Math.ceil(data.total / data.pageSize);
  }
  origin(row: ReviewItem) {
    return row.origin === "OFFICIAL"
      ? "Oficial · Inep"
      : row.demonstration
        ? "Autoral demonstrativa"
        : "Autoral";
  }
  date(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }
  focusTopic(topic: string) {
    this.topic = topic;
    void this.load(0);
  }
  clearTopic() {
    this.topic = "";
    void this.load(0);
  }
  async load(offset = this.offset) {
    const request = ++this.request;
    this.offset = Math.max(0, offset);
    this.positionChange.emit({ topic: this.topic, offset: this.offset });
    this.loading.set(true);
    this.error.set("");
    try {
      const response = await fetch(
        "/api/review?" +
          new URLSearchParams({
            topic: this.topic,
            offset: String(this.offset),
          }),
        { signal: this.abort.signal },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.message || "Verifique a conexão e tente novamente.",
        );
      }
      const data: Notebook = await response.json();
      if (!this.active || request !== this.request) return;
      if (!data.items.length && data.offset > 0) {
        const last = Math.max(
          0,
          (Math.ceil(data.total / data.pageSize) - 1) * data.pageSize,
        );
        await this.load(last);
        return;
      }
      this.notebook.set(data);
    } catch (err) {
      if (this.active && request === this.request)
        this.error.set(
          err instanceof Error
            ? err.message
            : "Falha de conexão. Tente novamente.",
        );
    } finally {
      if (this.active && request === this.request) this.loading.set(false);
    }
  }
}
