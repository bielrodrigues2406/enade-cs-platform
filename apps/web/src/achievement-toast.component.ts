import { Component, effect, inject, signal, untracked } from "@angular/core";
import { BadgeComponent } from "./badge.component";
import { EngagementService, type AchievementView } from "./engagement.service";

// Aviso animado (ENG-1): a medalha entra girando com brilho quando uma
// conquista é desbloqueada, e um aviso mais simples quando a meta do dia é
// batida. Um de cada vez; some sozinho ou no X.

type Toast = { kind: "achievement"; achievement: AchievementView } | { kind: "goal"; goal: number; streak: number };
const VISIBLE_MS = 5200;

@Component({
  selector: "app-achievement-toast",
  imports: [BadgeComponent],
  templateUrl: "./achievement-toast.component.html",
  styleUrl: "./achievement-toast.component.css",
})
export class AchievementToastComponent {
  private engagement = inject(EngagementService);
  readonly current = signal<Toast | null>(null);
  private queue: Toast[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastToday: number | null = null;

  constructor() {
    effect(() => {
      const state = this.engagement.state();
      const fresh = this.engagement.fresh();
      untracked(() => {
        if (!state) { this.lastToday = null; return; }
        // Meta batida agora (não ao abrir a página com ela já batida).
        if (this.lastToday !== null && this.lastToday < state.goal && state.today >= state.goal)
          this.queue.push({ kind: "goal", goal: state.goal, streak: state.streak });
        this.lastToday = state.today;
        for (const achievement of fresh)
          if (!this.queue.some((t) => t.kind === "achievement" && t.achievement.code === achievement.code))
            this.queue.push({ kind: "achievement", achievement });
        if (fresh.length) void this.engagement.markSeen();
        if (!this.current()) this.next();
      });
    });
  }

  next() {
    if (this.timer) clearTimeout(this.timer);
    const toast = this.queue.shift() ?? null;
    this.current.set(toast);
    if (toast) this.timer = setTimeout(() => this.next(), VISIBLE_MS);
  }
}
