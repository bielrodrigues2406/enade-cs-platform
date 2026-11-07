import { Injectable, computed, signal } from "@angular/core";
import { requestJson } from "./api-request";

// Novidades (NEWS-1): o que mudou na plataforma, com o que esta identidade já
// viu guardado no servidor. Falha silenciosa: é aviso, não bloqueia o estudo.

export type NewsDestination = "inicio" | "questoes" | "geradas" | "biblioteca" | "flashcards" | "conquistas" | "provas" | "treino";
export type NewsItem = {
  id: string; date: string; title: string; summary: string; seen: boolean;
  action: { label: string; destination: NewsDestination } | null;
};
type NewsState = { items: NewsItem[]; unseen: number; autoOpen: boolean };

@Injectable({ providedIn: "root" })
export class NewsService {
  readonly state = signal<NewsState | null>(null);
  readonly open = signal(false);
  readonly unseen = computed(() => this.state()?.unseen ?? 0);
  /** O aviso automático abre no máximo uma vez por carga da identidade. */
  private autoShown = false;
  private generation = 0;

  refresh() {
    const generation = ++this.generation;
    this.autoShown = false;
    return requestJson<NewsState>("/api/news")
      .then((data) => { if (generation === this.generation) this.state.set(data); })
      .catch(() => undefined);
  }

  show() { this.open.set(true); }

  /** Chamado pelo shell no início: abre sozinho se há novidade e a pessoa já estudou. */
  offerOnce() {
    if (this.autoShown || !this.state()?.autoOpen) return;
    this.autoShown = true;
    this.open.set(true);
  }

  /** Ao fechar, as que estavam marcadas como novas passam a vistas. */
  async close() {
    this.open.set(false);
    const ids = (this.state()?.items ?? []).filter((n) => !n.seen).map((n) => n.id);
    if (!ids.length) return;
    this.state.update((s) => s && { items: s.items.map((n) => ({ ...n, seen: true })), unseen: 0, autoOpen: false });
    try {
      this.state.set(await requestJson<NewsState>("/api/news/seen", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
      }));
    } catch { /* Se não gravou, volta a aparecer na próxima carga. */ }
  }
}
