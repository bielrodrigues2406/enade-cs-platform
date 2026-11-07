import { Injectable, signal } from "@angular/core";

// Continuar de onde parou (PR G): a última questão aberta fora de treino e a
// última lição lida. Fica só neste navegador, separado por conta ou visitante;
// treinos e provas em andamento já vêm do servidor ("Em andamento" no início).

export type ResumePlace =
  | { kind: "question"; id: string; title: string; at: number }
  | { kind: "lesson"; slug: string; concept: string; title: string; area: string; at: number };
type NewPlace = ResumePlace extends infer P ? (P extends ResumePlace ? Omit<P, "at"> : never) : never;

const PREFIX = "enade:resume:";

@Injectable({ providedIn: "root" })
export class ResumeService {
  readonly last = signal<ResumePlace | null>(null);
  private key: string | null = null;

  /** Troca o dono (conta ou visitante) e lê o que ele deixou neste navegador. */
  scope(owner: string | null) {
    this.key = owner ? PREFIX + owner : null;
    this.last.set(this.read());
  }

  record(place: NewPlace) {
    const value = { ...place, at: Date.now() } as ResumePlace;
    this.last.set(value);
    if (!this.key) return;
    try { localStorage.setItem(this.key, JSON.stringify(value)); } catch { /* navegação privada: fica só na memória */ }
  }

  private read(): ResumePlace | null {
    if (!this.key) return null;
    try {
      const value = JSON.parse(localStorage.getItem(this.key) ?? "null");
      return value && (value.kind === "question" || value.kind === "lesson") && typeof value.title === "string" ? value : null;
    } catch {
      return null;
    }
  }
}
