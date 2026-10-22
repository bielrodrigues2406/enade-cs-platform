import { Component, signal } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";
type Summary = {
  id: string;
  title: string;
  topic: string;
  origin: string;
  answered: boolean;
};
type Answer = {
  optionId: string;
  revision: number;
  correct: boolean;
  correctOptionId: string;
  explanation: string;
};
type Question = Summary & {
  prompt: string;
  options: { id: string; text: string }[];
  answer: Answer | null;
};

@Component({
  selector: "app-root",
  imports: [FormsModule],
  template: `
    <a class="skip" href="#content">Ir para o conteúdo</a>
    <header>
      <a href="/" class="brand" aria-label="Caderno de Computação, início"
        ><span class="brand-symbol" aria-hidden="true">cc.</span
        ><span
          >Caderno<span class="brand-sub">CIÊNCIA DA COMPUTAÇÃO</span></span
        ></a
      ><span class="environment">Base de desenvolvimento</span>
    </header>
    <div class="layout">
      <aside aria-label="Sobre este caderno">
        <p class="eyebrow">SEU ESPAÇO DE ESTUDO</p>
        <button class="nav" (click)="back()">
          Banco de questões <span aria-hidden="true">→</span>
        </button>
        <div class="sidebar-note">
          <span class="small-rule"></span>
          <h2>Uma questão.<br />Um conceito mais claro.</h2>
          <p>Leia com atenção, confirme sua resposta e retome de onde parou.</p>
          <p class="muted">
            Nesta base, as questões são autorais demonstrativas. Ainda não há
            questões oficiais importadas.
          </p>
        </div>
      </aside>
      <main id="content" tabindex="-1">
        <div class="breadcrumb">
          ESTUDAR <span>/</span>
          {{ question() ? "RESOLUÇÃO" : "BANCO DE QUESTÕES" }}
        </div>
        @if (booting()) {
          <p role="status">Preparando seu caderno…</p>
        } @else if (bootError()) {
          <section class="notice" role="alert">
            <h1>Não foi possível abrir o caderno</h1>
            <p>{{ bootError() }}</p>
            <button (click)="boot()">Tentar novamente</button>
          </section>
        } @else {
          @if (!question()) {
            <section class="page-intro">
              <p class="eyebrow">PRÁTICA COM CONTEXTO</p>
              <h1>Banco de questões</h1>
              <p>
                Escolha um assunto. Entenda o raciocínio.<br class="desktop" />
                Continue a construir sua base.
              </p>
            </section>
            <div class="source-note">
              <span class="dot" aria-hidden="true"></span>
              <p>
                <strong>Conteúdo de demonstração</strong> · Questões autorais
                para experimentar o fluxo de estudo. Não são questões oficiais
                do ENADE.
              </p>
            </div>
            <form class="filters" (ngSubmit)="loadCatalog()">
              <div>
                <label for="search">Buscar no caderno</label
                ><input
                  id="search"
                  name="search"
                  [(ngModel)]="search"
                  maxlength="120"
                  placeholder="Título ou trecho do enunciado"
                />
              </div>
              <div>
                <label for="topic">Assunto</label
                ><select id="topic" name="topic" [(ngModel)]="topic">
                  <option value="">Todos os assuntos</option>
                  <option>Algoritmos</option>
                  <option>Banco de dados</option>
                  <option>Redes</option>
                </select>
              </div>
              <button type="submit" [disabled]="loading()">Filtrar</button>
              @if (search || topic) {
                <button
                  type="button"
                  class="text-button"
                  (click)="clearFilters()"
                >
                  Limpar
                </button>
              }
            </form>
            <div class="list-heading">
              <h2>Explore o caderno</h2>
              <span>{{ rows().length }} questões nesta seleção</span>
            </div>
            @if (loading()) {
              <p role="status">Buscando questões…</p>
            }
            @if (error()) {
              <div class="notice" role="alert">
                <p>{{ error() }}</p>
                <button (click)="loadCatalog()">Tentar novamente</button>
              </div>
            } @else if (!loading() && rows().length === 0) {
              <div class="empty">
                <h3>Nenhuma questão nesta seleção</h3>
                <p>Experimente outra palavra ou remova os filtros.</p>
                <button (click)="clearFilters()">Limpar filtros</button>
              </div>
            } @else {
              <ol class="question-list">
                @for (row of rows(); track row.id; let i = $index) {
                  <li>
                    <span class="question-number" aria-hidden="true">{{
                      (i + 1).toString().padStart(2, "0")
                    }}</span>
                    <div class="question-summary">
                      <p class="metadata">
                        {{ row.topic }} <span>·</span> Autoral demonstrativa
                      </p>
                      <h3>{{ row.title }}</h3>
                      <p class="state">
                        {{
                          row.answered
                            ? "Resposta salva · você pode revisar"
                            : "Disponível para praticar"
                        }}
                      </p>
                    </div>
                    <button
                      class="outline"
                      (click)="open(row.id)"
                      [disabled]="loading()"
                      [attr.aria-label]="
                        (row.answered ? 'Revisar: ' : 'Resolver: ') + row.title
                      "
                    >
                      {{ row.answered ? "Revisar" : "Resolver" }}
                      <span aria-hidden="true">→</span>
                    </button>
                  </li>
                }
              </ol>
            }
            <footer>
              Seu histórico fica associado à sessão deste navegador por até 30
              dias.<br />Sem conta ou sincronização entre dispositivos nesta
              versão.
            </footer>
          } @else {
            <button class="back text-button" (click)="back()">
              ← Voltar ao banco
            </button>
            <article class="resolution">
              <p class="metadata">
                {{ question()!.topic }} <span>·</span> Autoral demonstrativa
                <span>·</span> Versão 1
              </p>
              <h1>{{ question()!.title }}</h1>
              <p class="prompt">{{ question()!.prompt }}</p>
              <form (ngSubmit)="save()">
                <fieldset
                  [disabled]="saving() || (!!question()!.answer && !editing())"
                >
                  <legend>Selecione uma alternativa</legend>
                  @for (
                    option of question()!.options;
                    track option.id;
                    let i = $index
                  ) {
                    <label
                      class="option"
                      [class.selected]="selected === option.id"
                      ><input
                        type="radio"
                        name="answer"
                        [value]="option.id"
                        [(ngModel)]="selected"
                      /><span class="letter" aria-hidden="true">{{
                        "ABCD"[i]
                      }}</span
                      ><span>{{ option.text }}</span></label
                    >
                  }
                </fieldset>
                @if (!question()!.answer || editing()) {
                  <div class="submit-row">
                    <button type="submit" [disabled]="!selected || saving()">
                      {{
                        saving() ? "Confirmando…" : "Confirmar resposta"
                      }}</button
                    ><span>O feedback aparece após a confirmação.</span>
                  </div>
                }
              </form>
              @if (error()) {
                <div class="notice" role="alert">
                  <p>{{ error() }}</p>
                  <p>
                    Sua seleção foi preservada. Tente confirmar novamente; se
                    houver conflito, reabra a questão.
                  </p>
                  <button class="outline" (click)="open(question()!.id)">
                    Reabrir questão
                  </button>
                </div>
              }
              @if (question()!.answer && !editing()) {
                <section
                  class="feedback"
                  aria-label="Resultado da resposta"
                  role="status"
                >
                  <p class="eyebrow">RESPOSTA SALVA</p>
                  <h2>
                    {{
                      question()!.answer!.correct
                        ? "Você acertou."
                        : "Vamos entender este conceito."
                    }}
                  </h2>
                  <p>
                    <strong>Alternativa correta:</strong> {{ correctText() }}
                  </p>
                  <p>{{ question()!.answer!.explanation }}</p>
                  <button class="text-button" (click)="editing.set(true)">
                    Alterar resposta
                  </button>
                </section>
              }
            </article>
          }
        }
      </main>
    </div>
  `,
})
class App {
  rows = signal<Summary[]>([]);
  question = signal<Question | null>(null);
  booting = signal(true);
  bootError = signal("");
  loading = signal(false);
  saving = signal(false);
  error = signal("");
  editing = signal(false);
  search = "";
  topic = "";
  selected = "";
  private requestNumber = 0;
  constructor() {
    void this.boot();
  }
  async api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch("/api/" + path, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(
        data?.message ||
          "Não foi possível confirmar a operação. Verifique a conexão e tente novamente.",
      );
    }
    return res.json();
  }
  async boot() {
    this.booting.set(true);
    this.bootError.set("");
    try {
      await this.api("session", { method: "POST" });
      await this.loadCatalog();
    } catch (err) {
      this.bootError.set(this.message(err));
    } finally {
      this.booting.set(false);
    }
  }
  async loadCatalog() {
    const request = ++this.requestNumber;
    this.loading.set(true);
    this.error.set("");
    try {
      const rows = await this.api<Summary[]>(
        "questions?" +
          new URLSearchParams({ q: this.search, topic: this.topic }),
      );
      if (request === this.requestNumber) this.rows.set(rows);
    } catch (err) {
      if (request === this.requestNumber) this.error.set(this.message(err));
    } finally {
      if (request === this.requestNumber) this.loading.set(false);
    }
  }
  async open(id: string) {
    const request = ++this.requestNumber;
    this.loading.set(true);
    this.error.set("");
    try {
      const q = await this.api<Question>("questions/" + encodeURIComponent(id));
      if (request !== this.requestNumber) return;
      this.question.set(q);
      this.selected = q.answer?.optionId || "";
      this.editing.set(false);
      this.focusMain();
    } catch (err) {
      if (request === this.requestNumber) this.error.set(this.message(err));
    } finally {
      if (request === this.requestNumber) this.loading.set(false);
    }
  }
  async save() {
    const q = this.question();
    if (!q || !this.selected || this.saving()) return;
    this.saving.set(true);
    this.error.set("");
    try {
      const answer = await this.api<Answer>(`questions/${q.id}/answer`, {
        method: "PUT",
        body: JSON.stringify({
          optionId: this.selected,
          baseRevision: q.answer?.revision || 0,
        }),
      });
      if (this.question()?.id === q.id) {
        this.question.set({ ...q, answer });
        this.editing.set(false);
      }
    } catch (err) {
      this.error.set(this.message(err));
    } finally {
      this.saving.set(false);
    }
  }
  back() {
    if (this.saving()) return;
    this.question.set(null);
    this.error.set("");
    void this.loadCatalog();
    this.focusMain();
  }
  clearFilters() {
    this.search = "";
    this.topic = "";
    void this.loadCatalog();
  }
  correctText() {
    const q = this.question();
    return (
      q?.options.find((o) => o.id === q.answer?.correctOptionId)?.text || ""
    );
  }
  private message(err: unknown) {
    return err instanceof Error
      ? err.message
      : "Falha de conexão. Tente novamente.";
  }
  private focusMain() {
    setTimeout(() => document.getElementById("content")?.focus(), 0);
  }
}
bootstrapApplication(App).catch(console.error);
