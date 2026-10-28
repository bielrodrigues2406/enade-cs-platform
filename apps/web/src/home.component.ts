import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from "@angular/core";

type CatalogRow = {
  id: string;
  title: string;
  origin: string;
  answered: boolean;
  demonstration: boolean;
};
type NotebookSummary = { answered: number; correct: number; incorrect: number };

// Data de aplicação para bacharelados/CST segundo o Inep (MASTER-SPEC §2).
// Revalidar a cada edição; a página informa a fonte.
const EXAM_DATE = new Date(2026, 10, 29);
const EXAM_SOURCE =
  "https://www.gov.br/inep/pt-br/acesso-a-informacao/perguntas-frequentes/exame-nacional-de-desempenho-dos-estudantes-enade";
// O catálogo devolve no máximo esta quantidade de itens por consulta.
const CATALOG_LIMIT = 50;

const range = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => from + i);

/**
 * Página inicial: explica o caderno e leva à próxima ação. Usa somente dados
 * reais (catálogo e respostas salvas); não exibe métricas inventadas.
 */
@Component({
  selector: "app-home",
  template: `
    <section class="home-hero" aria-labelledby="home-title">
      <h1 id="home-title" class="home-title">
        <span class="home-line">Estude para o ENADE de Computação, </span>
        <span class="home-line"
          ><span class="home-mark">uma questão de cada vez.</span></span
        >
      </h1>
      <div class="home-hero-body">
        <div class="home-hero-text">
          <p class="home-lead home-rise">
            Resolva por assunto, veja por que cada alternativa está certa ou
            errada e volte ao que você errou. Suas respostas ficam salvas neste
            navegador ou na sua conta.
          </p>
          <div class="home-actions home-rise">
            @if (nextQuestion(); as next) {
              <button
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
            }
            <button [class.outline]="!!nextQuestion()" (click)="browse.emit()">
              Abrir o banco de questões
              @if (!nextQuestion()) {
                <span aria-hidden="true">→</span>
              }
            </button>
          </div>
          @if (daysLeft(); as days) {
            <p class="home-date home-rise">
              <span class="home-date-label">ENADE 2026</span>
              <span>29 de novembro</span>
              <span class="home-date-sep" aria-hidden="true"></span>
              <strong>{{ days.label }}</strong>
            </p>
          }
        </div>

        <figure class="home-demo">
          <div class="demo-sheet" aria-hidden="true">
            <p class="demo-meta">Redes · Exemplo autoral</p>
            <p class="demo-prompt">
              Qual protocolo da camada de transporte entrega um fluxo de bytes
              em ordem e retransmite o que se perdeu?
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
              >Como uma questão funciona: você escolhe, confirma e só então vê a
              correção, com explicação.</span
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
      </div>
    </section>

    @if (summary(); as data) {
      @if (data.answered) {
        <section class="home-progress" aria-label="Seu estudo até agora">
          <p>
            <strong>{{ data.answered }}</strong>
            {{
              data.answered === 1
                ? "questão respondida"
                : "questões respondidas"
            }}
          </p>
          <p>
            <strong>{{ data.correct }}</strong>
            {{ data.correct === 1 ? "acerto" : "acertos" }} na última resposta
          </p>
          <p>
            <strong>{{ data.incorrect }}</strong>
            {{
              data.incorrect === 1 ? "questão a retomar" : "questões a retomar"
            }}
          </p>
          @if (data.incorrect) {
            <button class="outline" (click)="review.emit()">
              Revisar o caderno de erros <span aria-hidden="true">→</span>
            </button>
          }
        </section>
      }
    }

    <section class="home-exam" aria-labelledby="home-exam-title" data-reveal>
      <div class="home-exam-text">
        <h2 id="home-exam-title">A prova de 2026</h2>
        @if (daysLeft(); as days) {
          <p class="home-countdown">
            <strong>{{ days.count }}</strong>
            <span>{{
              days.count === 1
                ? "dia até 29 de novembro"
                : days.count
                  ? "dias até 29 de novembro"
                  : "a prova é hoje, 29 de novembro"
            }}</span>
          </p>
        }
        <dl class="home-facts">
          <div>
            <dt>Duração</dt>
            <dd>4 horas</dd>
          </div>
          <div>
            <dt>Formação Geral</dt>
            <dd>15 objetivas, comuns a todos os cursos</dd>
          </div>
          <div>
            <dt>Componente de Computação</dt>
            <dd>30 objetivas e 1 discursiva</dd>
          </div>
        </dl>
        <p class="home-source">
          Formato informado pelo
          <a [href]="examSource" target="_blank" rel="noopener noreferrer"
            >Inep</a
          >
          para os bacharelados em 2026. Datas e formato podem mudar.
        </p>
      </div>
      <figure class="home-map">
        <div
          class="map-parts"
          role="img"
          aria-label="Mapa da prova: 15 questões de Formação Geral, 30 objetivas e 1 discursiva de Computação. O caderno treina hoje as objetivas de Computação."
        >
          @for (part of examParts; track part.label) {
            <div class="map-part" [attr.data-kind]="part.kind">
              <p class="map-label">
                <span>{{ part.label }}</span>
                <span class="map-count">{{ part.count }}</span>
              </p>
              <div class="map-cells">
                @for (cell of part.cells; track cell) {
                  <span
                    class="map-cell"
                    [style.--cell-delay]="cell * 14 + 'ms'"
                  ></span>
                }
              </div>
            </div>
          }
        </div>
        <figcaption>
          Cada quadrado é uma questão. Em azul, o que o caderno já treina;
          Formação Geral e discursivas entram nas próximas etapas.
        </figcaption>
      </figure>
    </section>

    <section class="home-section" aria-labelledby="home-how" data-reveal>
      <h2 id="home-how">Como o caderno funciona</h2>
      <ol class="home-steps">
        @for (step of steps; track step.title; let i = $index) {
          <li data-reveal [style.--reveal-delay]="i * 90 + 'ms'">
            <span class="home-step-number" aria-hidden="true">{{
              (i + 1).toString().padStart(2, "0")
            }}</span>
            <h3>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
          </li>
        }
      </ol>
    </section>

    <section
      class="home-section home-split"
      aria-labelledby="home-origin"
      data-reveal
    >
      <div class="home-split-intro">
        <h2 id="home-origin">De onde vêm as questões</h2>
        <p class="home-section-lead">
          Cada questão diz de onde veio. Isso muda o quanto ela se parece com a
          prova de verdade, e a origem aparece antes de você abrir.
        </p>
        <!-- Contêiner fixo: o conteúdo depende dos dados, a revelação não. -->
        <div data-reveal style="--reveal-delay: 210ms">
          @if (catalog() && !officialCount()) {
            <p class="home-note">
              As provas de 2005 a 2021 já estão arquivadas e passam por
              transcrição e conferência. Cada questão oficial aparece aqui
              quando estiver conferida.
            </p>
          }
        </div>
      </div>
      <dl class="home-origins">
        <div data-reveal>
          <dt>
            <span class="home-origin-label">Oficial · Inep</span>
            <span class="home-origin-count">{{
              countLabel(officialCount())
            }}</span>
          </dt>
          <dd>
            De provas anteriores do ENADE, com edição, página e gabarito
            definitivo. A prova original fica a um clique.
          </dd>
        </div>
        <div data-reveal style="--reveal-delay: 70ms">
          <dt>
            <span class="home-origin-label">Autoral</span>
            <span class="home-origin-count">{{
              countLabel(authorCount())
            }}</span>
          </dt>
          <dd>
            Escritas para treinar um conceito no estilo da prova, com autoria
            identificada. Não são questões do Inep.
          </dd>
        </div>
        <div data-reveal style="--reveal-delay: 140ms">
          <dt>
            <span class="home-origin-label">Autoral demonstrativa</span>
            <span class="home-origin-count">{{ countLabel(demoCount()) }}</span>
          </dt>
          <dd>
            Exemplos para conhecer o caderno. Servem para experimentar, não para
            medir o seu preparo.
          </dd>
        </div>
      </dl>
    </section>

    <section class="home-section" aria-labelledby="home-next" data-reveal>
      <h2 id="home-next">Em construção</h2>
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

    <section
      class="home-closing"
      aria-labelledby="home-closing-title"
      data-reveal
    >
      <h2 id="home-closing-title">A próxima questão está a um clique.</h2>
      <p>
        @if (sessionMode === "guest") {
          Dá para começar sem conta: as respostas ficam neste navegador por até
          30 dias. Com uma conta, o histórico fica guardado.
        } @else {
          Seu histórico está guardado na sua conta. Continue de onde parou.
        }
      </p>
      <div class="home-closing-actions">
        @if (nextQuestion(); as next) {
          <button
            (click)="openQuestion.emit(next.id)"
            [attr.aria-label]="'Abrir a próxima questão: ' + next.title"
          >
            Abrir a próxima questão <span aria-hidden="true">→</span>
          </button>
        } @else {
          <button (click)="browse.emit()">
            Abrir o banco de questões <span aria-hidden="true">→</span>
          </button>
        }
        @if (sessionMode === "guest") {
          <button type="button" class="text-button" (click)="register.emit()">
            Criar conta para guardar o histórico
          </button>
        }
      </div>
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
    </footer>
  `,
})
export class HomeComponent {
  @Input() sessionMode: "guest" | "account" = "guest";
  @Output() browse = new EventEmitter<void>();
  @Output() review = new EventEmitter<void>();
  @Output() register = new EventEmitter<void>();
  @Output() openQuestion = new EventEmitter<string>();

  readonly examSource = EXAM_SOURCE;
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

  catalog = signal<CatalogRow[] | null>(null);
  summary = signal<NotebookSummary | null>(null);
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
    return this.summary()?.answered ?? 0;
  }
  nextQuestion() {
    return this.catalog()?.find((row) => !row.answered) ?? null;
  }
  officialCount() {
    return this.catalog()?.filter((r) => r.origin === "OFFICIAL").length ?? 0;
  }
  authorCount() {
    return (
      this.catalog()?.filter((r) => r.origin !== "OFFICIAL" && !r.demonstration)
        .length ?? 0
    );
  }
  demoCount() {
    return this.catalog()?.filter((r) => r.demonstration).length ?? 0;
  }
  countLabel(count: number) {
    if (!this.catalog()) return "";
    const capped = (this.catalog()?.length ?? 0) >= CATALOG_LIMIT;
    if (!count) return "nenhuma publicada ainda";
    const n = capped ? `${count}+` : String(count);
    return `${n} ${count === 1 ? "questão" : "questões"}`;
  }
  daysLeft() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((EXAM_DATE.getTime() - today.getTime()) / 86400000);
    if (days < 0) return null;
    return {
      count: days,
      label:
        days === 0
          ? "é hoje"
          : days === 1
            ? "falta 1 dia"
            : `faltam ${days} dias`,
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
    const [rows, notebook] = await Promise.all([
      get<CatalogRow[]>("questions?q=&topic="),
      get<{ summary: NotebookSummary }>("review?topic=&offset=0"),
    ]);
    if (rows) this.catalog.set(rows);
    if (notebook) this.summary.set(notebook.summary);
  }
}
