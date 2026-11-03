import { Component, Input, signal } from "@angular/core";
import type { MascotMotion } from "./mascot.types";

type DuduLayer = "body" | "head" | "left-wing" | "right-wing" | "open-eyes" | "closed-eyes";

/** Camadas do mesmo personagem: os olhos acompanham a cabeça e as asas giram no ombro. */
@Component({
  selector: "app-dudu-figure",
  templateUrl: "./dudu-figure.component.html",
  styleUrl: "./dudu-figure.component.css",
  host: {
    "[class]": "'dudu dudu-' + gesture",
    "[class.ready]": "ready()",
    "[attr.role]": "label ? 'img' : null",
    "[attr.aria-label]": "label || null",
    "[attr.aria-hidden]": "label ? null : 'true'",
  },
})
export class DuduFigureComponent {
  @Input() gesture: MascotMotion = "none";
  @Input() fallback = "/mascot/contente.webp";
  @Input() label = "";
  readonly ready = signal(false);
  private loaded = new Set<DuduLayer>();
  private failed = false;

  async layerLoaded(layer: DuduLayer, event: Event) {
    try {
      // Download concluído não garante que o bitmap já possa aparecer no quadro.
      await (event.target as HTMLImageElement).decode();
      this.loaded.add(layer);
      this.ready.set(!this.failed && this.loaded.size === 6);
    } catch { this.layerFailed(); }
  }

  /** Uma camada ausente mantém a pose estática; o estudo continua disponível. */
  layerFailed() {
    this.failed = true;
    this.ready.set(false);
  }
}
