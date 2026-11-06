import { requestJson } from "./api-request";
import { Injectable, computed, signal } from "@angular/core";

// Meta diária, sequência e conquistas (ENG-1). Um único estado para o topo
// (anel da meta), o aviso de conquista e as páginas que mostram progresso.
// Atualiza depois de responder, finalizar treino ou revisar flashcards.

export type Tier = "bronze" | "silver" | "gold";
export type AchievementView = {
  code: string; title: string; description: string; icon: string; tier: Tier;
  unlockedAt: string | null; isNew: boolean; progress: { value: number; target: number } | null;
};
export type Engagement = {
  goal: number; today: number; streak: number; best: number;
  days: { day: string; count: number; met: boolean; forgiven: boolean }[];
  achievements: AchievementView[];
};

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  return requestJson<T>("/api/" + path, {
    method, headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

@Injectable({ providedIn: "root" })
export class EngagementService {
  readonly state = signal<Engagement | null>(null);
  /** Conquistas desbloqueadas que ainda não ganharam o aviso animado. */
  readonly fresh = computed(() => this.state()?.achievements.filter((a) => a.isNew) ?? []);
  readonly goalMet = computed(() => {
    const s = this.state();
    return Boolean(s && s.today >= s.goal);
  });
  private pending: Promise<void> | null = null;
  private generation = 0;

  /** Recarrega; chamadas seguidas viram uma só. Falha silenciosa: é enfeite, não bloqueia o estudo. */
  refresh() {
    if (this.pending) return this.pending;
    const generation = this.generation;
    const pending = call<Engagement>("me/engagement")
      .then((data) => { if (generation === this.generation) this.state.set(data); })
      .catch(() => undefined)
      .finally(() => { if (this.pending === pending) this.pending = null; });
    this.pending = pending;
    return pending;
  }

  async setGoal(dailyTarget: number) {
    const generation = this.generation;
    const data = await call<Engagement>("me/goal", "PUT", { dailyTarget });
    if (generation === this.generation) this.state.set(data);
  }

  /** O aviso já apareceu: marca no servidor e tira o "novo" localmente. */
  async markSeen() {
    const s = this.state();
    if (s) this.state.set({ ...s, achievements: s.achievements.map((a) => ({ ...a, isNew: false })) });
    await call("me/achievements/seen", "POST", {}).catch(() => undefined);
  }

  clear() {
    // Leituras e alterações da sessão anterior podem terminar depois do cadastro/login.
    this.generation++;
    this.pending = null;
    this.state.set(null);
  }
}
