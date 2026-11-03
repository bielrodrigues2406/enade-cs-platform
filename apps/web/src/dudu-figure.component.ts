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

  layerLoaded(layer: DuduLayer) {
    this.loaded.add(layer);
    this.ready.set(!this.failed && this.loaded.size === 6);
  }

  /** Uma camada ausente mantém a pose estática; o estudo continua disponível. */
  layerFailed() {
    this.failed = true;
    this.ready.set(false);
  }
}
