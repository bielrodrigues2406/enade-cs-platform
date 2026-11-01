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
  const response = await fetch("/api/" + path, {
    method, headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Verifique a conexão e tente novamente.");
  return data as T;
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

  /** Recarrega; chamadas seguidas viram uma só. Falha silenciosa: é enfeite, não bloqueia o estudo. */
  refresh() {
    this.pending ??= call<Engagement>("me/engagement")
      .then((data) => this.state.set(data))
      .catch(() => undefined)
      .finally(() => { this.pending = null; });
    return this.pending;
  }

  async setGoal(dailyTarget: number) {
    this.state.set(await call<Engagement>("me/goal", "PUT", { dailyTarget }));
  }

  /** O aviso já apareceu: marca no servidor e tira o "novo" localmente. */
  async markSeen() {
    const s = this.state();
    if (s) this.state.set({ ...s, achievements: s.achievements.map((a) => ({ ...a, isNew: false })) });
    await call("me/achievements/seen", "POST", {}).catch(() => undefined);
  }

  clear() {
    this.state.set(null);
  }
}
