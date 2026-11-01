import { Injectable, signal } from "@angular/core";

// Preferência "mostrar o mascote". Por enquanto fica no navegador; quando
// houver configuração na conta (ver docs/MASCOT.md, etapa 1), mover para lá.

const KEY = "enade.mascot";

@Injectable({ providedIn: "root" })
export class MascotService {
  readonly enabled = signal(read());

  set(enabled: boolean) {
    this.enabled.set(enabled);
    try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch { /* navegação privada: vale só nesta aba */ }
  }
}

function read() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
