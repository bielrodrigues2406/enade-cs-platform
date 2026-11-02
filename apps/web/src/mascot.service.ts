import { Injectable, signal } from "@angular/core";

// A conta conserva a preferência entre dispositivos; visitantes usam este navegador.

const KEY = "enade.mascot";

@Injectable({ providedIn: "root" })
export class MascotService {
  readonly enabled = signal(read());
  private account = false;
  private generation = 0;

  /** Uma troca de identidade nunca reaproveita a preferência da conta anterior. */
  async sync(mode: "guest" | "account") {
    const generation = ++this.generation;
    this.account = mode === "account";
    this.enabled.set(this.account ? false : read());
    if (!this.account) return;
    try {
      const response = await fetch("/api/me/preferences");
      if (!response.ok) return;
      const data: { mascotEnabled: boolean } = await response.json();
      if (generation === this.generation) this.enabled.set(data.mascotEnabled);
    } catch { /* A preferência não impede estudar sem conexão. */ }
  }

  async set(enabled: boolean) {
    const generation = ++this.generation;
    if (this.account) {
      const response = await fetch("/api/me/preferences", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mascotEnabled: enabled }),
      });
      if (!response.ok) throw new Error("Não foi possível confirmar a preferência. Tente novamente.");
      if (generation === this.generation) this.enabled.set(enabled);
      return;
    }
    this.enabled.set(enabled);
    try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch { /* navegação privada: vale só nesta aba */ }
  }
}

function read() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
