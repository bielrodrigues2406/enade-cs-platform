import { Component, EventEmitter, Input, Output, inject, signal } from "@angular/core";
import type { ReviewItem } from "./review.component";
import { AREA_SIMULATION_LIMIT, chooseAreaSimulation, type PracticeRequest } from "./practice-request";
import { ChoiceService } from "./choice-dialog";

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
/** Primeira resposta de cada questão da área (GET /api/me/progress). */
type AreaProgress = { area: string; published: number; firstAttempts: number; firstCorrect: number };
type Progress = {
  areas: AreaProgress[];
  errors: { total: number; ready: number };
  active: { id: string; kind: "PARTIAL" | "EDITION"; size: number; area: string | null; pausedAt: string | null; answered: number } | null;
};
type Week = { label: string; now: boolean; exam: boolean };

// Data de aplicação para bacharelados/CST segundo o Inep (MASTER-SPEC §2).
// Revalidar a cada edição; a página informa a fonte.
const EXAM_DATE = new Date(2026, 10, 29);
const EXAM_SOURCE =
  "https://www.gov.br/inep/pt-br/acesso-a-informacao/perguntas-frequentes/exame-nacional-de-desempenho-dos-estudantes-enade";
const DAY = 86400000;
const MONTHS = "jan fev mar abr mai jun jul ago set out nov dez".split(" ");
/** Abaixo disso, o acerto da área é só um indício: a página avisa. */
const SMALL_SAMPLE = 5;

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
 * Painel de quem já entrou: capa com data e semanas até a prova; o que fazer
 * agora (treino em andamento, erros prontos, questões a retomar e novas);
 * desempenho por área com simulado de cada uma; andamento e prova ao lado.
 * Usa somente dados reais da pessoa; não estima nota do ENADE.
 */
@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.css",
})
export class HomeComponent {
  private choice = inject(ChoiceService);
  @Input() sessionMode: "guest" | "account" = "guest";
  @Output() browse = new EventEmitter<void>();
  @Output() review = new EventEmitter<void>();
  @Output() register = new EventEmitter<void>();
  @Output() openQuestion = new EventEmitter<string>();
  @Output() retry = new EventEmitter<ReviewItem>();
  /** Novo treino: simulado de uma área ou os erros prontos. */
  @Output() practice = new EventEmitter<PracticeRequest>();
  /** Retomar o treino ou a prova em andamento. */
  @Output() resume = new EventEmitter<string>();
  /** Tela de treinos (prova completa e treino montado). */
  @Output() practiceHub = new EventEmitter<void>();

  readonly examSource = EXAM_SOURCE;
  private readonly now = new Date();
  readonly greeting =
    this.now.getHours() < 5 || this.now.getHours() >= 18
      ? "Boa noite"
      : this.now.getHours() < 12
        ? "Bom dia"
        : "Boa tarde";
  readonly todayChip =
    "HOJE · " +
    new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric" })
      .format(this.now)
      .replace(".", "")
      .replace(",", "")
      .toUpperCase();
  readonly todayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(this.now)
    .replace("-feira", "")
    .toUpperCase();
  readonly weeks = this.weeksUntilExam();
  // Formato de 2026 para bacharelados (MASTER-SPEC §2). Revalidar por edição.
  readonly examParts = [
    { label: "Formação Geral", count: "15 objetivas", kind: "general", cells: range(0, 15) },
    { label: "Computação", count: "30 objetivas", kind: "specific", cells: range(15, 45) },
    { label: "Computação", count: "1 discursiva", kind: "essay", cells: range(45, 46) },
  ];

  catalog = signal<HomeCatalog | null>(null);
  notebook = signal<Notebook | null>(null);
  progress = signal<Progress | null>(null);
  private abort = new AbortController();

  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
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
  readyErrors() {
    return this.progress()?.errors.ready ?? 0;
  }
  active() {
    return this.progress()?.active ?? null;
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
    const ready = this.readyErrors();
    return (
      `Você respondeu ${answered} de ${total} questões do banco · ` +
      (ready === 0
        ? "nenhum erro pronto para revisar hoje"
        : ready === 1
          ? "1 erro pronto para revisar hoje"
          : `${ready} erros prontos para revisar hoje`)
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
  activeLabel() {
    const active = this.active();
    if (!active) return "";
    const kind = active.kind === "EDITION" ? "Prova completa" : active.area ? `Treino de ${active.area}` : "Treino";
    return `${kind} · ${active.answered} de ${active.size} respondidas${active.pausedAt ? " · pausado" : ""}`;
  }

  // Desempenho por área -------------------------------------------------------
  areas() {
    return this.progress()?.areas ?? [];
  }
  /**
   * Áreas em ordem de atenção: primeiro as medidas (pelo menos SMALL_SAMPLE
   * respostas), do menor para o maior acerto; depois as com poucas
   * respostas; por fim as ainda não estudadas, por nome.
   */
  ranked() {
    const rank = (row: AreaProgress) => (row.firstAttempts >= SMALL_SAMPLE ? 0 : row.firstAttempts ? 1 : 2);
    return [...this.areas()].sort((a, b) =>
      rank(a) - rank(b)
      || (rank(a) < 2 ? this.ratio(a.firstCorrect, a.firstAttempts) - this.ratio(b.firstCorrect, b.firstAttempts) : 0)
      || a.area.localeCompare(b.area, "pt-BR"),
    );
  }
  /** Quanto da área a pessoa já viu, de 0 a 1. */
  coverage(row: AreaProgress) {
    return this.ratio(Math.min(row.firstAttempts, row.published), row.published);
  }
  accuracy(row: AreaProgress) {
    return Math.round(100 * this.ratio(row.firstCorrect, row.firstAttempts));
  }
  smallSample(row: AreaProgress) {
    return row.firstAttempts > 0 && row.firstAttempts < SMALL_SAMPLE;
  }
  /** Área com menor acerto entre as que já têm amostra suficiente. */
  weakest() {
    const measured = this.areas().filter((row) => row.firstAttempts >= SMALL_SAMPLE);
    if (measured.length < 2) return null;
    return measured.reduce((low, row) =>
      row.firstCorrect / row.firstAttempts < low.firstCorrect / low.firstAttempts ? row : low,
    );
  }
  simulationSize(row: AreaProgress) {
    return Math.min(row.published, AREA_SIMULATION_LIMIT);
  }
  async simulate(row: AreaProgress) {
    const request = await chooseAreaSimulation(this.choice, row.area, row.published);
    if (request) this.practice.emit(request);
  }
  practiceErrors() {
    this.practice.emit({ area: null, focus: "ERRORS" });
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
  private async load() {
    const get = async <T>(path: string): Promise<T | null> => {
      try {
        const res = await fetch("/api/" + path, { signal: this.abort.signal });
        return res.ok ? ((await res.json()) as T) : null;
      } catch {
        return null;
      }
    };
    const [catalog, notebook, progress] = await Promise.all([
      get<HomeCatalog>("catalog?limit=1"),
      get<Notebook>("review?topic=&offset=0"),
      get<Progress>("me/progress"),
    ]);
    if (notebook) this.notebook.set(notebook);
    if (progress) this.progress.set(progress);
    if (catalog) this.catalog.set(catalog);
  }
}
