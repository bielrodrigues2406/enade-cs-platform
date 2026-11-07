import { Injectable, signal } from "@angular/core";

// Tema (PR G): "sistema" segue o aparelho pela media query do CSS; "claro" e
// "escuro" fixam o atributo data-theme em <html>. A escolha fica neste navegador.

export type Theme = "system" | "light" | "dark";
const KEY = "enade:theme";

@Injectable({ providedIn: "root" })
export class ThemeService {
  readonly theme = signal<Theme>(this.read());

  constructor() { this.apply(this.theme()); }

  set(theme: Theme) {
    this.theme.set(theme);
    this.apply(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* navegação privada: vale só nesta visita */ }
  }

  private apply(theme: Theme) {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }

  private read(): Theme {
    try {
      const value = localStorage.getItem(KEY);
      return value === "light" || value === "dark" ? value : "system";
    } catch {
      return "system";
    }
  }
}
