import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  inject,
  signal,
} from "@angular/core";

// Página pública (HOME-2): apresenta a preparação a quem ainda não entrou.
// Usa só dados reais do catálogo; nada de métricas, depoimentos ou contagens
// inventadas. O painel de quem já tem conta continua em home.component.

type Catalog = {
  total: number;
  summary: { total: number; official: number };
  facets: { areas: { name: string; count: number }[]; years: number[] };
  items: { id: string; title: string; origin: string; year: number | null }[];
};
type Edition = { year: number; total: number };
type Sheet = { url: string; title: string };

type Snapshot = { catalog: Catalog; editions: Edition[]; sheets: Sheet[] };
/**
 * Último conteúdo carregado, guardado enquanto a aba estiver aberta. Ao voltar
 * à página, ela aparece pronta na hora e só se atualiza em segundo plano,
 * sem piscar vazia.
 */
let lastSnapshot: Snapshot | null = null;

// Data de aplicação para bacharelados segundo o Inep (MASTER-SPEC §2).
const EXAM_DATE = new Date(2026, 10, 29);

@Component({
  selector: "app-landing",
  templateUrl: "./landing.component.html",
})
export class LandingComponent {
  @Output() start = new EventEmitter<void>();
  @Output() login = new EventEmitter<void>();
  @Output() register = new EventEmitter<void>();
  @Output() browseYear = new EventEmitter<number>();

  readonly demoOptions = [
    { letter: "A", text: "UDP" },
    { letter: "B", text: "IP" },
    { letter: "C", text: "ICMP" },
    { letter: "D", text: "TCP" },
    { letter: "E", text: "ARP" },
  ];
  readonly steps = [
    { title: "Escolha a área", text: "Filtre por área, edição ou trecho do enunciado. Cada questão mostra a prova de onde veio." },
    { title: "Responda sem pistas", text: "A questão aparece como na prova. O gabarito só aparece depois que você confirma." },
    { title: "Entenda o raciocínio", text: "Veja por que a alternativa certa está certa e por que as outras não estão." },
    { title: "Volte ao que errou", text: "O caderno de erros guarda as questões para você refazer com calma." },
  ];
  readonly pillars = [
    {
      title: "Banco por área",
      text: "Algoritmos, Redes, Teoria da computação, Banco de dados e as outras áreas da prova, com o assunto de cada questão.",
      icon: "M4 5h16M4 12h16M4 19h10",
      soon: false,
    },
    {
      title: "Treino com resultado",
      text: "Blocos de 10, 20 ou 30 questões ou a prova completa de uma edição, com tempo, pausa e resultado por área no final.",
      icon: "M5 4v16l14-8z",
      soon: false,
    },
    {
      title: "Caderno de erros",
      text: "As questões que você errou, por área, para voltar depois de estudar o conceito.",
      icon: "M6 3h9l3 3v15H6zM9 12l2 2 4-4",
      soon: false,
    },
    {
      title: "Aulas e presença",
      text: "Agenda das aulas de preparação, com professor, matéria e sala, e chamada pelo próprio sistema.",
      icon: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
      soon: false,
    },
  ];

  catalog = signal<Catalog | null>(null);
  editions = signal<Edition[]>([]);
  sheets = signal<Sheet[]>([]);
  demoStep = signal(0);
  private host = inject(ElementRef<HTMLElement>);
  private observer: IntersectionObserver | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private abort = new AbortController();
  private demoStarted = false;

  ngOnInit() {
    if (lastSnapshot) this.apply(lastSnapshot);
    void this.load();
  }
  ngAfterViewInit() {
    const root = this.host.nativeElement as HTMLElement;
    if (this.reducedMotion() || typeof IntersectionObserver === "undefined") {
      this.demoStep.set(5);
      return;
    }
    // Só esconde o que vai aparecer quando a animação está garantida.
    root.classList.add("motion-ready");
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          if (el.classList.contains("lp-demo")) this.startDemo();
          else el.classList.add("is-visible");
          this.observer?.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    this.observeReveals();
  }
  ngOnDestroy() {
    this.observer?.disconnect();
    this.timers.forEach(clearTimeout);
    this.abort.abort();
  }

  daysCount() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((EXAM_DATE.getTime() - today.getTime()) / 86400000);
    return days >= 0 ? days : null;
  }
  daysLeft() {
    const days = this.daysCount();
    if (days === null) return null;
    return days === 0 ? "é hoje" : days === 1 ? "falta 1 dia" : `faltam ${days} dias`;
  }
  areasCovered() {
    return this.catalog()?.facets.areas.filter((a) => a.count > 0 && a.name !== "Formação Geral").length ?? 0;
  }
  editionText(year: number) {
    if (year <= 2011) return "Caderno de Computação · Formação Geral e Ciência da Computação";
    return "Bacharelado em Ciência da Computação · Formação Geral e componente específico";
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
  // Hesita em B, escolhe D, confirma e mostra a correção com a caneta.
  private run() {
    const steps: [number, number][] = [[1, 500], [2, 1250], [3, 2050], [4, 2600], [5, 3400]];
    for (const [step, at] of steps)
      this.timers.push(setTimeout(() => this.demoStep.set(step), at));
  }
  private observeReveals() {
    const root = this.host.nativeElement as HTMLElement;
    root
      .querySelectorAll("[data-reveal]:not(.is-visible), .lp-demo")
      .forEach((el) => this.observer?.observe(el));
  }
  private reducedMotion() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  private async get<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch("/api/" + path, { signal: this.abort.signal });
      return res.ok ? ((await res.json()) as T) : null;
    } catch {
      return null;
    }
  }
  private apply(snapshot: Snapshot) {
    this.catalog.set(snapshot.catalog);
    this.editions.set(snapshot.editions);
    this.sheets.set(snapshot.sheets);
  }
  private async load() {
    const catalog = await this.get<Catalog>("catalog?limit=12");
    if (!catalog) return;
    const years = [...catalog.facets.years].sort((a, b) => b - a);
    const byYear = await Promise.all(
      years.map((year) => this.get<{ total: number; items: Catalog["items"] }>(`catalog?year=${year}&limit=1`)),
    );
    const editions = years.map((year, i) => ({ year, total: byYear[i]?.total ?? 0 })).filter((e) => e.total);
    // Catálogo e edições entram juntos: sem o intervalo em que a lista parecia vazia.
    this.catalog.set(catalog);
    this.editions.set(editions);
    // Três páginas reais da prova empilhadas no herói, de edições diferentes.
    const picks = byYear.flatMap((page) => page?.items.slice(0, 1) ?? [])
      .filter((item) => item.origin === "OFFICIAL").slice(0, 3).reverse();
    const details = await Promise.all(
      picks.map((item) => this.get<{ title: string; images?: { url: string }[] }>(`questions/${encodeURIComponent(item.id)}`)),
    );
    const sheets = details.flatMap((d) => (d?.images?.[0] ? [{ url: d.images[0].url, title: d.title }] : []));
    // Mantém as folhas já mostradas se a nova busca falhar.
    if (sheets.length || !this.sheets().length) this.sheets.set(sheets);
    lastSnapshot = { catalog, editions, sheets: this.sheets() };
    // Linhas que chegaram depois do primeiro desenho também se revelam.
    queueMicrotask(() => setTimeout(() => this.observeReveals(), 0));
  }
}
