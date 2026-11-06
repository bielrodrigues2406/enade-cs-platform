import { Component, EventEmitter, Output, computed, signal } from "@angular/core";
import { requestJson } from "./api-request";
import type { CoreAreaSummary } from "./core.types";

// Mapa de confiança (NUC-1): as áreas do núcleo com o peso de cada uma nas
// provas de 2005 a 2021 e a confiança da pessoa. As três primeiras em
// prioridade (peso × o que falta saber) aparecem como "comece por aqui".

const FIRST = 3;

@Component({
  selector: "app-core-map",
  templateUrl: "./core-map.component.html",
  styleUrl: "./core-map.component.css",
})
export class CoreMapComponent {
  @Output() open = new EventEmitter<string>();
  areas = signal<CoreAreaSummary[] | null>(null);
  error = signal("");

  /** Específicas por peso histórico; a Formação Geral à parte. */
  specific = computed(() => (this.areas() ?? []).filter((a) => a.share !== null));
  general = computed(() => (this.areas() ?? []).find((a) => a.share === null) ?? null);
  firstSlugs = computed(() => new Set([...this.specific()]
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, FIRST).map((a) => a.slug)));
  maxShare = computed(() => Math.max(1, ...this.specific().map((a) => a.share ?? 0)));
  started = computed(() => this.specific().some((a) => a.confidence.value > 0));

  ngOnInit() { void this.load(); }

  async load() {
    this.error.set("");
    try {
      this.areas.set((await requestJson<{ areas: CoreAreaSummary[] }>("/api/core")).areas);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Não foi possível carregar o núcleo. Tente novamente.");
    }
  }

  /** Percentual com vírgula, como se escreve em português. */
  pct(value: number | null) {
    return (value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  }
  editionsWith(area: CoreAreaSummary) {
    return area.history.editions.filter((e) => e.count > 0).length;
  }
  rowLabel(area: CoreAreaSummary) {
    const first = this.firstSlugs().has(area.slug) ? ", comece por aqui" : "";
    return `${area.area}${first}: ${this.pct(area.share)}% das questões específicas, em ${this.editionsWith(area)} de 6 provas; confiança ${area.confidence.value} de 100`;
  }
  tone(value: number) {
    return value >= 70 ? "is-high" : value >= 40 ? "is-mid" : "is-low";
  }
}
