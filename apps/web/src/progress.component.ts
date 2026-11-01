import { Component, EventEmitter, Input, Output, computed, inject, signal } from "@angular/core";
import { BadgeComponent } from "./badge.component";
import { EngagementService } from "./engagement.service";
import { initials } from "./initials";

// Conquistas (ENG-1): sequência, meta diária, calendário das últimas quatro
// semanas, medalhas e ranking de constância. O ranking conta dias de estudo,
// nunca acerto, para não expor nem constranger quem está começando.

type RankingRow = { position: number; name: string; days7: number; days30: number; me: boolean };
type Ranking = { top: RankingRow[]; me: { position: number | null; days7: number; days30: number } | null; visible: boolean; canJoin: boolean };

const GOALS = [3, 5, 10, 15, 20];
const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];
const RING = 2 * Math.PI * 52;

@Component({
  selector: "app-progress",
  imports: [BadgeComponent],
  templateUrl: "./progress.component.html",
  styleUrl: "./progress.component.css",
})
export class ProgressComponent {
  @Input() sessionMode: "guest" | "account" = "guest";
  @Output() study = new EventEmitter<void>();
  @Output() register = new EventEmitter<void>();
  readonly engagement = inject(EngagementService);
  readonly goals = GOALS;
  readonly weekdays = WEEKDAYS;
  readonly ring = RING;
  ranking = signal<Ranking | null>(null);
  savingGoal = signal(false);
  error = signal("");

  readonly ringOffset = computed(() => {
    const s = this.engagement.state();
    return RING * (1 - (s ? Math.min(1, s.today / Math.max(1, s.goal)) : 0));
  });
  readonly unlocked = computed(() => (this.engagement.state()?.achievements ?? []).filter((a) => a.unlockedAt));
  readonly locked = computed(() => (this.engagement.state()?.achievements ?? []).filter((a) => !a.unlockedAt));
  /** Os 28 dias em semanas de segunda a domingo, com espaços antes do primeiro dia. */
  readonly calendar = computed(() => {
    const days = this.engagement.state()?.days ?? [];
    if (!days.length) return [];
    const first = new Date(`${days[0].day}T12:00:00Z`).getUTCDay();
    const pad = (first + 6) % 7;
    return [...Array.from({ length: pad }, () => null), ...days];
  });

  ngOnInit() {
    void this.engagement.refresh();
    void this.loadRanking();
  }

  async loadRanking() {
    try {
      const response = await fetch("/api/ranking");
      if (response.ok) this.ranking.set(await response.json());
    } catch { /* o ranking é complementar: sem ele, a página continua */ }
  }

  async chooseGoal(goal: number) {
    if (this.savingGoal()) return;
    this.savingGoal.set(true);
    this.error.set("");
    try {
      await this.engagement.setGoal(goal);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Não foi possível salvar a meta.");
    } finally {
      this.savingGoal.set(false);
    }
  }

  /** Quem está fora dos 20 primeiros ainda vê a própria posição, abaixo da lista. */
  myRowOutsideTop(r: Ranking) {
    const position = r.me?.position;
    if (!r.me || !position || r.top.some((row) => row.me)) return null;
    return { position, days7: r.me.days7, days30: r.me.days30 };
  }

  async toggleRanking(visible: boolean) {
    const response = await fetch("/api/me/ranking", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visible }),
    });
    if (response.ok) await this.loadRanking();
  }

  avatar(name: string) {
    return initials(name);
  }
  dayLabel(day: string) {
    return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  }
  dateLabel(iso: string) {
    return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(new Date(iso)).replace(".", "");
  }
  /** Sete pontos da semana: preenchidos conforme os dias estudados. */
  weekDots(days: number) {
    return Array.from({ length: 7 }, (_, i) => i < days);
  }
}
