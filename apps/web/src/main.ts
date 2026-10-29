import { ApplicationRef, Component, HostListener, inject, signal } from "@angular/core";
import { IMAGE_CONFIG } from "@angular/common";
import { bootstrapApplication } from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";
import { CurationComponent } from "./curation.component";
import { HomeComponent } from "./home.component";
import { QuestionContentComponent } from "./question-content.component";
import { ExamComponent } from "./exam.component";
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
  area?: string | null;
  year?: number | null;
  modality?: string | null;
  questionNumber?: number | null;
};
type CatalogFilters = { q: string; topic: string; area: string; year: string };
type Catalog = {
  items: Summary[];
  total: number;
  answeredTotal: number;
  offset: number;
  limit: number;
  facets: {
    areas: { name: string; count: number }[];
    unclassified: number;
    topics: string[];
    years: number[];
  };
};
const CATALOG_PAGE_SIZE = 20;
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
    // D10: só o gabarito publicado, sem se declarar definitivo.
    finality?: "DECLARED" | "ONLY_PUBLISHED" | null;
  };
};
type QuestionImage = { url: string; width: number; height: number; page: number };
type Question = Summary & {
  authorCredit: string;
  prompt: string;
  options: { id: string; text: string }[];
  answer: Answer | null;
  // IMAGE: o recorte da prova é a questão; o texto é transcrição de apoio.
  presentation?: "TEXT" | "IMAGE";
  images?: QuestionImage[];
  reviewOrigin?: "HUMAN" | "ASSISTED";
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
    QuestionContentComponent,
    ExamComponent,
    ReviewComponent,
  ],
  template: `
    <a class="skip" href="#content" (click)="skipToContent($event)">Ir para o conteúdo</a>
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
              [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
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
              [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
            >
              Sair da conta
            </button>
          } @else {
            <button
              class="text-button"
              (click)="openAccount('login')"
              [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
            >
              Entrar
            </button>
            <button
              class="outline"
              (click)="openAccount('register')"
              [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
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
          [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
          [attr.aria-current]="onHome() ? 'page' : null"
        >
          Início
        </button>
        <button
          class="text-button"
          (click)="back()"
          [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
        >
          Banco de questões
        </button>
        <button
          class="text-button"
          (click)="openReview()"
          [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
          [attr.aria-current]="reviewView() || reviewReturn() ? 'page' : null"
        >
          Caderno de erros
        </button>
        <button
          class="text-button"
          (click)="openPractice()"
          [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
          [attr.aria-current]="practiceView() && !accountView() ? 'page' : null"
        >Treino parcial</button>
      </nav>
    }
    <div class="layout">
      <aside aria-label="Sobre este caderno">
        <button
          class="nav"
          (click)="openHome()"
          [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
          [attr.aria-current]="onHome() ? 'page' : null"
        >
          <span class="nav-index" aria-hidden="true">01</span>
          Início
        </button>
        <button
          class="nav secondary-nav"
          (click)="back()"
          [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
          [attr.aria-current]="
            !homeView() &&
            !practiceView() &&
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
          [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
          [attr.aria-current]="reviewView() || reviewReturn() ? 'page' : null"
        >
          <span class="nav-index" aria-hidden="true">03</span>
          Caderno de erros
        </button>
        <button
          class="nav secondary-nav"
          (click)="openPractice()"
          [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
          [attr.aria-current]="practiceView() && !accountView() ? 'page' : null"
        ><span class="nav-index" aria-hidden="true">04</span>Treino parcial</button>
        @if (canCurate()) {
          <button
            class="nav secondary-nav"
            (click)="openCuration()"
            [disabled]="saving() || authBusy() || curationBusy() || practiceBusy()"
            [attr.aria-current]="curationView() ? 'page' : null"
          >
            <span class="nav-index" aria-hidden="true">05</span>
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
                : practiceView()
                  ? "Treino parcial"
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
          } @else if (practiceView()) {
            <app-exam
              [attemptId]="practiceAttemptId()"
              [itemPosition]="practiceItemPosition()"
              (locationChange)="practiceLocationChanged($event)"
              (busyChange)="practiceBusy.set($event)"
              (browse)="back()"
            />
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
              (retry)="openReviewQuestion($event)"
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
              @if (catalogTotal()) {
                <p class="catalog-progress">
                  <strong>{{ catalogAnswered() }}</strong>
                  <span
                    >de {{ catalogTotal() }}
                    {{ catalogTotal() === 1 ? "questão" : "questões" }}
                    desta seleção com resposta salva</span
                  >
                </p>
              }
            </section>
            <p class="source-note">
              <strong>Origem do conteúdo.</strong> Questões oficiais indicam
              prova e edição. As questões iniciais autorais são demonstrações.
            </p>
            <form class="filters catalog-filters" (ngSubmit)="loadCatalog()">
              <div>
                <label for="search">Buscar no caderno</label
                ><input
                  id="search"
                  type="search"
                  name="search"
                  [(ngModel)]="search"
                  maxlength="120"
                  placeholder="Título ou trecho do enunciado"
                />
              </div>
              <div>
                <label for="area">Área</label>
                <select id="area" name="area" [(ngModel)]="area">
                  <option value="">Todas as áreas</option>
                  @for (availableArea of catalogAreas(); track availableArea.name) {
                    <option [value]="availableArea.name" [disabled]="availableArea.count === 0 && area !== availableArea.name">
                      {{ availableArea.name }} ({{ availableArea.count }})
                    </option>
                  }
                  @if (area && area !== 'unclassified' && !hasCatalogArea(area)) {
                    <option [value]="area">{{ area }} (indisponível)</option>
                  }
                  @if (catalogUnclassified() || area === 'unclassified') {
                    <option value="unclassified">Sem área classificada ({{ catalogUnclassified() }})</option>
                  }
                </select>
              </div>
              <div>
                <label for="topic">Assunto</label
                ><select id="topic" name="topic" [(ngModel)]="topic">
                  <option value="">Todos os assuntos</option>
                  @if (topic && !catalogTopics().includes(topic)) {
                    <option [value]="topic">{{ topic }} (indisponível)</option>
                  }
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
              <div>
                <label for="year">Ano da prova</label>
                <select id="year" name="year" [(ngModel)]="year">
                  <option value="">Todos os anos</option>
                  @if (year && !hasCatalogYear(year)) {
                    <option [value]="year">{{ year }} (indisponível)</option>
                  }
                  @for (availableYear of catalogYears(); track availableYear) {
                    <option [value]="availableYear">{{ availableYear }}</option>
                  }
                </select>
              </div>
              <div class="catalog-filter-actions">
              <button type="submit" [disabled]="loading()">Filtrar</button>
              @if (search || topic || area || year) {
                <button
                  type="button"
                  class="text-button"
                  (click)="clearFilters()"
                >
                  Limpar
                </button>
              }
              </div>
            </form>
            <div class="list-heading">
              <h2 id="catalog-results" tabindex="-1">Questões</h2>
              <span aria-live="polite" aria-atomic="true">
                {{ catalogTotal() }} {{ catalogTotal() === 1 ? "questão" : "questões" }} nesta seleção
                @if (catalogTotal() > rows().length) {
                  · {{ catalogOffset() + 1 }}–{{ catalogOffset() + rows().length }} nesta página
                }
              </span>
            </div>
            @if (loading()) {
              <p role="status">Buscando questões…</p>
            }
            @if (error()) {
              <div class="notice" role="alert">
                <p>{{ error() }}</p>
                <button (click)="retryCatalog()">Tentar novamente</button>
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
                      (catalogOffset() + i + 1).toString().padStart(2, "0")
                    }}</span>
                    <div class="question-summary">
                      <p class="metadata">
                        {{ row.topic }} <span>·</span>
                        {{ originLabel(row.origin, row.demonstration) }}
                        @if (row.year) {
                          <span>·</span> {{ row.year }} · {{ modalityLabel(row.modality || '') }}
                          @if (row.questionNumber) { · Q{{ row.questionNumber }} }
                        }
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
            @if (catalogTotal() > catalogPageSize) {
              <nav class="catalog-pagination" aria-label="Paginação do banco de questões">
                <button class="outline" (click)="changeCatalogPage(-1)" [disabled]="loading() || catalogOffset() === 0">Anterior</button>
                <p>Página {{ catalogPage() }} de {{ catalogPages() }}</p>
                <button class="outline" (click)="changeCatalogPage(1)" [disabled]="loading() || catalogOffset() + rows().length >= catalogTotal()">Próxima</button>
              </nav>
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
              <app-question-content [question]="question()!" />
              <form (ngSubmit)="save()">
                <fieldset
                  [class.answer-sheet]="isImage()"
                  [disabled]="saving() || (!!question()!.answer && !editing())"
                >
                  <legend>
                    {{
                      isImage()
                        ? "Marque a alternativa da imagem"
                        : "Selecione uma alternativa"
                    }}
                  </legend>
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
                          [attr.aria-label]="
                            isImage() ? 'Alternativa ' + option.id : null
                          "
                          [attr.aria-describedby]="
                            optionOutcome(option.id)
                              ? 'outcome-' + option.id
                              : null
                          "
                        /><span class="letter" aria-hidden="true">{{
                          "ABCDE"[i]
                        }}</span
                        >@if (!isImage()) {
                          <span>{{ option.text }}</span>
                        }</label
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
                            {{ isImage() ? "Correta" : "Alternativa correta" }}
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
                  @if (question()!.answer!.explanation) {
                    <p class="feedback-explanation">
                      {{ question()!.answer!.explanation }}
                    </p>
                    @if (question()!.answer!.explanationCredit) {
                      <p class="metadata">
                        @if (question()!.reviewOrigin !== "ASSISTED") {
                          Explicação editorial:
                        }
                        {{ question()!.answer!.explanationCredit }}
                      </p>
                    }
                  } @else {
                    <p class="metadata">
                      Ainda não há explicação para esta questão. Confira o
                      raciocínio na prova original.
                    </p>
                  }
                  @if (question()!.answer!.answerKey) {
                    <p class="answer-key-source">
                      <a
                        [href]="question()!.answer!.answerKey!.officialUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        >{{
                          question()!.answer!.answerKey!.finality ===
                          "ONLY_PUBLISHED"
                            ? "Gabarito publicado pelo Inep"
                            : "Gabarito definitivo"
                        }}:
                        {{ question()!.answer!.answerKey!.title }}</a
                      >
                      · página {{ question()!.answer!.answerKey!.page }}
                    </p>
                    @if (
                      question()!.answer!.answerKey!.finality ===
                      "ONLY_PUBLISHED"
                    ) {
                      <p class="metadata">
                        O Inep não indicou este gabarito como definitivo; é o
                        único publicado para a edição.
                      </p>
                    }
                  }
                  <div class="feedback-actions">
                    @if (nextQuestion(); as next) {
                      <button
                        (click)="openNext()"
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
  catalogAreas = signal<{ name: string; count: number }[]>([]);
  catalogYears = signal<number[]>([]);
  catalogUnclassified = signal(0);
  catalogTotal = signal(0);
  catalogAnswered = signal(0);
  catalogOffset = signal(0);
  readonly catalogPageSize = CATALOG_PAGE_SIZE;
  private appliedFilters: CatalogFilters = { q: "", topic: "", area: "", year: "" };
  private currentAddress = location.pathname + location.search;
  private lastCatalogRequest: { filters: CatalogFilters; offset: number; navigation: "push" | "replace" | "none" } | null = null;
  question = signal<Question | null>(null);
  booting = signal(true);
  bootError = signal("");
  loading = signal(false);
  saving = signal(false);
  error = signal("");
  editing = signal(false);
  search = "";
  topic = "";
  area = "";
  year = "";
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
  practiceView = signal(location.pathname === "/treino");
  practiceAttemptId = signal<string | null>(null);
  practiceItemPosition = signal(1);
  practiceBusy = signal(false);
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
    this.readCatalogAddress();
    this.readPracticeAddress();
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
      await this.loadCatalog(true, this.catalogOffset(), "replace", this.appliedFilters);
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
      this.curationBusy() || this.practiceBusy()
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
    this.practiceView.set(false);
    this.curationView.set(true);
    this.leaveHomePath();
    this.focusMain();
  }
  openHome(event?: Event) {
    event?.preventDefault();
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) return;
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
      this.practiceView.set(false);
      this.homeView.set(true);
    });
    this.setPath("/");
    this.focusMain();
  }
  onHome() {
    return this.homeView() && !this.accountView();
  }
  openReview() {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) return;
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
      this.practiceView.set(false);
      this.reviewView.set(true);
    });
    this.leaveHomePath();
    this.focusMain();
  }
  openPractice() {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) return;
    this.requestNumber++;
    this.loading.set(false);
    this.question.set(null);
    this.accountView.set(null);
    this.curationView.set(false);
    this.reviewView.set(false);
    this.reviewReturn.set(false);
    this.reviewCurrentVersion.set(null);
    this.homeView.set(false);
    this.error.set("");
    this.practiceAttemptId.set(null);
    this.practiceItemPosition.set(1);
    this.practiceView.set(true);
    this.writePracticeAddress("push");
    this.focusMain();
  }
  practiceLocationChanged(location_: { attemptId: string | null; position: number }) {
    if (!this.practiceView() || this.authBusy() || location.pathname !== "/treino") return;
    this.practiceAttemptId.set(location_.attemptId);
    this.practiceItemPosition.set(location_.position);
    this.writePracticeAddress("replace");
  }
  private readPracticeAddress() {
    const params = new URLSearchParams(location.search);
    const id = params.getAll("attempt").length === 1 ? params.get("attempt") : null;
    const valid = location.pathname === "/treino" && id && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
    this.practiceAttemptId.set(valid ? id.toLowerCase() : null);
    const position = params.getAll("item").length === 1 ? params.get("item") ?? "1" : "1";
    this.practiceItemPosition.set(valid && /^([1-9]|[12][0-9]|30)$/.test(position) ? Number(position) : 1);
  }
  private writePracticeAddress(mode: "push" | "replace") {
    const params = new URLSearchParams();
    if (this.practiceAttemptId()) {
      params.set("attempt", this.practiceAttemptId()!);
      if (this.practiceItemPosition() > 1) params.set("item", String(this.practiceItemPosition()));
    }
    const address = "/treino" + (params.size ? "?" + params.toString() : "");
    if (location.pathname + location.search !== address) {
      if (mode === "push") history.pushState(null, "", address);
      else history.replaceState(null, "", address);
    }
    this.currentAddress = address;
  }
  async openReviewQuestion(item: ReviewItem) {
    if (this.loading() || this.authBusy()) return;
    this.reviewReturn.set(true);
    this.reviewCurrentVersion.set(item.currentVersionId);
    await this.open(item.id, true);
  }
  async loadCatalog(
    duringTransition = false,
    offset = 0,
    navigation: "push" | "replace" | "none" = "push",
    filters: CatalogFilters = this.filterValues(),
  ): Promise<Catalog | null> {
    if (this.authBusy() && !duringTransition) return null;
    const request = ++this.requestNumber;
    this.lastCatalogRequest = { filters: { ...filters }, offset, navigation };
    this.loading.set(true);
    this.error.set("");
    try {
      const catalog = await this.api<Catalog>(
        "catalog?" + new URLSearchParams({ ...filters, limit: String(CATALOG_PAGE_SIZE), offset: String(offset) }),
      );
      if (request !== this.requestNumber) return null;
      this.applyCatalog(catalog, filters, navigation);
      return catalog;
    } catch (err) {
      if (request === this.requestNumber) this.error.set(this.message(err));
      return null;
    } finally {
      if (request === this.requestNumber) this.loading.set(false);
    }
  }
  private applyCatalog(catalog: Catalog, filters: CatalogFilters, navigation: "push" | "replace" | "none") {
    this.rows.set(catalog.items);
    this.catalogTopics.set(catalog.facets.topics);
    this.catalogAreas.set(catalog.facets.areas);
    this.catalogYears.set(catalog.facets.years);
    this.catalogUnclassified.set(catalog.facets.unclassified);
    this.catalogTotal.set(catalog.total);
    this.catalogAnswered.set(catalog.answeredTotal);
    this.catalogOffset.set(catalog.offset);
    this.appliedFilters = { ...filters };
    if (location.pathname === "/questoes") this.writeCatalogAddress(navigation);
  }
  private filterValues(): CatalogFilters {
    return { q: this.search, topic: this.topic, area: this.area, year: this.year };
  }
  async retryCatalog() {
    const pending = this.lastCatalogRequest;
    if (await this.loadCatalog(false, pending?.offset ?? this.catalogOffset(), pending?.navigation ?? "replace", pending?.filters ?? this.appliedFilters)) {
      this.restoreFilterFields();
    }
  }
  hasCatalogArea(area: string) {
    return this.catalogAreas().some((entry) => entry.name === area);
  }
  hasCatalogYear(year: string) {
    return this.catalogYears().includes(Number(year));
  }
  catalogPage() {
    return Math.floor(this.catalogOffset() / CATALOG_PAGE_SIZE) + 1;
  }
  catalogPages() {
    return Math.max(1, Math.ceil(this.catalogTotal() / CATALOG_PAGE_SIZE));
  }
  async changeCatalogPage(direction: number) {
    if (this.loading() || this.authBusy()) return;
    const offset = Math.max(0, this.catalogOffset() + direction * CATALOG_PAGE_SIZE);
    if (await this.loadCatalog(false, offset, "push", this.appliedFilters)) {
      this.restoreFilterFields();
      setTimeout(() => document.getElementById("catalog-results")?.focus(), 0);
    }
  }
  async openNext() {
    if (this.loading() || this.saving() || this.authBusy()) return;
    const next = this.nextQuestion();
    if (!next) return;
    if (next.id) { await this.open(next.id); return; }
    const request = ++this.requestNumber;
    const filters = { ...this.appliedFilters };
    const offset = this.catalogOffset() + CATALOG_PAGE_SIZE;
    this.loading.set(true);
    this.error.set("");
    try {
      const catalog = await this.api<Catalog>("catalog?" + new URLSearchParams({ ...filters, limit: String(CATALOG_PAGE_SIZE), offset: String(offset) }));
      if (request !== this.requestNumber) return;
      if (!catalog.items[0] || catalog.offset < offset) {
        this.error.set("Esta seleção foi atualizada. Volte ao banco para conferir as questões disponíveis.");
        return;
      }
      const question = await this.api<Question>("questions/" + encodeURIComponent(catalog.items[0].id));
      if (request !== this.requestNumber) return;
      // Commit the new page only after its question is available. A network
      // failure keeps the answered question and its original position intact.
      this.applyCatalog(catalog, filters, "push");
      this.showQuestion(question, false, request);
    } catch (err) {
      if (request === this.requestNumber) this.error.set(this.message(err));
    } finally {
      if (request === this.requestNumber) this.loading.set(false);
    }
  }
  private showQuestion(q: Question, retry: boolean, request: number) {
    this.swapView(() => {
      this.reviewView.set(false);
      this.homeView.set(false);
      this.practiceView.set(false);
      this.question.set(q);
      this.selected = retry ? "" : q.answer?.optionId || "";
      this.editing.set(retry);
    }, () => request === this.requestNumber);
    this.leaveHomePath();
    this.focusMain();
  }
  async open(id: string, retry = false) {
    if (this.authBusy()) return;
    const request = ++this.requestNumber;
    this.loading.set(true);
    this.error.set("");
    try {
      const q = await this.api<Question>("questions/" + encodeURIComponent(id));
      if (request !== this.requestNumber) return;
      this.showQuestion(q, retry, request);
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
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) return;
    this.swapView(() => {
      this.homeView.set(false);
      this.practiceView.set(false);
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
    this.restoreFilterFields();
    this.setPath("/questoes");
    this.writeCatalogAddress("replace");
    void this.loadCatalog(false, this.catalogOffset(), "replace", this.appliedFilters);
    this.focusMain();
  }
  // As outras telas continuam sobre o endereço da seleção do banco.
  // O endereço contém filtros e página, nunca respostas ou dados da conta.
  private setPath(path: string) {
    if (location.pathname !== path) history.replaceState(null, "", path);
    this.currentAddress = location.pathname + location.search;
  }
  private leaveHomePath() {
    if (location.pathname === "/" || location.pathname === "/treino") {
      this.setPath("/questoes");
      this.writeCatalogAddress("replace");
    }
  }
  private restoreFilterFields() {
    this.search = this.appliedFilters.q;
    this.topic = this.appliedFilters.topic;
    this.area = this.appliedFilters.area;
    this.year = this.appliedFilters.year;
  }
  private readCatalogAddress() {
    const params = new URLSearchParams(location.search);
    const value = (key: string, max: number) => {
      const entry = params.get(key) ?? "";
      return params.getAll(key).length === 1 && entry.length <= max ? entry : "";
    };
    const year = value("year", 4);
    this.appliedFilters = location.pathname === "/questoes"
      ? { q: value("q", 120), topic: value("topic", 80), area: value("area", 80), year: /^(20[0-9]{2}|2100)$/.test(year) ? year : "" }
      : { q: "", topic: "", area: "", year: "" };
    this.restoreFilterFields();
    const page = value("page", 6);
    const number = /^[1-9][0-9]{0,5}$/.test(page) ? Number(page) : 1;
    this.catalogOffset.set(number <= 50001 ? (number - 1) * CATALOG_PAGE_SIZE : 0);
  }
  private writeCatalogAddress(mode: "push" | "replace" | "none") {
    if (mode === "none") return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(this.appliedFilters)) if (value) params.set(key, value);
    if (this.catalogPage() > 1) params.set("page", String(this.catalogPage()));
    const address = "/questoes" + (params.size ? "?" + params.toString() : "");
    if (location.pathname + location.search !== address) {
      if (mode === "push") history.pushState(null, "", address);
      else history.replaceState(null, "", address);
    }
    this.currentAddress = address;
  }
  @HostListener("window:popstate")
  async restoreCatalogNavigation() {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) {
      history.pushState(null, "", this.currentAddress);
      return;
    }
    this.question.set(null);
    this.selected = "";
    this.editing.set(false);
    this.reviewView.set(false);
    this.reviewReturn.set(false);
    this.reviewCurrentVersion.set(null);
    this.curationView.set(false);
    this.accountView.set(null);
    this.homeView.set(location.pathname === "/");
    this.practiceView.set(location.pathname === "/treino");
    if (this.practiceView()) {
      this.requestNumber++;
      this.loading.set(false);
      this.error.set("");
      this.readPracticeAddress();
      this.currentAddress = location.pathname + location.search;
      this.focusMain();
      return;
    }
    this.readCatalogAddress();
    this.currentAddress = location.pathname + location.search;
    await this.loadCatalog(false, this.catalogOffset(), "replace", this.appliedFilters);
    this.focusMain();
  }
  clearFilters() {
    if (this.authBusy()) return;
    this.search = "";
    this.topic = "";
    this.area = "";
    this.year = "";
    void this.loadCatalog();
  }
  accountEmail() {
    const session = this.session();
    return session.mode === "account" ? session.email : "";
  }
  openAccount(mode: AccountMode) {
    if (this.saving() || this.authBusy() || this.practiceBusy() || this.session().mode === "account")
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
    if (!this.question() && !this.reviewView() && !this.practiceView()) void this.loadCatalog(false, this.catalogOffset(), "replace", this.appliedFilters);
    this.focusMain();
  }
  private clearStudyState() {
    if (this.identityGeneration > 0 && this.practiceView()) {
      this.practiceAttemptId.set(null);
      this.practiceItemPosition.set(1);
      this.writePracticeAddress("replace");
    }
    this.practiceBusy.set(false);
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
    this.catalogAreas.set([]);
    this.catalogYears.set([]);
    this.catalogUnclassified.set(0);
    this.catalogTotal.set(0);
    this.catalogAnswered.set(0);
    this.lastCatalogRequest = null;
    this.question.set(null);
    this.selected = "";
    this.restoreFilterFields();
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
      await this.loadCatalog(true, this.catalogOffset(), "replace", this.appliedFilters);
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
    if (this.authBusy() || this.saving() || this.curationBusy() || this.practiceBusy()) return;
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
      await this.loadCatalog(true, this.catalogOffset(), "replace", this.appliedFilters);
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
      if (!this.accountView()) await this.loadCatalog(true, this.catalogOffset(), "replace", this.appliedFilters);
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
    if (this.isImage()) return q?.answer?.correctOptionId ?? "";
    return (
      q?.options.find((o) => o.id === q.answer?.correctOptionId)?.text || ""
    );
  }
  isImage() {
    const q = this.question();
    return q?.presentation === "IMAGE" && !!q.images?.length;
  }
  // Posição só faz sentido quando a questão veio do catálogo atual.
  position() {
    const q = this.question();
    if (!q || this.reviewReturn()) return null;
    const index = this.rows().findIndex((row) => row.id === q.id);
    return index < 0 ? null : { index: this.catalogOffset() + index, total: this.catalogTotal() };
  }
  nextQuestion() {
    const q = this.question();
    if (!q || this.reviewReturn()) return null;
    const index = this.rows().findIndex((row) => row.id === q.id);
    if (index < 0) return null;
    return this.rows()[index + 1] ?? (this.catalogOffset() + index + 1 < this.catalogTotal() ? { id: "", title: "da próxima página" } : null);
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
  skipToContent(event: Event) {
    event.preventDefault();
    this.focusMain();
  }
}
bootstrapApplication(App, {
  // Os recortes das questões vêm em 200 dpi de propósito: a mesma imagem
  // serve à leitura e à ampliação. O aviso de imagem maior que a exibida
  // não se aplica a eles.
  providers: [
    { provide: IMAGE_CONFIG, useValue: { disableImageSizeWarning: true } },
  ],
}).catch(console.error);
