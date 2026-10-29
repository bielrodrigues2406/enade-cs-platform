import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from "@angular/core";
import type { ReviewItem } from "./review.component";

type CatalogRow = {
  id: string;
  title: string;
  topic: string;
  origin: string;
  answered: boolean;
  demonstration: boolean;
};
type HomeCatalog = {
  summary: { total: number; answered: number; official: number; author: number; demonstration: number };
  suggestions: CatalogRow[];
};
type Notebook = {
  summary: { answered: number; correct: number; incorrect: number };
  items: ReviewItem[];
  total: number;
};
type Week = { label: string; now: boolean; exam: boolean };

// Data de aplicação para bacharelados/CST segundo o Inep (MASTER-SPEC §2).
// Revalidar a cada edição; a página informa a fonte.
const EXAM_DATE = new Date(2026, 10, 29);
const EXAM_SOURCE =
  "https://www.gov.br/inep/pt-br/acesso-a-informacao/perguntas-frequentes/exame-nacional-de-desempenho-dos-estudantes-enade";
const DAY = 86400000;
const MONTHS = "jan fev mar abr mai jun jul ago set out nov dez".split(" ");

const range = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => from + i);
const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};
const monday = (date: Date) => {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
};

/**
 * Página inicial no modelo de "início" do Portal FSA: capa com data, situação
 * e semanas até a prova; o que estudar agora em ordem de prioridade; andamento
 * e prova ao lado; depois, como o caderno funciona. Usa somente dados reais
 * (catálogo e respostas salvas); não exibe métricas inventadas.
 */
@Component({
  selector: "app-home",
  template: `
    <section class="home-cover" aria-labelledby="home-title">
      <div class="cover-head">
        <div class="cover-text">
          <p class="cover-date">{{ todayLabel }}</p>
          <h1 id="home-title">
            {{ greeting }}.
            @if (daysLeft(); as days) {
              {{ days.before }}<span class="cover-mark">{{ days.count }}</span
              >{{ days.after }}
            } @else {
              Bons estudos para o próximo ENADE.
            }
          </h1>
          <p class="cover-summary">{{ coverSummary() }}</p>
        </div>
        <div class="cover-actions">
          @if (nextQuestion(); as next) {
            <button
              class="cover-primary"
              (click)="openQuestion.emit(next.id)"
              [attr.aria-label]="
                (answeredCount() ? 'Continuar com: ' : 'Começar por: ') +
                next.title
              "
            >
              {{
                answeredCount() ? "Continuar estudando" : "Começar a resolver"
              }}
              <span aria-hidden="true">→</span>
            </button>
            <button class="cover-secondary" (click)="browse.emit()">
              Abrir o banco de questões
            </button>
          } @else {
            <button class="cover-primary" (click)="browse.emit()">
              Abrir o banco de questões <span aria-hidden="true">→</span>
            </button>
          }
        </div>
      </div>
      @if (weeks.length) {
        <ol class="cover-weeks" aria-label="Semanas até a prova">
          @for (week of weeks; track week.label; let i = $index) {
            <li
              [class.is-now]="week.now"
              [class.is-exam]="week.exam"
              [style.--i]="i"
            >
              <span class="week-label">{{ week.label }}</span>
              @if (week.now) {
                <span class="week-chip">
                  <span class="week-chip-type">{{ todayChip }}</span>
                  <span>Você está aqui</span>
                </span>
              }
              @if (week.exam) {
                <span class="week-chip">
                  <span class="week-chip-type">DOM 29 · PROVA</span>
                  <span>ENADE 2026, 4 horas</span>
                </span>
              }
            </li>
          }
        </ol>
      }
    </section>

    <div class="home-board">
      <section class="home-todo" aria-labelledby="home-todo-title">
        <div class="board-head">
          <h2 id="home-todo-title">Para você estudar</h2>
          <span>em ordem de prioridade</span>
        </div>
        @if (!catalog()) {
          <p class="todo-loading" role="status">Carregando suas questões…</p>
        } @else {
          @if (retryItems().length) {
            <section class="todo-group" aria-labelledby="home-retry">
              <h3 id="home-retry" class="group-title is-danger">
                Para retomar
              </h3>
              @for (item of retryItems(); track item.id; let i = $index) {
                <article class="todo-card" [style.--i]="i">
                  <div class="todo-text">
                    <span class="todo-meta"
                      >{{ item.topic }} ·
                      {{ originLabel(item.origin, item.demonstration) }}</span
                    >
                    <strong>{{ item.title }}</strong>
                    <span class="todo-status is-danger"
                      >Errada na última resposta, em
                      {{ shortDate(item.answeredAt) }}</span
                    >
                  </div>
                  <button
                    (click)="retry.emit(item)"
                    [attr.aria-label]="'Tentar novamente: ' + item.title"
                  >
                    Tentar novamente
                  </button>
                </article>
              }
              @if ((notebook()?.total ?? 0) > retryItems().length) {
                <button class="text-button" (click)="review.emit()">
                  Ver as {{ notebook()!.total }} no caderno de erros
                </button>
              }
            </section>
          }
          @if (pending().length) {
            <section class="todo-group" aria-labelledby="home-pending">
              <h3 id="home-pending" class="group-title">
                {{
                  answeredCount() ? "Ainda não respondidas" : "Comece por aqui"
                }}
              </h3>
              @for (row of pending(); track row.id; let i = $index) {
                <article
                  class="todo-card"
                  [style.--i]="i + retryItems().length"
                >
                  <div class="todo-text">
                    <span class="todo-meta"
                      >{{ row.topic }} ·
                      {{ originLabel(row.origin, row.demonstration) }}</span
                    >
                    <strong>{{ row.title }}</strong>
                    <span class="todo-status">Disponível para praticar</span>
                  </div>
                  <button
                    class="outline"
                    (click)="openQuestion.emit(row.id)"
                    [attr.aria-label]="'Resolver: ' + row.title"
                  >
                    Resolver
                  </button>
                </article>
              }
              @if (unansweredCount() > pending().length) {
                <button class="text-button" (click)="browse.emit()">
                  Ver as {{ unansweredCount() }} não respondidas no banco
                </button>
              }
            </section>
          }
          @if (!retryItems().length && !pending().length) {
            <p class="todo-done">
              Você respondeu todas as questões publicadas e acertou a última
              resposta de cada uma. Novas questões aparecem aqui assim que forem
              publicadas.
            </p>
          }
        }
      </section>

      <!-- div, não aside: o shell estiliza aside como a barra lateral. -->
      <div class="home-aside">
        <section class="panel" aria-label="Seu andamento">
          <span class="panel-eyebrow">SEU ANDAMENTO</span>
          <h2>Banco de questões</h2>
          @if (catalog(); as data) {
            <div class="bars">
              <div class="bar-row">
                <span>Respondidas</span>
                <span class="bar-track"
                  ><span
                    class="bar-fill"
                    [style.--value]="ratio(answeredCount(), data.summary.total)"
                  ></span
                ></span>
                <span class="bar-value"
                  >{{ answeredCount() }} de {{ data.summary.total }}</span
                >
              </div>
              <div class="bar-row">
                <span>Acertos</span>
                <span class="bar-track"
                  ><span
                    class="bar-fill is-success"
                    [style.--value]="
                      ratio(
                        notebook()?.summary?.correct ?? 0,
                        notebook()?.summary?.answered ?? 0
                      )
                    "
                  ></span
                ></span>
                <span class="bar-value"
                  >{{ notebook()?.summary?.correct ?? 0 }} de
                  {{ notebook()?.summary?.answered ?? 0 }}</span
                >
              </div>
            </div>
            <p class="panel-note" [class.is-danger]="incorrectCount() > 0">
              {{ progressNote() }}
            </p>
            @if (incorrectCount()) {
              <button class="outline" (click)="review.emit()">
                Abrir o caderno de erros <span aria-hidden="true">→</span>
              </button>
            }
          }
        </section>

        <section class="panel" aria-labelledby="home-exam-title">
          <div class="exam-head">
            <span class="date-block" aria-hidden="true"
              ><strong>29</strong><span>NOV</span></span
            >
            <div>
              <span class="panel-meta">Domingo · 4 horas de prova</span>
              <h2 id="home-exam-title">A prova de 2026</h2>
            </div>
          </div>
          <div
            class="map-parts"
            role="img"
            aria-label="Mapa da prova: 15 questões de Formação Geral, 30 objetivas e 1 discursiva de Computação. O caderno treina hoje as objetivas de Computação."
          >
            @for (part of examParts; track part.count) {
              <div class="map-part" [attr.data-kind]="part.kind">
                <p class="map-label">
                  <span>{{ part.label }}</span>
                  <span>{{ part.count }}</span>
                </p>
                <div class="map-cells">
                  @for (cell of part.cells; track cell) {
                    <span
                      class="map-cell"
                      [style.--cell-delay]="cell * 12 + 'ms'"
                    ></span>
                  }
                </div>
              </div>
            }
          </div>
          <p class="panel-note">
            Em azul, o que o caderno já treina. Formato informado pelo
            <a [href]="examSource" target="_blank" rel="noopener noreferrer"
              >Inep</a
            >
            para os bacharelados; datas e formato podem mudar.
          </p>
        </section>

        <section class="panel" aria-labelledby="home-origin">
          <h2 id="home-origin">De onde vêm as questões</h2>
          <dl class="home-origins">
            <div>
              <dt>Oficial · Inep</dt>
              <dd>{{ countLabel(officialCount()) }}</dd>
            </div>
            <div>
              <dt>Autoral</dt>
              <dd>{{ countLabel(authorCount()) }}</dd>
            </div>
            <div>
              <dt>Autoral demonstrativa</dt>
              <dd>{{ countLabel(demoCount()) }}</dd>
            </div>
          </dl>
          <p class="panel-note">
            Oficiais vêm de provas anteriores, com edição, página e gabarito
            definitivo. Autorais têm autoria identificada e não são do Inep; as
            demonstrativas servem para conhecer o caderno.
            @if (catalog() && !officialCount()) {
              As provas de 2005 a 2021 estão em transcrição e conferência.
            }
          </p>
        </section>
      </div>
    </div>

    <section
      class="home-section home-how"
      aria-labelledby="home-how"
      data-reveal
    >
      <div class="how-text">
        <h2 id="home-how">Como o caderno funciona</h2>
        <ol class="home-steps">
          @for (step of steps; track step.title; let i = $index) {
            <li data-reveal [style.--reveal-delay]="i * 80 + 'ms'">
              <span class="home-step-number" aria-hidden="true">{{
                (i + 1).toString().padStart(2, "0")
              }}</span>
              <div>
                <h3>{{ step.title }}</h3>
                <p>{{ step.text }}</p>
              </div>
            </li>
          }
        </ol>
      </div>

      <figure class="home-demo">
        <div class="demo-sheet" aria-hidden="true">
          <p class="demo-meta">Redes · Exemplo autoral</p>
          <p class="demo-prompt">
            Qual protocolo da camada de transporte entrega um fluxo de bytes em
            ordem e retransmite o que se perdeu?
          </p>
          <ol class="demo-options">
            @for (option of demoOptions; track option.letter) {
              <li
                [class.is-hover]="demoStep() === 1 && option.letter === 'B'"
                [class.is-selected]="demoStep() >= 2 && option.letter === 'D'"
                [class.is-correct]="demoStep() >= 4 && option.letter === 'D'"
              >
                <span class="demo-letter">{{ option.letter }}</span>
                <span>{{ option.text }}</span>
                @if (demoStep() >= 4 && option.letter === "D") {
                  <span class="demo-tag"
                    ><svg class="demo-check" viewBox="0 0 20 20">
                      <path d="M3.5 10.5 8 15 16.5 4.5" pathLength="1" /></svg
                    >Alternativa correta</span
                  >
                  <!-- Volta de caneta: a correção que o professor faria. -->
                  <svg
                    class="demo-circle"
                    viewBox="0 0 300 60"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M24 9C90 2 230 3 284 12c16 4 15 32-6 39C214 60 70 59 20 50 0 45 1 20 21 12c20-7 60-8 92-8"
                      pathLength="1"
                    />
                  </svg>
                }
              </li>
            }
          </ol>
          @if (demoStep() < 4) {
            <div class="demo-confirm" [class.is-pressed]="demoStep() === 3">
              {{ demoStep() === 3 ? "Confirmando…" : "Confirmar resposta" }}
            </div>
          } @else {
            <div class="demo-feedback">
              <strong>Resposta correta.</strong>
              TCP numera os segmentos, confirma o recebimento e reenvia o que
              não chegou; UDP não oferece essas garantias.
            </div>
          }
        </div>
        <figcaption>
          <span
            >Uma questão em poucos segundos: você escolhe, confirma e só então
            vê a correção, com explicação.</span
          >
          <button
            type="button"
            class="text-button"
            (click)="replay()"
            [disabled]="demoStep() > 0 && demoStep() < 5"
          >
            Ver de novo
          </button>
        </figcaption>
      </figure>
    </section>

    <section class="home-section" aria-labelledby="home-next" data-reveal>
      <div class="board-head">
        <h2 id="home-next">Em construção</h2>
        <span>o que ainda não está no caderno</span>
      </div>
      <ul class="home-roadmap">
        @for (item of roadmap; track item.title; let i = $index) {
          <li data-reveal [style.--reveal-delay]="i * 70 + 'ms'">
            <span class="home-status" [class.is-active]="item.active">{{
              item.status
            }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.text }}</p>
          </li>
        }
      </ul>
    </section>

    <footer class="home-footer">
      <p>
        Projeto independente de estudo, sem vínculo com o Inep ou o MEC. Provas
        e gabaritos oficiais pertencem ao Inep. A data da prova segue o
        <a [href]="examSource" target="_blank" rel="noopener noreferrer"
          >cronograma divulgado pelo Inep</a
        >
        e pode mudar.
      </p>
      @if (sessionMode === "guest") {
        <button type="button" class="text-button" (click)="register.emit()">
          Criar conta para guardar o histórico
        </button>
      }
    </footer>
  `,
})
export class HomeComponent {
  @Input() sessionMode: "guest" | "account" = "guest";
  @Output() browse = new EventEmitter<void>();
  @Output() review = new EventEmitter<void>();
  @Output() register = new EventEmitter<void>();
  @Output() openQuestion = new EventEmitter<string>();
  @Output() retry = new EventEmitter<ReviewItem>();

  readonly examSource = EXAM_SOURCE;
  private readonly now = new Date();
  readonly greeting =
    this.now.getHours() < 5 || this.now.getHours() >= 18
      ? "Boa noite"
      : this.now.getHours() < 12
        ? "Bom dia"
        : "Boa tarde";
  readonly todayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(this.now)
    .replace("-feira", "")
    .toUpperCase();
  readonly todayChip =
    "HOJE · " +
    new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric" })
      .format(this.now)
      .replace(".", "")
      .replace(",", "")
      .toUpperCase();
  readonly weeks = this.weeksUntilExam();
  // Formato de 2026 para bacharelados (MASTER-SPEC §2). Revalidar por edição.
  readonly examParts = [
    {
      label: "Formação Geral",
      count: "15 objetivas",
      kind: "general",
      cells: range(0, 15),
    },
    {
      label: "Computação",
      count: "30 objetivas",
      kind: "specific",
      cells: range(15, 45),
    },
    {
      label: "Computação",
      count: "1 discursiva",
      kind: "essay",
      cells: range(45, 46),
    },
  ];
  readonly demoOptions = [
    { letter: "A", text: "IP" },
    { letter: "B", text: "UDP" },
    { letter: "C", text: "ARP" },
    { letter: "D", text: "TCP" },
  ];
  readonly steps = [
    {
      title: "Escolha o que estudar",
      text: "Busque por um trecho do enunciado ou filtre por assunto. Cada questão mostra assunto e origem antes de você abrir.",
    },
    {
      title: "Responda sem pistas",
      text: "As alternativas aparecem como no papel. O gabarito só aparece depois que você confirma, e a resposta fica salva.",
    },
    {
      title: "Entenda o raciocínio",
      text: "Você vê a alternativa correta, a sua e uma explicação com autoria identificada. Pode mudar a resposta quando quiser.",
    },
    {
      title: "Volte ao que errou",
      text: "O caderno de erros reúne as questões cuja última resposta está incorreta, por assunto, das mais antigas para as mais novas.",
    },
  ];
  readonly roadmap = [
    {
      title: "Questões oficiais com a imagem da prova",
      text: "Cada questão transcrita acompanhada do recorte original do PDF, para conferir figuras, código e símbolos.",
      status: "em andamento",
      active: true,
    },
    {
      title: "Simulado no formato da prova",
      text: "Tempo de prova, folha de respostas e resultado só no final, por bloco e por assunto.",
      status: "planejado",
      active: false,
    },
    {
      title: "Desempenho por assunto",
      text: "Acertos e total por assunto e período, com aviso quando a amostra ainda é pequena.",
      status: "planejado",
      active: false,
    },
    {
      title: "Teste rápido de diagnóstico",
      text: "Poucas questões de assuntos variados para apontar por onde começar.",
      status: "planejado",
      active: false,
    },
  ];

  catalog = signal<HomeCatalog | null>(null);
  notebook = signal<Notebook | null>(null);
  demoStep = signal(0);
  private host = inject(ElementRef<HTMLElement>);
  private observer: IntersectionObserver | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private abort = new AbortController();
  private demoStarted = false;

  ngOnInit() {
    void this.load();
  }

  ngAfterViewInit() {
    const root = this.host.nativeElement as HTMLElement;
    if (this.reducedMotion() || typeof IntersectionObserver === "undefined") {
      this.demoStep.set(5);
      return;
    }
    // Só esconde o que ainda vai aparecer quando a animação está garantida.
    root.classList.add("motion-ready");
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          if (el.classList.contains("home-demo")) this.startDemo();
          else el.classList.add("is-visible");
          this.observer?.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    root
      .querySelectorAll("[data-reveal], .home-demo")
      .forEach((el) => this.observer!.observe(el));
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.timers.forEach(clearTimeout);
    this.abort.abort();
  }

  answeredCount() {
    return this.catalog()?.summary.answered ?? 0;
  }
  unansweredCount() {
    return (this.catalog()?.summary.total ?? 0) - this.answeredCount();
  }
  incorrectCount() {
    return this.notebook()?.summary.incorrect ?? 0;
  }
  nextQuestion() {
    return this.catalog()?.suggestions[0] ?? null;
  }
  // Erradas primeiro (as mais antigas, como no caderno), depois as novas.
  retryItems() {
    return this.notebook()?.items.slice(0, 3) ?? [];
  }
  pending() {
    return this.catalog()?.suggestions ?? [];
  }
  coverSummary() {
    if (!this.catalog()) return "";
    const answered = this.answeredCount();
    if (!answered)
      return "Resolva por assunto, veja por que cada alternativa está certa ou errada e volte ao que errou. Suas respostas ficam salvas neste navegador ou na sua conta.";
    const total = this.catalog()!.summary.total;
    const incorrect = this.incorrectCount();
    return (
      `Você respondeu ${answered} de ${total} questões do banco · ` +
      (incorrect === 0
        ? "nenhuma para retomar"
        : incorrect === 1
          ? "1 para retomar no caderno de erros"
          : `${incorrect} para retomar no caderno de erros`)
    );
  }
  progressNote() {
    const summary = this.notebook()?.summary;
    if (!summary?.answered) return "Nenhuma resposta salva ainda.";
    if (summary.incorrect === 1)
      return "1 questão com a última resposta errada espera no caderno de erros.";
    if (summary.incorrect)
      return `${summary.incorrect} questões com a última resposta errada esperam no caderno de erros.`;
    return "A última resposta de cada questão está certa.";
  }
  ratio(part: number, whole: number) {
    return whole ? Math.min(1, part / whole) : 0;
  }
  originLabel(origin: string, demonstration: boolean) {
    return origin === "OFFICIAL"
      ? "Oficial · Inep"
      : demonstration
        ? "Autoral demonstrativa"
        : "Autoral";
  }
  shortDate(iso: string) {
    const date = new Date(iso);
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  officialCount() {
    return this.catalog()?.summary.official ?? 0;
  }
  authorCount() {
    return this.catalog()?.summary.author ?? 0;
  }
  demoCount() {
    return this.catalog()?.summary.demonstration ?? 0;
  }
  countLabel(count: number) {
    if (!this.catalog()) return "";
    if (!count) return "nenhuma publicada ainda";
    return `${count} ${count === 1 ? "questão" : "questões"}`;
  }
  daysLeft() {
    const days = Math.round(
      (EXAM_DATE.getTime() - startOfDay(this.now).getTime()) / DAY,
    );
    if (days < 0) return null;
    if (days === 0)
      return { before: "Hoje é o dia do ENADE", count: "", after: "." };
    return {
      before: days === 1 ? "Falta " : "Faltam ",
      count: days === 1 ? "1 dia" : `${days} dias`,
      after: " para o ENADE.",
    };
  }

  replay() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.reducedMotion()) {
      this.demoStep.set(5);
      return;
    }
    this.demoStep.set(0);
    this.run();
  }

  // Semanas de segunda a domingo, da atual até a da prova; longe demais, nada.
  private weeksUntilExam(): Week[] {
    const first = monday(this.now);
    const last = monday(EXAM_DATE);
    const count =
      Math.round((last.getTime() - first.getTime()) / (7 * DAY)) + 1;
    if (count < 1 || count > 8) return [];
    return range(0, count).map((i) => {
      const from = new Date(first.getTime() + i * 7 * DAY);
      const to = new Date(from.getTime() + 6 * DAY);
      const label =
        i === 0
          ? "esta semana"
          : from.getMonth() === to.getMonth()
            ? `${from.getDate()} a ${to.getDate()} ${MONTHS[to.getMonth()]}`
            : `${from.getDate()} ${MONTHS[from.getMonth()]} a ${to.getDate()} ${MONTHS[to.getMonth()]}`;
      return { label, now: i === 0, exam: i === count - 1 };
    });
  }
  private startDemo() {
    if (this.demoStarted) return;
    this.demoStarted = true;
    this.run();
  }
  // Uma passagem curta: hesita em B, escolhe D, confirma e mostra a correção.
  private run() {
    const steps: [number, number][] = [
      [1, 500],
      [2, 1250],
      [3, 2050],
      [4, 2600],
      [5, 3400],
    ];
    for (const [step, at] of steps)
      this.timers.push(setTimeout(() => this.demoStep.set(step), at));
  }
  private reducedMotion() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  private async load() {
    const get = async <T>(path: string): Promise<T | null> => {
      try {
        const res = await fetch("/api/" + path, { signal: this.abort.signal });
        return res.ok ? ((await res.json()) as T) : null;
      } catch {
        return null;
      }
    };
    const [catalog, notebook] = await Promise.all([
      get<HomeCatalog>("catalog?limit=1"),
      get<Notebook>("review?topic=&offset=0"),
    ]);
    if (notebook) this.notebook.set(notebook);
    if (catalog) this.catalog.set(catalog);
  }
}
