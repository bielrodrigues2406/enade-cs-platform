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
  templateUrl: "./home.component.html",
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
