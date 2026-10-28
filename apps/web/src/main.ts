import { ApplicationRef, Component, inject, signal } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";
import { CurationComponent } from "./curation.component";
import { HomeComponent } from "./home.component";
import {
  ReviewComponent,
  type ReviewItem,
  type ReviewPosition,
} from "./review.component";
import {
  AccountComponent,
  type AccountMode,
  type Credentials,
  type SessionStatus,
} from "./account.component";
type Summary = {
  id: string;
  title: string;
  topic: string;
  origin: string;
  answered: boolean;
  demonstration: boolean;
  versionNumber: number;
};
type PublicDocument = {
  id: string;
  title: string;
  officialUrl: string;
  sha256: string;
  year: number;
  area: string;
  modality: string;
  pageCount: number;
};
type Answer = {
  optionId: string;
  revision: number;
  correct: boolean;
  correctOptionId: string;
  explanation: string;
  explanationCredit?: string;
  answerKey?: {
    id: string;
    title: string;
    officialUrl: string;
    sha256: string;
    page: number;
  };
};
type Question = Summary & {
  authorCredit: string;
  prompt: string;
  options: { id: string; text: string }[];
  answer: Answer | null;
  provenance: {
    exam: PublicDocument;
    page: number;
    questionNumber: number;
  } | null;
};

@Component({
  selector: "app-root",
  imports: [
    FormsModule,
    AccountComponent,
    CurationComponent,
    HomeComponent,
    ReviewComponent,
  ],
  template: `
    <a class="skip" href="#content">Ir para o conteúdo</a>
    <header>
      <a
        href="/"
        class="brand"
        aria-label="Caderno de Computação, início"
        (click)="openHome($event)"
        ><span class="brand-symbol" aria-hidden="true">cc.</span
        ><span
          >Caderno<span class="brand-sub">CIÊNCIA DA COMPUTAÇÃO</span></span
        ></a
      >
      <div class="header-actions">
        <span class="environment">Base de desenvolvimento</span>
        @if (!booting() && !bootError()) {
          @if (canCurate()) {
            <button
              class="text-button mobile-curation"
              (click)="openCuration()"
              [disabled]="saving() || authBusy() || curationBusy()"
            >
              Curadoria
            </button>
          }
          @if (session().mode === "account") {
            <span class="account-email" aria-label="Conta conectada">{{
              accountEmail()
            }}</span>
            <button
              class="text-button"
              (click)="logout()"
              [disabled]="saving() || authBusy() || curationBusy()"
            >
              Sair da conta
            </button>
          } @else {
            <button
              class="text-button"
              (click)="openAccount('login')"
              [disabled]="saving() || authBusy() || curationBusy()"
            >
              Entrar
            </button>
            <button
              class="outline"
              (click)="openAccount('register')"
              [disabled]="saving() || authBusy() || curationBusy()"
            >
              Criar conta
            </button>
          }
        }
      </div>
    </header>
    @if (!booting() && !bootError()) {
      <nav class="mobile-study-nav" aria-label="Navegação de estudo">
        <button
          class="text-button"
          (click)="openHome()"
          [disabled]="saving() || authBusy() || curationBusy()"
          [attr.aria-current]="onHome() ? 'page' : null"
        >
          Início
        </button>
        <button
          class="text-button"
          (click)="back()"
          [disabled]="saving() || authBusy() || curationBusy()"
        >
          Banco de questões
        </button>
        <button
          class="text-button"
          (click)="openReview()"
          [disabled]="saving() || authBusy() || curationBusy()"
          [attr.aria-current]="reviewView() || reviewReturn() ? 'page' : null"
        >
          Caderno de erros
        </button>
      </nav>
    }
    <div class="layout">
      <aside aria-label="Sobre este caderno">
        <button
          class="nav"
          (click)="openHome()"
          [disabled]="saving() || authBusy() || curationBusy()"
          [attr.aria-current]="onHome() ? 'page' : null"
        >
          <span class="nav-index" aria-hidden="true">01</span>
          Início
        </button>
        <button
          class="nav secondary-nav"
          (click)="back()"
          [disabled]="saving() || authBusy() || curationBusy()"
          [attr.aria-current]="
            !homeView() &&
            !curationView() &&
            !reviewView() &&
            !reviewReturn() &&
            !accountView()
              ? 'page'
              : null
          "
        >
          <span class="nav-index" aria-hidden="true">02</span>
          Banco de questões
        </button>
        <button
          class="nav secondary-nav"
          (click)="openReview()"
          [disabled]="saving() || authBusy() || curationBusy()"
          [attr.aria-current]="reviewView() || reviewReturn() ? 'page' : null"
        >
          <span class="nav-index" aria-hidden="true">03</span>
          Caderno de erros
        </button>
        @if (canCurate()) {
          <button
            class="nav secondary-nav"
            (click)="openCuration()"
            [disabled]="saving() || authBusy() || curationBusy()"
            [attr.aria-current]="curationView() ? 'page' : null"
          >
            <span class="nav-index" aria-hidden="true">04</span>
            Curadoria
          </button>
        }
        <div class="sidebar-note">
          <p class="muted">
            O catálogo identifica a origem de cada questão. Conteúdo oficial
            informa a prova e a edição; as questões iniciais autorais são
            demonstrações.
          </p>
        </div>
      </aside>
      <main id="content" tabindex="-1">
        <div class="breadcrumb">
          Estudar <span>/</span>
          {{
            accountView()
              ? "Conta"
              : curationView()
                ? "Curadoria"
                : reviewView()
                  ? "Caderno de erros"
                  : homeView()
                    ? "Início"
                    : question()
                      ? "Resolução"
                      : "Banco de questões"
          }}
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
          @if (accountNotice()) {
            <p class="account-success" role="status">{{ accountNotice() }}</p>
          }
          @if (accountView()) {
            <app-account
              [mode]="accountView()!"
              [busy]="authBusy()"
              [error]="authError()"
              (modeChange)="changeAccountMode($event)"
              (submitCredentials)="authenticate($event)"
              (cancel)="closeAccount()"
            />
          } @else if (authBusy()) {
            <p role="status">Atualizando sua sessão…</p>
          } @else if (curationView()) {
            <app-curation (busyChange)="curationBusy.set($event)" />
          } @else if (reviewView()) {
            <app-review
              [position]="reviewPosition"
              [opening]="loading()"
              (positionChange)="reviewPosition = $event"
              (resolve)="openReviewQuestion($event)"
              (browse)="back()"
            />
            @if (error()) {
              <p class="notice" role="alert">{{ error() }}</p>
            }
          } @else if (homeView()) {
            <app-home
              [sessionMode]="session().mode"
              (browse)="back()"
              (review)="openReview()"
              (register)="openAccount('register')"
              (openQuestion)="open($event)"
            />
            @if (error()) {
              <p class="notice" role="alert">{{ error() }}</p>
            }
          } @else if (!question()) {
            <section class="page-intro catalog-intro">
              <div>
                <h1>Banco de questões</h1>
                <p>
                  Escolha um assunto. Entenda o raciocínio.<br
                    class="desktop"
                  />
                  Continue a construir sua base.
                </p>
              </div>
              @if (rows().length) {
                <p class="catalog-progress">
                  <strong>{{ answeredCount() }}</strong>
                  <span
                    >de {{ rows().length }}
                    {{ rows().length === 1 ? "questão" : "questões" }}
                    desta seleção com resposta salva</span
                  >
                </p>
              }
            </section>
            <p class="source-note">
              <strong>Origem do conteúdo.</strong> Questões oficiais indicam
              prova e edição. As questões iniciais autorais são demonstrações.
            </p>
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
                  @for (
                    availableTopic of catalogTopics();
                    track availableTopic
                  ) {
                    <option [value]="availableTopic">
                      {{ availableTopic }}
                    </option>
                  }
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
              <h2>Questões</h2>
              <span
                >{{ rows().length }}
                {{ rows().length === 1 ? "questão" : "questões" }} nesta
                seleção</span
              >
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
                  <li [class.is-answered]="row.answered">
                    <span class="question-number" aria-hidden="true">{{
                      (i + 1).toString().padStart(2, "0")
                    }}</span>
                    <div class="question-summary">
                      <p class="metadata">
                        {{ row.topic }} <span>·</span>
                        {{ originLabel(row.origin, row.demonstration) }}
                      </p>
                      <h3>{{ row.title }}</h3>
                      <p class="state">
                        @if (row.answered) {
                          <svg
                            class="status-icon"
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                          >
                            <circle
                              cx="8"
                              cy="8"
                              r="6.25"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.5"
                            />
                            <path
                              d="M5.2 8.3l1.9 1.9 3.7-4.2"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                          Resposta salva · você pode revisar
                        } @else {
                          <svg
                            class="status-icon"
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                          >
                            <circle
                              cx="8"
                              cy="8"
                              r="6.25"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.5"
                              stroke-dasharray="2.5 2.2"
                            />
                          </svg>
                          Disponível para praticar
                        }
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
              @if (session().mode === "account") {
                Seu histórico está salvo na sua conta. Entre com o mesmo e-mail
                e senha para retomá-lo em outro navegador.
              } @else {
                Seu histórico fica associado à sessão deste navegador por até 30
                dias.
                <button
                  type="button"
                  class="text-button"
                  (click)="openAccount('register')"
                >
                  Guardar meu histórico em uma conta
                </button>
              }
            </footer>
          } @else {
            <div class="resolution-bar">
              <button
                class="back text-button"
                (click)="reviewReturn() ? openReview() : back()"
                [disabled]="saving() || authBusy()"
              >
                {{
                  reviewReturn()
                    ? "← Voltar ao caderno de erros"
                    : "← Voltar ao banco"
                }}
              </button>
              @if (position(); as at) {
                <p class="resolution-position">
                  Questão {{ at.index + 1 }} de {{ at.total }} nesta seleção
                </p>
              }
            </div>
            @if (reviewReturn()) {
              <p class="review-context">
                {{
                  question()!.answer && !editing()
                    ? "Resposta confirmada. Volte ao caderno para conferir as questões a retomar."
                    : "Resolva novamente. A resposta anterior só será substituída após confirmar."
                }}
              </p>
              @if (
                reviewCurrentVersion() &&
                reviewCurrentVersion() !== question()!.id
              ) {
                <p class="review-version">
                  Existe uma versão publicada mais recente. O resultado desta
                  resolução usa o gabarito da versão
                  {{ question()!.versionNumber }}.
                </p>
              }
            }
            <article class="resolution">
              <p class="metadata">
                {{ question()!.topic }} <span>·</span>
                {{ originLabel(question()!.origin, question()!.demonstration) }}
                <span>·</span> Versão {{ question()!.versionNumber }}
              </p>
              <p class="metadata question-credit">
                {{ question()!.origin === "OFFICIAL" ? "Fonte" : "Autoria" }}:
                {{ question()!.authorCredit }}
              </p>
              <h1>{{ question()!.title }}</h1>
              @if (question()!.provenance) {
                <section
                  class="question-provenance"
                  aria-label="Fonte da questão"
                >
                  <p>
                    Edição {{ question()!.provenance!.exam.year }} ·
                    {{ question()!.provenance!.exam.area }} ·
                    {{ modalityLabel(question()!.provenance!.exam.modality) }}
                  </p>
                  <p>
                    Questão {{ question()!.provenance!.questionNumber }} ·
                    página {{ question()!.provenance!.page }}
                  </p>
                  <a
                    [href]="question()!.provenance!.exam.officialUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    >Prova oficial: {{ question()!.provenance!.exam.title }}</a
                  >
                </section>
              }
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
                    <div
                      class="option-row"
                      [class.is-correct]="
                        optionOutcome(option.id) === 'correct'
                      "
                      [class.is-wrong]="optionOutcome(option.id) === 'wrong'"
                    >
                      <label
                        class="option"
                        [class.selected]="selected === option.id"
                        ><input
                          type="radio"
                          name="answer"
                          [value]="option.id"
                          [(ngModel)]="selected"
                          [attr.aria-describedby]="
                            optionOutcome(option.id)
                              ? 'outcome-' + option.id
                              : null
                          "
                        /><span class="letter" aria-hidden="true">{{
                          "ABCDE"[i]
                        }}</span
                        ><span>{{ option.text }}</span></label
                      >
                      @if (optionOutcome(option.id); as outcome) {
                        <span class="option-tag" [id]="'outcome-' + option.id">
                          @if (outcome === "correct") {
                            <svg
                              class="status-icon"
                              viewBox="0 0 16 16"
                              aria-hidden="true"
                            >
                              <path
                                d="M3.5 8.5l3 3 6-7"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                            Alternativa correta
                          } @else {
                            <svg
                              class="status-icon"
                              viewBox="0 0 16 16"
                              aria-hidden="true"
                            >
                              <path
                                d="M4.5 4.5l7 7m0-7l-7 7"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                              />
                            </svg>
                            Sua resposta
                          }
                        </span>
                      }
                    </div>
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
                  [class.is-correct]="question()!.answer!.correct"
                  [class.is-wrong]="!question()!.answer!.correct"
                  aria-label="Resultado da resposta"
                  role="status"
                >
                  <p class="feedback-result">
                    @if (question()!.answer!.correct) {
                      <svg
                        class="status-icon"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                      >
                        <path
                          d="M3.5 8.5l3 3 6-7"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                      Resposta correta
                    } @else {
                      <svg
                        class="status-icon"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                      >
                        <path
                          d="M4.5 4.5l7 7m0-7l-7 7"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linecap="round"
                        />
                      </svg>
                      Resposta incorreta
                    }
                  </p>
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
                  <p class="feedback-explanation">
                    {{ question()!.answer!.explanation }}
                  </p>
                  @if (question()!.answer!.explanationCredit) {
                    <p class="metadata">
                      Explicação editorial:
                      {{ question()!.answer!.explanationCredit }}
                    </p>
                  }
                  @if (question()!.answer!.answerKey) {
                    <p class="answer-key-source">
                      <a
                        [href]="question()!.answer!.answerKey!.officialUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        >Gabarito definitivo:
                        {{ question()!.answer!.answerKey!.title }}</a
                      >
                      · página {{ question()!.answer!.answerKey!.page }}
                    </p>
                  }
                  <div class="feedback-actions">
                    @if (nextQuestion(); as next) {
                      <button
                        (click)="open(next.id)"
                        [disabled]="loading()"
                        [attr.aria-label]="'Próxima questão: ' + next.title"
                      >
                        Próxima questão <span aria-hidden="true">→</span>
                      </button>
                    }
                    <button class="text-button" (click)="editing.set(true)">
                      Alterar resposta
                    </button>
                  </div>
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
  catalogTopics = signal<string[]>([]);
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
  session = signal<SessionStatus>({ mode: "guest" });
  accountView = signal<AccountMode | null>(null);
  authBusy = signal(false);
  authError = signal("");
  accountNotice = signal("");
  canCurate = signal(false);
  curationView = signal(false);
  curationBusy = signal(false);
  reviewView = signal(false);
  // A página inicial fica em "/" e o banco de questões em "/questoes".
  homeView = signal(location.pathname === "/");
  reviewReturn = signal(false);
  reviewCurrentVersion = signal<string | null>(null);
  reviewPosition: ReviewPosition = { topic: "", offset: 0 };
  private appRef = inject(ApplicationRef);
  private identityGeneration = 0;
  private identityTransition = 0;
  private requestNumber = 0;
  private identityChannel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel("enade-identity");
  constructor() {
    if (this.identityChannel) {
      this.identityChannel.onmessage = (event) => {
        if (event.data?.type === "identity-changed")
          void this.refreshIdentity(true);
      };
    }
    void this.boot();
  }
  ngOnDestroy() {
    this.identityChannel?.close();
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
    await this.refreshIdentity(false);
  }
  private async refreshIdentity(fromOtherTab: boolean) {
    const transition = ++this.identityTransition;
    this.clearStudyState();
    this.booting.set(true);
    this.authBusy.set(true);
    this.bootError.set("");
    this.authError.set("");
    this.accountView.set(null);
    this.accountNotice.set("");
    try {
      const session = await this.api<SessionStatus>("session", {
        method: "POST",
      });
      if (transition !== this.identityTransition) return;
      this.session.set(session);
      await this.loadCurationAccess(transition);
      if (transition !== this.identityTransition) return;
      await this.loadCatalog(true);
      if (fromOtherTab && transition === this.identityTransition)
        this.accountNotice.set("Sua sessão foi atualizada em outra aba.");
    } catch (err) {
      if (transition === this.identityTransition)
        this.bootError.set(this.message(err));
    } finally {
      if (transition === this.identityTransition) {
        this.booting.set(false);
        this.authBusy.set(false);
      }
    }
  }
  private async loadCurationAccess(transition: number) {
    if (this.session().mode !== "account") {
      this.canCurate.set(false);
      return;
    }
    try {
      const access = await this.api<{ canCurate: boolean }>("curation/access");
      if (transition === this.identityTransition)
        this.canCurate.set(access.canCurate);
    } catch {
      if (transition === this.identityTransition) this.canCurate.set(false);
    }
  }
  openCuration() {
    if (
      !this.canCurate() ||
      this.saving() ||
      this.authBusy() ||
      this.curationBusy()
    )
      return;
    this.requestNumber++;
    this.homeView.set(false);
    this.reviewView.set(false);
    this.reviewReturn.set(false);
    this.loading.set(false);
    this.question.set(null);
    this.accountView.set(null);
    this.accountNotice.set("");
    this.error.set("");
    this.curationView.set(true);
    this.leaveHomePath();
    this.focusMain();
  }
  openHome(event?: Event) {
    event?.preventDefault();
    if (this.saving() || this.authBusy() || this.curationBusy()) return;
    this.requestNumber++;
    this.swapView(() => {
      this.loading.set(false);
      this.question.set(null);
      this.accountView.set(null);
      this.curationView.set(false);
      this.reviewView.set(false);
      this.reviewReturn.set(false);
      this.reviewCurrentVersion.set(null);
      this.authError.set("");
      this.accountNotice.set("");
      this.error.set("");
      this.homeView.set(true);
    });
    this.setPath("/");
    this.focusMain();
  }
  onHome() {
    return this.homeView() && !this.accountView();
  }
  openReview() {
    if (this.saving() || this.authBusy() || this.curationBusy()) return;
    this.requestNumber++;
    this.swapView(() => {
      this.loading.set(false);
      this.question.set(null);
      this.accountView.set(null);
      this.curationView.set(false);
      this.homeView.set(false);
      this.reviewReturn.set(false);
      this.reviewCurrentVersion.set(null);
      this.accountNotice.set("");
      this.error.set("");
      this.reviewView.set(true);
    });
    this.leaveHomePath();
    this.focusMain();
  }
  async openReviewQuestion(item: ReviewItem) {
    if (this.loading() || this.authBusy()) return;
    this.reviewReturn.set(true);
    this.reviewCurrentVersion.set(item.currentVersionId);
    await this.open(item.id, true);
  }
  async loadCatalog(duringTransition = false) {
    if (this.authBusy() && !duringTransition) return;
    const request = ++this.requestNumber;
    this.loading.set(true);
    this.error.set("");
    try {
      const rows = await this.api<Summary[]>(
        "questions?" +
          new URLSearchParams({ q: this.search, topic: this.topic }),
      );
      if (request === this.requestNumber) {
        this.rows.set(rows);
        this.catalogTopics.update((previous) =>
          [...new Set([...previous, ...rows.map((row) => row.topic)])].sort(
            (a, b) => a.localeCompare(b, "pt-BR"),
          ),
        );
      }
    } catch (err) {
      if (request === this.requestNumber) this.error.set(this.message(err));
    } finally {
      if (request === this.requestNumber) this.loading.set(false);
    }
  }
  async open(id: string, retry = false) {
    if (this.authBusy()) return;
    const request = ++this.requestNumber;
    this.loading.set(true);
    this.error.set("");
    try {
      const q = await this.api<Question>("questions/" + encodeURIComponent(id));
      if (request !== this.requestNumber) return;
      this.swapView(
        () => {
          this.reviewView.set(false);
          this.homeView.set(false);
          this.question.set(q);
          this.selected = retry ? "" : q.answer?.optionId || "";
          this.editing.set(retry);
        },
        () => request === this.requestNumber,
      );
      this.leaveHomePath();
      this.focusMain();
    } catch (err) {
      if (request === this.requestNumber) this.error.set(this.message(err));
    } finally {
      if (request === this.requestNumber) this.loading.set(false);
    }
  }
  async save() {
    const q = this.question();
    if (!q || !this.selected || this.saving() || this.authBusy()) return;
    const identity = this.identityGeneration;
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
      if (
        identity === this.identityGeneration &&
        this.question()?.id === q.id
      ) {
        this.question.set({ ...q, answer });
        this.editing.set(false);
      }
    } catch (err) {
      if (identity === this.identityGeneration)
        this.error.set(this.message(err));
    } finally {
      if (identity === this.identityGeneration) this.saving.set(false);
    }
  }
  back() {
    if (this.saving() || this.authBusy() || this.curationBusy()) return;
    this.swapView(() => {
      this.homeView.set(false);
      this.curationView.set(false);
      this.reviewView.set(false);
      this.reviewReturn.set(false);
      this.reviewCurrentVersion.set(null);
      this.accountView.set(null);
      this.authError.set("");
      this.accountNotice.set("");
      this.question.set(null);
      this.error.set("");
    });
    this.setPath("/questoes");
    void this.loadCatalog();
    this.focusMain();
  }
  // Só o início e o banco têm endereço próprio. As demais telas usam o do
  // banco, para que recarregar fora do início não volte à página inicial.
  private setPath(path: string) {
    if (location.pathname !== path) history.replaceState(null, "", path);
  }
  private leaveHomePath() {
    if (location.pathname === "/") this.setPath("/questoes");
  }
  clearFilters() {
    if (this.authBusy()) return;
    this.search = "";
    this.topic = "";
    void this.loadCatalog();
  }
  accountEmail() {
    const session = this.session();
    return session.mode === "account" ? session.email : "";
  }
  openAccount(mode: AccountMode) {
    if (this.saving() || this.authBusy() || this.session().mode === "account")
      return;
    this.accountView.set(mode);
    this.authError.set("");
    this.accountNotice.set("");
    this.focusMain();
  }
  changeAccountMode(mode: AccountMode) {
    if (this.authBusy()) return;
    this.accountView.set(mode);
    this.authError.set("");
    this.focusMain();
  }
  closeAccount() {
    if (this.authBusy()) return;
    this.accountView.set(null);
    this.authError.set("");
    if (!this.question() && !this.reviewView()) void this.loadCatalog();
    this.focusMain();
  }
  private clearStudyState() {
    this.reviewView.set(false);
    this.reviewReturn.set(false);
    this.reviewCurrentVersion.set(null);
    this.reviewPosition = { topic: "", offset: 0 };
    this.curationView.set(false);
    this.canCurate.set(false);
    this.curationBusy.set(false);
    this.identityGeneration++;
    this.requestNumber++;
    this.rows.set([]);
    this.catalogTopics.set([]);
    this.question.set(null);
    this.selected = "";
    this.search = "";
    this.topic = "";
    this.error.set("");
    this.editing.set(false);
    this.loading.set(false);
    this.saving.set(false);
  }
  async authenticate(credentials: Credentials) {
    const mode = this.accountView();
    if (!mode || this.authBusy() || this.saving()) return;
    const transition = ++this.identityTransition;
    this.authBusy.set(true);
    this.authError.set("");
    this.accountNotice.set("");
    this.clearStudyState();
    try {
      const session = await this.api<SessionStatus>(`auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      this.identityChannel?.postMessage({ type: "identity-changed" });
      if (transition !== this.identityTransition) {
        await this.refreshIdentity(false);
        return;
      }
      this.clearStudyState();
      this.session.set(session);
      await this.loadCurationAccess(transition);
      if (transition !== this.identityTransition) return;
      this.accountView.set(null);
      this.accountNotice.set(
        mode === "register"
          ? "Conta criada. Suas respostas confirmadas foram mantidas."
          : "Você entrou na sua conta. Seu histórico está disponível.",
      );
      await this.loadCatalog(true);
      this.focusMain();
    } catch (err) {
      if (transition !== this.identityTransition) {
        await this.refreshIdentity(false);
        return;
      }
      this.authError.set(this.message(err));
      // A lost response may have applied its cookie. Reconcile before showing study data.
      await this.reconcileSession(transition);
    } finally {
      credentials.password = "";
      if (transition === this.identityTransition) this.authBusy.set(false);
    }
  }
  async logout() {
    if (this.authBusy() || this.saving() || this.curationBusy()) return;
    const transition = ++this.identityTransition;
    this.authBusy.set(true);
    this.authError.set("");
    this.accountNotice.set("");
    this.clearStudyState();
    try {
      const session = await this.api<SessionStatus>("auth/logout", {
        method: "POST",
      });
      this.identityChannel?.postMessage({ type: "identity-changed" });
      if (transition !== this.identityTransition) {
        await this.refreshIdentity(false);
        return;
      }
      this.clearStudyState();
      this.session.set(session);
      await this.loadCurationAccess(transition);
      if (transition !== this.identityTransition) return;
      this.accountView.set(null);
      this.accountNotice.set(
        "Você saiu da conta. Seu histórico continua guardado para o próximo acesso.",
      );
      await this.loadCatalog(true);
      this.focusMain();
    } catch (err) {
      if (transition !== this.identityTransition) {
        await this.refreshIdentity(false);
        return;
      }
      const message = this.message(err);
      await this.reconcileSession(transition);
      if (transition === this.identityTransition && !this.bootError()) {
        if (this.session().mode === "account") this.error.set(message);
        else
          this.accountNotice.set(
            "Você saiu da conta. Seu histórico continua guardado para o próximo acesso.",
          );
      }
    } finally {
      if (transition === this.identityTransition) this.authBusy.set(false);
    }
  }
  private async reconcileSession(transition: number) {
    const previous = this.session();
    try {
      const session = await this.api<SessionStatus>("session", {
        method: "POST",
      });
      if (transition !== this.identityTransition) return;
      this.session.set(session);
      await this.loadCurationAccess(transition);
      if (transition !== this.identityTransition) return;
      if (
        previous.mode !== session.mode ||
        (previous.mode === "account" &&
          session.mode === "account" &&
          previous.email !== session.email)
      ) {
        // Only an auth operation's reconciliation can broadcast a newly discovered change.
        // refreshIdentity never rebroadcasts, so receiving tabs cannot form a loop.
        this.identityChannel?.postMessage({ type: "identity-changed" });
      }
      if (session.mode === "account") {
        this.accountView.set(null);
        this.authError.set("");
      }
      if (!this.accountView()) await this.loadCatalog(true);
    } catch {
      if (transition !== this.identityTransition) return;
      this.session.set({ mode: "guest" });
      this.bootError.set(
        "Não foi possível confirmar sua sessão. Tente abrir o caderno novamente.",
      );
    }
  }
  originLabel(origin: string, demonstration = false) {
    return origin === "OFFICIAL"
      ? "Oficial · Inep"
      : demonstration
        ? "Autoral demonstrativa"
        : "Autoral";
  }
  modalityLabel(modality: string) {
    return (
      (
        {
          BACHARELADO: "Bacharelado",
          LICENCIATURA: "Licenciatura",
          CST: "Curso superior de tecnologia",
          COMUM: "Caderno compartilhado",
        } as Record<string, string>
      )[modality] || modality
    );
  }
  correctText() {
    const q = this.question();
    return (
      q?.options.find((o) => o.id === q.answer?.correctOptionId)?.text || ""
    );
  }
  answeredCount() {
    return this.rows().filter((row) => row.answered).length;
  }
  // Posição só faz sentido quando a questão veio do catálogo atual.
  position() {
    const q = this.question();
    if (!q || this.reviewReturn()) return null;
    const index = this.rows().findIndex((row) => row.id === q.id);
    return index < 0 ? null : { index, total: this.rows().length };
  }
  nextQuestion() {
    const at = this.position();
    return at ? (this.rows()[at.index + 1] ?? null) : null;
  }
  optionOutcome(optionId: string): "correct" | "wrong" | null {
    const answer = this.question()?.answer;
    if (!answer || this.editing()) return null;
    if (optionId === answer.correctOptionId) return "correct";
    return optionId === answer.optionId ? "wrong" : null;
  }
  private message(err: unknown) {
    return err instanceof Error
      ? err.message
      : "Falha de conexão. Tente novamente.";
  }
  // Troca de tela com View Transition quando disponível. O estado muda dentro
  // do callback e é renderizado na hora, para o navegador capturar o "depois".
  // O callback roda um quadro depois: se a identidade ou a requisição mudaram
  // nesse intervalo, o estado antigo não é aplicado.
  private swapView(update: () => void, stillCurrent = () => true) {
    const generation = this.identityGeneration;
    const apply = () => {
      if (generation === this.identityGeneration && stillCurrent()) update();
    };
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => unknown;
    };
    if (
      !doc.startViewTransition ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      apply();
      return;
    }
    doc.startViewTransition(() => {
      apply();
      this.appRef.tick();
    });
  }
  private focusMain() {
    setTimeout(() => document.getElementById("content")?.focus(), 0);
  }
}
bootstrapApplication(App).catch(console.error);
