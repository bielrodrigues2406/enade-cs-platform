import { Component, EventEmitter, Output, signal } from "@angular/core";
import { FormsModule, type NgForm } from "@angular/forms";
import { SourcesComponent, type OfficialSource } from "./sources.component";
import { QuestionImportsComponent } from "./question-imports.component";
type OfficialProvenance = {
  examSourceId: string;
  keySourceId: string;
  page: number;
  questionNumber: number;
  keyPage: number;
};

type EditorialStatus = "DRAFT" | "IN_REVIEW" | "REJECTED" | "PUBLISHED";
type EditorialRow = {
  questionId: string;
  id: string;
  title: string;
  topic: string;
  origin: "AUTHOR_CREATED" | "OFFICIAL";
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
  explanationCredit: string;
  provenance: OfficialProvenance | null;
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
  | "origin"
  | "explanationCredit"
  | "provenance"
>;
const emptyDraft = (
  origin: "AUTHOR_CREATED" | "OFFICIAL" = "AUTHOR_CREATED",
): Draft => ({
  origin,
  explanationCredit: "",
  provenance:
    origin === "OFFICIAL"
      ? {
          examSourceId: "",
          keySourceId: "",
          page: 1,
          questionNumber: 1,
          keyPage: 1,
        }
      : null,
  title: "",
  topic: "",
  prompt: "",
  authorCredit: origin === "OFFICIAL" ? "Inep" : "",
  explanation: "",
  correctOptionId: "option-a",
  options: ["a", "b", "c", "d"].map((id) => ({ id: `option-${id}`, text: "" })),
});

@Component({
  selector: "app-curation",
  imports: [FormsModule, SourcesComponent, QuestionImportsComponent],
  template: `
    @if (!editing()) {
      <nav class="curation-sections" aria-label="Área da curadoria">
        <button
          class="text-button"
          (click)="showQuestions()"
          [attr.aria-current]="!sourceView() && !importView() ? 'page' : null"
          [disabled]="busy() || sourceBusy()"
        >
          Questões</button
        ><button
          class="text-button"
          (click)="showSources()"
          [attr.aria-current]="sourceView() ? 'page' : null"
          [disabled]="busy() || sourceBusy()"
        >
          Fontes
        </button>
        <button class="text-button" (click)="showImports()" [attr.aria-current]="importView() ? 'page' : null" [disabled]="busy() || sourceBusy()">Importação</button>
      </nav>
    }
    @if (importView()) {
      <app-question-imports (busyChange)="setSourceBusy($event)" />
    } @else if (sourceView()) {
      <app-sources (busyChange)="setSourceBusy($event)" />
    } @else if (!editing()) {
      <section class="curation-intro">
        <div>
          <h1>Curadoria</h1>
          <p>Prepare questões e confira fontes e versões antes de publicar.</p>
        </div>
        <div class="curation-create-actions">
          <button (click)="newDraft()" [disabled]="busy()">
            Nova questão autoral</button
          ><button
            class="outline"
            (click)="newDraft('OFFICIAL')"
            [disabled]="busy()"
          >
            Nova questão oficial
          </button>
        </div>
      </section>
      <p class="editorial-scope">
        Questões oficiais exigem prova e gabarito definitivo verificados. Todo
        conteúdo passa por revisão independente antes de ser publicado.
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
                    >{{ row.topic }} ·
                    {{ row.origin === "OFFICIAL" ? "Oficial" : "Autoral" }} ·
                    {{ row.authorCredit }}</span
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
          {{
            draft.origin === "OFFICIAL" ? "QUESTÃO OFICIAL" : "QUESTÃO AUTORAL"
          }}
          @if (detail()) {
            · VERSÃO {{ detail()!.sequence }}
          }
        </p>
        <h1 id="editorial-heading" tabindex="-1">
          {{
            editable()
              ? detail()
                ? "Editar rascunho"
                : draft.origin === "OFFICIAL"
                  ? "Nova questão oficial"
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
              @if (draft.origin === "OFFICIAL") {
                <fieldset class="official-provenance-fields">
                  <legend>Procedência da questão oficial</legend>
                  <p class="account-help">
                    Selecione documentos verificados da mesma edição, área e
                    modalidade. Confira as páginas e o número na prova.
                  </p>
                  @if (sourceLoading()) {
                    <p role="status">Carregando fontes verificadas…</p>
                  }
                  <div class="editorial-field">
                    <label for="draft-exam">Prova oficial verificada</label
                    ><select
                      id="draft-exam"
                      name="examSourceId"
                      [(ngModel)]="draft.provenance!.examSourceId"
                      (ngModelChange)="examChanged()"
                      [disabled]="!!detail()"
                      required
                    >
                      <option value="">Selecione uma prova</option>
                      @for (source of verifiedExams(); track source.id) {
                        <option [value]="source.id">
                          {{ source.year }} · {{ source.area }} ·
                          {{ source.title }}
                        </option>
                      }
                    </select>
                    @if (exam()) {
                      <p class="account-help">
                        <a
                          [href]="exam()!.officialUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          >Conferir prova oficial</a
                        >
                        · {{ exam()!.pageCount }} páginas
                      </p>
                    }
                  </div>
                  <div class="editorial-field">
                    <label for="draft-key">Gabarito definitivo verificado</label
                    ><select
                      id="draft-key"
                      name="keySourceId"
                      [(ngModel)]="draft.provenance!.keySourceId"
                      required
                      [disabled]="!exam()"
                    >
                      <option value="">
                        Selecione o gabarito da mesma edição
                      </option>
                      @for (source of compatibleKeys(); track source.id) {
                        <option [value]="source.id">{{ source.title }}</option>
                      }
                    </select>
                    @if (keySource()) {
                      <p class="account-help">
                        <a
                          [href]="keySource()!.officialUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          >Conferir gabarito definitivo</a
                        >
                        · {{ keySource()!.pageCount }} páginas
                      </p>
                    }
                  </div>
                  <div class="provenance-page-fields">
                    <div class="editorial-field">
                      <label for="draft-page">Página da questão</label
                      ><input
                        id="draft-page"
                        name="page"
                        type="number"
                        [(ngModel)]="draft.provenance!.page"
                        required
                        min="1"
                        [max]="exam()?.pageCount || 1"
                        step="1"
                      />
                    </div>
                    <div class="editorial-field">
                      <label for="draft-question-number">Número na prova</label
                      ><input
                        id="draft-question-number"
                        name="questionNumber"
                        type="number"
                        [(ngModel)]="draft.provenance!.questionNumber"
                        [readonly]="!!detail()"
                        required
                        min="1"
                        max="1000"
                        step="1"
                      />
                    </div>
                    <div class="editorial-field">
                      <label for="draft-key-page">Página do gabarito</label
                      ><input
                        id="draft-key-page"
                        name="keyPage"
                        type="number"
                        [(ngModel)]="draft.provenance!.keyPage"
                        required
                        min="1"
                        [max]="keySource()?.pageCount || 1"
                        step="1"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    class="text-button"
                    (click)="loadSources()"
                    [disabled]="sourceLoading()"
                  >
                    Atualizar fontes verificadas
                  </button>
                </fieldset>
              }
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
                @if (draft.origin === "AUTHOR_CREATED") {
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
                } @else {
                  <p class="account-help">
                    Fonte da questão: Inep. A explicação abaixo é um comentário
                    editorial, com crédito próprio.
                  </p>
                }
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
              @if (draft.origin === "OFFICIAL") {
                <div class="editorial-field">
                  <label for="draft-explanation-credit"
                    >Crédito da explicação editorial</label
                  ><input
                    id="draft-explanation-credit"
                    name="explanationCredit"
                    [(ngModel)]="draft.explanationCredit"
                    required
                    maxlength="160"
                  />
                  <p class="account-help">
                    Identifique quem escreveu o comentário. A explicação não é
                    uma correção oficial do Inep.
                  </p>
                </div>
              }
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
            <p class="metadata">
              {{ detail()!.topic }} ·
              {{ detail()!.origin === "OFFICIAL" ? "Oficial" : "Autoral" }}
            </p>
            @if (detail()!.provenance) {
              <section class="question-provenance">
                <h2>Procedência</h2>
                <p>
                  {{ exam()?.title || "Prova oficial" }} · questão
                  {{ detail()!.provenance!.questionNumber }}, página
                  {{ detail()!.provenance!.page }}
                </p>
                <p>
                  {{ keySource()?.title || "Gabarito definitivo" }} · página
                  {{ detail()!.provenance!.keyPage }}
                </p>
                @if (exam()) {
                  <a
                    [href]="exam()!.officialUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    >Conferir prova oficial</a
                  >
                }
                @if (keySource()) {
                  <a
                    [href]="keySource()!.officialUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    >Conferir gabarito definitivo</a
                  >
                }
              </section>
            }
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
            @if (detail()!.explanationCredit) {
              <p class="metadata">
                Comentário editorial: {{ detail()!.explanationCredit }}
              </p>
            }
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
                  @if (detail()!.origin === "OFFICIAL") {
                    <label class="editorial-check"
                      ><input
                        type="checkbox"
                        [(ngModel)]="checks.source"
                      />Conferi a questão e o gabarito nos documentos oficiais
                      indicados.</label
                    >
                  }
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
  sourceView = signal(false);
  importView = signal(false);
  sourceBusy = signal(false);
  sourceLoading = signal(false);
  sources = signal<OfficialSource[]>([]);
  detail = signal<EditorialDetail | null>(null);
  editing = signal(false);
  loading = signal(false);
  busy = signal(false);
  error = signal("");
  notice = signal("");
  confirmPublication = signal(false);
  draft = emptyDraft();
  reviewNote = "";
  checks = { content: false, answer: false, credit: false, source: false };
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
      this.checks.credit &&
      (this.detail()?.origin !== "OFFICIAL" || this.checks.source)
    );
  }
  showSources() {
    if (this.busy() || this.sourceBusy()) return;
    this.sequence++;
    this.loading.set(false);
    this.importView.set(false);
    this.sourceView.set(true);
  }
  showImports() {
    if (this.busy() || this.sourceBusy()) return;
    this.sequence++;
    this.loading.set(false);
    this.sourceView.set(false);
    this.importView.set(true);
  }
  showQuestions() {
    if (this.busy() || this.sourceBusy()) return;
    this.sourceView.set(false);
    this.importView.set(false);
    void this.loadQueue();
  }
  setSourceBusy(value: boolean) {
    this.sourceBusy.set(value);
    this.busyChange.emit(value);
  }
  verifiedExams() {
    return this.sources().filter(
      (source) => source.status === "VERIFIED" && source.kind === "EXAM",
    );
  }
  exam() {
    return this.sources().find(
      (source) => source.id === this.draft.provenance?.examSourceId,
    );
  }
  keySource() {
    return this.sources().find(
      (source) => source.id === this.draft.provenance?.keySourceId,
    );
  }
  compatibleKeys() {
    const exam = this.exam();
    return this.sources().filter(
      (source) =>
        source.status === "VERIFIED" &&
        source.kind === "ANSWER_KEY" &&
        source.isFinal &&
        !!exam &&
        source.year === exam.year &&
        source.area === exam.area &&
        source.modality === exam.modality,
    );
  }
  examChanged() {
    if (this.draft.provenance) {
      this.draft.provenance.keySourceId = "";
      this.draft.provenance.page = 1;
      this.draft.provenance.keyPage = 1;
    }
  }
  async loadSources() {
    if (this.sourceLoading()) return;
    this.sourceLoading.set(true);
    try {
      const sources = await this.api<OfficialSource[]>("sources");
      if (this.active) this.sources.set(sources);
    } catch (err) {
      if (this.active) this.error.set(this.message(err));
    } finally {
      if (this.active) this.sourceLoading.set(false);
    }
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
  newDraft(origin: "AUTHOR_CREATED" | "OFFICIAL" = "AUTHOR_CREATED") {
    if (this.busy() || this.sourceBusy()) return;
    this.sequence++;
    this.loading.set(false);
    this.detail.set(null);
    this.draft = emptyDraft(origin);
    this.savedDraft = "";
    this.error.set("");
    this.notice.set("");
    this.editing.set(true);
    if (origin === "OFFICIAL") void this.loadSources();
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
    if (
      this.draft.origin === "OFFICIAL" &&
      (!this.draft.explanationCredit.trim() ||
        !this.draft.provenance?.examSourceId ||
        !this.draft.provenance.keySourceId ||
        ![
          this.draft.provenance.page,
          this.draft.provenance.keyPage,
          this.draft.provenance.questionNumber,
        ].every((value) => Number.isInteger(value) && value > 0))
    ) {
      this.error.set(
        "Informe as fontes verificadas, páginas, número da questão e crédito da explicação.",
      );
      return;
    }
    const current = this.detail();
    const copy = structuredClone(this.draft);
    const { explanationCredit, ...authored } = copy;
    const payload = copy.origin === "OFFICIAL" ? copy : authored;
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
      origin: detail.origin,
      explanationCredit: detail.explanationCredit || "",
      provenance: detail.provenance ? { ...detail.provenance } : null,
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
    this.checks = {
      content: false,
      answer: false,
      credit: false,
      source: false,
    };
    this.confirmPublication.set(false);
    if (detail.origin === "OFFICIAL") void this.loadSources();
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
