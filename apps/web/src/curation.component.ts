import { Component, EventEmitter, Output, signal } from "@angular/core";
import { FormsModule, type NgForm } from "@angular/forms";

type EditorialStatus = "DRAFT" | "IN_REVIEW" | "REJECTED" | "PUBLISHED";
type EditorialRow = {
  questionId: string;
  id: string;
  title: string;
  topic: string;
  origin: "AUTHOR_CREATED";
  editorialStatus: EditorialStatus;
  sequence: number;
  revision: number;
  authorCredit: string;
  currentVersionId: string | null;
  canReview: boolean;
  isAuthor: boolean;
};
type EditorialDetail = EditorialRow & {
  prompt: string;
  explanation: string;
  correctOptionId: string;
  options: { id: string; text: string }[];
  reviewNote: string | null;
};
type Draft = Pick<
  EditorialDetail,
  | "title"
  | "topic"
  | "prompt"
  | "authorCredit"
  | "explanation"
  | "correctOptionId"
  | "options"
>;
const emptyDraft = (): Draft => ({
  title: "",
  topic: "",
  prompt: "",
  authorCredit: "",
  explanation: "",
  correctOptionId: "option-a",
  options: ["a", "b", "c", "d"].map((id) => ({ id: `option-${id}`, text: "" })),
});

@Component({
  selector: "app-curation",
  imports: [FormsModule],
  template: `
    @if (!editing()) {
      <section class="curation-intro">
        <div>
          <p class="eyebrow">CONTEÚDO E REVISÃO</p>
          <h1>Curadoria</h1>
          <p>
            Prepare questões autorais e confira cada versão antes de publicar.
          </p>
        </div>
        <button (click)="newDraft()" [disabled]="busy()">
          Nova questão autoral
        </button>
      </section>
      <p class="editorial-scope">
        A publicação de questões oficiais continua indisponível. Esta fila
        recebe somente conteúdo autoral, com crédito e revisão independente.
      </p>
      <div class="editorial-queue-heading">
        <h2>Fila editorial</h2>
        <button
          class="text-button"
          (click)="loadQueue()"
          [disabled]="busy() || loading()"
        >
          Atualizar fila
        </button>
      </div>
      @if (loading()) {
        <p role="status">Carregando a fila editorial…</p>
      }
      @if (error()) {
        <div class="notice" role="alert">
          <p>{{ error() }}</p>
          <button (click)="loadQueue()">Tentar novamente</button>
        </div>
      } @else if (!loading() && rows().length === 0) {
        <div class="empty">
          <h3>A fila está vazia</h3>
          <p>Crie uma questão autoral para começar a preparação do conteúdo.</p>
        </div>
      } @else {
        <table class="editorial-table">
          <caption class="visually-hidden">
            Versão mais recente de cada questão
          </caption>
          <thead>
            <tr>
              <th scope="col">Questão</th>
              <th scope="col">Situação</th>
              <th scope="col">Versão</th>
              <th scope="col"><span class="visually-hidden">Ação</span></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr>
                <td>
                  <strong>{{ row.title }}</strong
                  ><span class="editorial-row-meta"
                    >{{ row.topic }} · {{ row.authorCredit }}</span
                  >
                </td>
                <td>
                  <span
                    class="editorial-status"
                    [class.published]="row.editorialStatus === 'PUBLISHED'"
                    >{{ statusLabel(row.editorialStatus) }}</span
                  >
                </td>
                <td>
                  <span class="mobile-label">Versão </span>{{ row.sequence }}
                  @if (
                    row.currentVersionId && row.currentVersionId !== row.id
                  ) {
                    <span class="editorial-row-meta"
                      >A versão anterior segue publicada</span
                    >
                  }
                </td>
                <td>
                  <button
                    class="outline"
                    (click)="open(row.id)"
                    [disabled]="loading() || busy()"
                    [attr.aria-label]="'Abrir: ' + row.title"
                  >
                    Abrir <span aria-hidden="true">→</span>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    } @else {
      <button
        class="back text-button"
        (click)="backToQueue()"
        [disabled]="busy()"
      >
        ← Voltar à fila
      </button>
      <section class="editorial-document">
        <p class="eyebrow">
          QUESTÃO AUTORAL
          @if (detail()) {
            · VERSÃO {{ detail()!.sequence }}
          }
        </p>
        <h1 id="editorial-heading" tabindex="-1">
          {{
            editable()
              ? detail()
                ? "Editar rascunho"
                : "Nova questão autoral"
              : detail()!.title
          }}
        </h1>
        @if (detail()) {
          <p class="editorial-document-state">
            <span
              class="editorial-status"
              [class.published]="detail()!.editorialStatus === 'PUBLISHED'"
              >{{ statusLabel(detail()!.editorialStatus) }}</span
            ><span>Crédito: {{ detail()!.authorCredit }}</span>
          </p>
        }
        @if (notice()) {
          <p class="account-success" role="status">{{ notice() }}</p>
        }
        @if (detail()?.editorialStatus === "REJECTED") {
          <section class="editorial-review-note">
            <h2>Ajustes solicitados</h2>
            <p>{{ detail()!.reviewNote }}</p>
          </section>
        }
        @if (editable()) {
          <form #draftForm="ngForm" (ngSubmit)="save(draftForm)" novalidate>
            <fieldset [disabled]="busy()">
              <legend class="visually-hidden">Conteúdo da questão</legend>
              <div class="editorial-field">
                <label for="draft-title">Título</label
                ><input
                  id="draft-title"
                  name="title"
                  [(ngModel)]="draft.title"
                  required
                  maxlength="160"
                />
              </div>
              <div class="editorial-fields-row">
                <div class="editorial-field">
                  <label for="draft-topic">Assunto</label
                  ><input
                    id="draft-topic"
                    name="topic"
                    [(ngModel)]="draft.topic"
                    required
                    maxlength="80"
                  />
                </div>
                <div class="editorial-field">
                  <label for="draft-credit">Crédito de autoria</label
                  ><input
                    id="draft-credit"
                    name="authorCredit"
                    [(ngModel)]="draft.authorCredit"
                    required
                    maxlength="160"
                    aria-describedby="credit-help"
                  />
                  <p id="credit-help" class="account-help">
                    Nome ou equipe responsável pelo conteúdo autoral.
                  </p>
                </div>
              </div>
              <div class="editorial-field">
                <label for="draft-prompt">Enunciado</label
                ><textarea
                  id="draft-prompt"
                  name="prompt"
                  [(ngModel)]="draft.prompt"
                  required
                  maxlength="6000"
                  rows="6"
                ></textarea>
                <p class="account-help">
                  Texto simples, com quebras de linha preservadas. Mantenha a
                  estrutura de exemplos e código.
                </p>
              </div>
              <fieldset class="editorial-options">
                <legend>Alternativas e gabarito</legend>
                <p class="account-help">
                  Use de 2 a 5 alternativas. Marque uma única resposta correta.
                </p>
                @for (
                  option of draft.options;
                  track option.id;
                  let i = $index
                ) {
                  <div class="editorial-option-row">
                    <div class="editorial-field">
                      <label [for]="'draft-option-' + option.id"
                        >Alternativa {{ letters[i] }}</label
                      ><textarea
                        [id]="'draft-option-' + option.id"
                        [name]="'option-' + option.id"
                        [(ngModel)]="option.text"
                        required
                        maxlength="1000"
                        rows="2"
                      ></textarea>
                    </div>
                    <div class="editorial-option-controls">
                      <label class="editorial-radio"
                        ><input
                          type="radio"
                          name="correctOptionId"
                          [value]="option.id"
                          [(ngModel)]="draft.correctOptionId"
                          [attr.aria-label]="
                            'Definir alternativa ' +
                            letters[i] +
                            ' como correta'
                          "
                        />Correta</label
                      ><button
                        type="button"
                        class="text-button"
                        (click)="removeOption(option.id)"
                        [disabled]="draft.options.length <= 2"
                        [attr.aria-label]="'Remover alternativa ' + letters[i]"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                }
                <button
                  type="button"
                  class="outline"
                  (click)="addOption()"
                  [disabled]="draft.options.length >= 5"
                >
                  Adicionar alternativa
                </button>
              </fieldset>
              <div class="editorial-field">
                <label for="draft-explanation">Explicação do gabarito</label
                ><textarea
                  id="draft-explanation"
                  name="explanation"
                  [(ngModel)]="draft.explanation"
                  required
                  maxlength="4000"
                  rows="5"
                ></textarea>
              </div>
              <div class="editorial-actions">
                <button type="submit">
                  {{ busy() ? "Salvando…" : "Salvar rascunho" }}
                </button>
                @if (detail()) {
                  <button
                    type="button"
                    class="outline"
                    (click)="submitForReview()"
                    [disabled]="
                      hasChanges() || detail()!.editorialStatus === 'REJECTED'
                    "
                  >
                    Enviar para revisão
                  </button>
                }
              </div>
              @if (
                detail() &&
                (hasChanges() || detail()!.editorialStatus === "REJECTED")
              ) {
                <p class="account-help">
                  Salve as alterações antes de enviar esta versão para revisão.
                </p>
              }
            </fieldset>
          </form>
        } @else {
          <section class="editorial-readonly">
            <p class="metadata">{{ detail()!.topic }} · Autoral</p>
            <h2>Enunciado</h2>
            <p class="editorial-text">{{ detail()!.prompt }}</p>
            <h2>Alternativas</h2>
            <ol class="editorial-readonly-options">
              @for (
                option of detail()!.options;
                track option.id;
                let i = $index
              ) {
                <li>
                  <strong>{{ letters[i] }}.</strong
                  ><span>{{ option.text }}</span>
                  @if (detail()!.correctOptionId === option.id) {
                    <strong class="editorial-answer-label">Correta</strong>
                  }
                </li>
              }
            </ol>
            <h2>Explicação do gabarito</h2>
            <p class="editorial-text">{{ detail()!.explanation }}</p>
          </section>
          @if (detail()!.editorialStatus === "IN_REVIEW") {
            @if (detail()!.canReview) {
              <section class="editorial-review" aria-labelledby="review-title">
                <h2 id="review-title">Conferência independente</h2>
                <p>
                  Confira o conteúdo, o gabarito e os créditos antes de decidir.
                </p>
                <fieldset [disabled]="busy()">
                  <legend class="visually-hidden">
                    Conferência para publicação
                  </legend>
                  <label class="editorial-check"
                    ><input
                      type="checkbox"
                      [(ngModel)]="checks.content"
                    />Conferi o enunciado e as alternativas.</label
                  ><label class="editorial-check"
                    ><input
                      type="checkbox"
                      [(ngModel)]="checks.answer"
                    />Conferi o gabarito e a explicação.</label
                  ><label class="editorial-check"
                    ><input
                      type="checkbox"
                      [(ngModel)]="checks.credit"
                    />Conferi o crédito de autoria.</label
                  >
                  <div class="editorial-field">
                    <label for="review-note">Parecer da revisão</label
                    ><textarea
                      id="review-note"
                      [(ngModel)]="reviewNote"
                      minlength="10"
                      maxlength="2000"
                      rows="4"
                      aria-describedby="review-help"
                    ></textarea>
                    <p id="review-help" class="account-help">
                      Registre de 10 a 2.000 caracteres. Ao devolver, explique
                      os ajustes necessários.
                    </p>
                  </div>
                  @if (confirmPublication()) {
                    <div class="editorial-confirm">
                      <h3>Confirmar publicação desta versão?</h3>
                      <p>
                        Esta versão ficará disponível no banco de questões. A
                        versão publicada anterior continuará preservada no
                        histórico.
                      </p>
                      <div class="editorial-actions">
                        <button
                          (click)="review('PUBLISH')"
                          [disabled]="!canPublish()"
                        >
                          Confirmar publicação</button
                        ><button
                          class="text-button"
                          (click)="confirmPublication.set(false)"
                        >
                          Cancelar publicação
                        </button>
                      </div>
                    </div>
                  } @else {
                    <div class="editorial-actions">
                      <button
                        (click)="confirmPublication.set(true)"
                        [disabled]="!canPublish()"
                      >
                        Publicar versão</button
                      ><button
                        class="outline"
                        (click)="review('REJECT')"
                        [disabled]="!validReviewNote()"
                      >
                        Devolver para ajustes
                      </button>
                    </div>
                  }
                </fieldset>
              </section>
            } @else {
              <p class="editorial-scope">
                A revisão precisa de outra pessoa da curadoria. Quem criou ou
                editou esta versão não pode publicá-la.
              </p>
            }
          }
          @if (detail()!.editorialStatus === "PUBLISHED") {
            <section class="editorial-next-version">
              <h2>Atualizar o conteúdo</h2>
              <p>
                Prepare um rascunho sem alterar esta versão. O conteúdo
                publicado só será substituído após uma nova revisão
                independente.
              </p>
              <button
                class="outline"
                (click)="cloneVersion()"
                [disabled]="busy()"
              >
                Preparar nova versão
              </button>
            </section>
          }
        }
        @if (error()) {
          <div class="notice" role="alert">
            <p>{{ error() }}</p>
            <p>As alterações desta tela não foram descartadas.</p>
            @if (detail()) {
              <button
                class="outline"
                (click)="open(detail()!.id)"
                [disabled]="busy()"
              >
                Reabrir versão
              </button>
              <p class="account-help">
                Reabrir descarta alterações locais ainda não salvas e consulta a
                versão no servidor.
              </p>
            } @else {
              <p class="account-help">
                Se a conexão caiu após o envio, confira a fila antes de criar o
                rascunho novamente.
              </p>
            }
          </div>
        }
      </section>
    }
  `,
})
export class CurationComponent {
  @Output() busyChange = new EventEmitter<boolean>();
  rows = signal<EditorialRow[]>([]);
  detail = signal<EditorialDetail | null>(null);
  editing = signal(false);
  loading = signal(false);
  busy = signal(false);
  error = signal("");
  notice = signal("");
  confirmPublication = signal(false);
  draft = emptyDraft();
  reviewNote = "";
  checks = { content: false, answer: false, credit: false };
  readonly letters = "ABCDE";
  private active = true;
  private sequence = 0;
  private savedDraft = "";
  private abort = new AbortController();
  constructor() {
    void this.loadQueue();
  }
  ngOnDestroy() {
    this.active = false;
    this.sequence++;
    this.abort.abort();
    this.busyChange.emit(false);
  }
  private async api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch("/api/curation/" + path, {
      ...init,
      headers: { "Content-Type": "application/json" },
      signal: this.abort.signal,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(
        error?.message ||
          "Não foi possível confirmar a operação. Tente novamente.",
      );
    }
    return response.json();
  }
  statusLabel(status: EditorialStatus) {
    return {
      DRAFT: "Rascunho",
      IN_REVIEW: "Em revisão",
      REJECTED: "Ajustes solicitados",
      PUBLISHED: "Publicada",
    }[status];
  }
  editable() {
    return (
      !this.detail() ||
      ["DRAFT", "REJECTED"].includes(this.detail()!.editorialStatus)
    );
  }
  hasChanges() {
    return JSON.stringify(this.draft) !== this.savedDraft;
  }
  validReviewNote() {
    const count = [...this.reviewNote.trim()].length;
    return count >= 10 && count <= 2000;
  }
  canPublish() {
    return (
      this.validReviewNote() &&
      this.checks.content &&
      this.checks.answer &&
      this.checks.credit
    );
  }
  async loadQueue() {
    if (this.busy()) return;
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set("");
    try {
      const rows = await this.api<EditorialRow[]>("questions");
      if (this.active && sequence === this.sequence) this.rows.set(rows);
    } catch (err) {
      if (this.active && sequence === this.sequence)
        this.error.set(this.message(err));
    } finally {
      if (this.active && sequence === this.sequence) this.loading.set(false);
    }
  }
  newDraft() {
    if (this.busy()) return;
    this.sequence++;
    this.loading.set(false);
    this.detail.set(null);
    this.draft = emptyDraft();
    this.savedDraft = "";
    this.error.set("");
    this.notice.set("");
    this.editing.set(true);
    this.focusHeading();
  }
  async open(id: string) {
    if (this.busy()) return;
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set("");
    this.notice.set("");
    try {
      const detail = await this.api<EditorialDetail>(
        "versions/" + encodeURIComponent(id),
      );
      if (this.active && sequence === this.sequence) {
        this.applyDetail(detail);
        this.focusHeading();
      }
    } catch (err) {
      if (this.active && sequence === this.sequence)
        this.error.set(this.message(err));
    } finally {
      if (this.active && sequence === this.sequence) this.loading.set(false);
    }
  }
  backToQueue() {
    if (this.busy()) return;
    this.editing.set(false);
    this.notice.set("");
    void this.loadQueue();
  }
  addOption() {
    if (!this.busy() && this.draft.options.length < 5)
      this.draft.options.push({
        id: "option-" + crypto.randomUUID(),
        text: "",
      });
  }
  removeOption(id: string) {
    if (this.busy() || this.draft.options.length <= 2) return;
    this.draft.options = this.draft.options.filter(
      (option) => option.id !== id,
    );
    if (this.draft.correctOptionId === id)
      this.draft.correctOptionId = this.draft.options[0].id;
  }
  async save(form: NgForm) {
    if (this.busy()) return;
    if (
      form.invalid ||
      !this.draft.title.trim() ||
      !this.draft.topic.trim() ||
      !this.draft.prompt.trim() ||
      !this.draft.explanation.trim() ||
      !this.draft.authorCredit.trim() ||
      this.draft.options.some((option) => !option.text.trim())
    ) {
      this.error.set(
        "Preencha todos os campos da questão e suas alternativas.",
      );
      return;
    }
    const current = this.detail();
    const payload = structuredClone(this.draft);
    await this.mutate(
      current ? `versions/${current.id}` : "questions",
      current ? "PUT" : "POST",
      { ...payload, ...(current ? { baseRevision: current.revision } : {}) },
      "Rascunho salvo.",
    );
  }
  async submitForReview() {
    const current = this.detail();
    if (!current || this.hasChanges() || current.editorialStatus !== "DRAFT")
      return;
    await this.mutate(
      `versions/${current.id}/submit`,
      "POST",
      { baseRevision: current.revision },
      "Versão enviada para revisão independente.",
    );
  }
  async review(decision: "PUBLISH" | "REJECT") {
    const current = this.detail();
    if (
      !current ||
      !this.validReviewNote() ||
      (decision === "PUBLISH" && !this.canPublish())
    )
      return;
    await this.mutate(
      `versions/${current.id}/review`,
      "POST",
      {
        baseRevision: current.revision,
        decision,
        note: this.reviewNote,
        ...(decision === "PUBLISH" ? { checklist: this.checks } : {}),
      },
      decision === "PUBLISH"
        ? "Versão publicada."
        : "Versão devolvida para ajustes.",
    );
  }
  async cloneVersion() {
    const current = this.detail();
    if (!current) return;
    await this.mutate(
      `questions/${current.questionId}/versions`,
      "POST",
      { baseCurrentVersionId: current.currentVersionId },
      "Nova versão preparada. A versão anterior segue publicada.",
    );
  }
  private async mutate(
    path: string,
    method: string,
    body: unknown,
    notice: string,
  ) {
    if (this.busy()) return;
    const sequence = ++this.sequence;
    this.busy.set(true);
    this.busyChange.emit(true);
    this.error.set("");
    this.notice.set("");
    try {
      const detail = await this.api<EditorialDetail>(path, {
        method,
        body: JSON.stringify(body),
      });
      if (this.active && sequence === this.sequence) {
        this.applyDetail(detail);
        this.notice.set(notice);
        this.focusHeading();
      }
    } catch (err) {
      if (this.active && sequence === this.sequence)
        this.error.set(this.message(err));
    } finally {
      if (this.active && sequence === this.sequence) {
        this.busy.set(false);
        this.busyChange.emit(false);
      }
    }
  }
  private applyDetail(detail: EditorialDetail) {
    this.detail.set(detail);
    this.editing.set(true);
    this.draft = {
      title: detail.title,
      topic: detail.topic,
      prompt: detail.prompt,
      authorCredit: detail.authorCredit,
      explanation: detail.explanation,
      correctOptionId: detail.correctOptionId,
      options: detail.options.map((option) => ({ ...option })),
    };
    this.savedDraft = JSON.stringify(this.draft);
    this.reviewNote = "";
    this.checks = { content: false, answer: false, credit: false };
    this.confirmPublication.set(false);
  }
  private focusHeading() {
    setTimeout(() => {
      if (this.active) document.getElementById("editorial-heading")?.focus();
    }, 0);
  }
  private message(err: unknown) {
    return err instanceof Error
      ? err.message
      : "Falha de conexão. Tente novamente.";
  }
}
