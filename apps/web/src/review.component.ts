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
};
type Notebook = {
  summary: {
    answered: number;
    correct: number;
    incorrect: number;
    demonstration: number;
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
  template: `
    <section class="page-intro">
      <h1>Caderno de erros</h1>
      <p>Volte às questões cuja última resposta salva está incorreta.</p>
    </section>
    @if (notebook(); as data) {
      <section class="review-summary" aria-label="Resumo das respostas salvas">
        <p>
          <strong>{{ data.summary.incorrect }}</strong>
          {{
            data.summary.incorrect === 1
              ? "questão a retomar"
              : "questões a retomar"
          }}
          <span
            >de {{ data.summary.answered }}
            {{
              data.summary.answered === 1
                ? "questão distinta respondida."
                : "questões distintas respondidas."
            }}</span
          >
        </p>
        <p>
          Acertos na última resposta: {{ data.summary.correct }} de
          {{ data.summary.answered }}.
        </p>
        <p class="muted">
          {{ data.summary.demonstration }}
          {{
            data.summary.demonstration === 1
              ? "dessas questões é autoral demonstrativa."
              : "dessas questões são autorais demonstrativas."
          }}
          Editar uma resposta ou resolver outra versão não aumenta a contagem de
          questões. Este resumo descreve sua prática salva; não estima sua nota
          no ENADE.
        </p>
      </section>
    }
    <form class="review-filters" (ngSubmit)="load(0)">
      <div>
        <label for="review-topic">Assunto para retomar</label>
        <select
          id="review-topic"
          name="topic"
          [(ngModel)]="topic"
          [disabled]="loading() || opening"
        >
          <option value="">Todos os assuntos</option>
          @for (row of notebook()?.topics || []; track row.topic) {
            <option [value]="row.topic">
              {{ row.topic }} · {{ row.incorrect }} a retomar
            </option>
          }
        </select>
      </div>
      <button type="submit" [disabled]="loading() || opening">
        Filtrar erros
      </button>
      <button
        class="text-button"
        type="button"
        (click)="load()"
        [disabled]="loading() || opening"
      >
        Atualizar caderno
      </button>
    </form>
    @if (loading()) {
      <p role="status">Carregando seu caderno de erros…</p>
    } @else if (error()) {
      <section class="notice" role="alert">
        <h2>Não foi possível atualizar o caderno</h2>
        <p>{{ error() }}</p>
        <button (click)="load()">Tentar novamente</button>
      </section>
    } @else if (notebook(); as data) {
      @if (!data.summary.answered) {
        <section class="empty">
          <h2>Ainda não há respostas salvas</h2>
          <p>
            Resolva uma questão no banco. Se precisar retomar o conceito, ela
            aparecerá aqui.
          </p>
          <button (click)="browse.emit()">Ir ao banco de questões</button>
        </section>
      } @else if (!data.total) {
        <section class="empty">
          <h2>
            {{
              topic && data.summary.incorrect
                ? "Nenhuma questão a retomar neste assunto"
                : "Nenhum erro na última resposta salva"
            }}
          </h2>
          <p>
            {{
              topic && data.summary.incorrect
                ? "Há questões a retomar em outros assuntos."
                : "Novas respostas incorretas aparecerão neste caderno."
            }}
          </p>
          @if (topic && data.summary.incorrect) {
            <button (click)="clearTopic()">Ver todos os assuntos</button>
          } @else {
            <button (click)="browse.emit()">
              Continuar no banco de questões
            </button>
          }
        </section>
      } @else {
        <div class="results-heading">
          <h2>Questões a retomar</h2>
          <p>
            {{ data.offset + 1 }}–{{ data.offset + data.items.length }} de
            {{ data.total }}
          </p>
        </div>
        <p class="review-order">
          As respostas incorretas mais antigas aparecem primeiro.
        </p>
        <ol class="question-list review-list" [attr.start]="data.offset + 1">
          @for (row of data.items; track row.id) {
            <li>
              <div class="question-summary">
                <p class="metadata">
                  {{ row.topic }} · {{ origin(row) }} · Versão
                  {{ row.versionNumber }}
                </p>
                <h3>{{ row.title }}</h3>
                <p class="state">
                  Última resposta incorreta salva em {{ date(row.answeredAt) }}.
                </p>
                @if (row.currentVersionId && row.currentVersionId !== row.id) {
                  <p class="review-version">
                    Há uma versão publicada mais recente. Aqui você retoma a
                    versão {{ row.versionNumber }}, com o gabarito daquela
                    versão.
                  </p>
                }
              </div>
              <button
                class="outline"
                (click)="resolve.emit(row)"
                [disabled]="opening"
                [attr.aria-label]="'Tentar novamente: ' + row.title"
              >
                Tentar novamente <span aria-hidden="true">→</span>
              </button>
            </li>
          }
        </ol>
        <nav
          class="review-pagination"
          aria-label="Paginação do caderno de erros"
        >
          <button
            class="outline"
            (click)="load(data.offset - data.pageSize)"
            [disabled]="data.offset === 0 || opening"
          >
            Anterior
          </button>
          <p>Página {{ page(data) }} de {{ pages(data) }}</p>
          <button
            class="outline"
            (click)="load(data.offset + data.pageSize)"
            [disabled]="
              data.offset + data.items.length >= data.total || opening
            "
          >
            Próxima
          </button>
        </nav>
      }
    }
    @if (opening) {
      <p role="status">Abrindo a questão para resolver novamente…</p>
    }
  `,
})
export class ReviewComponent {
  @Input() position: ReviewPosition = { topic: "", offset: 0 };
  @Input() opening = false;
  @Output() positionChange = new EventEmitter<ReviewPosition>();
  @Output() resolve = new EventEmitter<ReviewItem>();
  @Output() browse = new EventEmitter<void>();
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
