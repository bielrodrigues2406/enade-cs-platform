import { Component, Input, signal } from "@angular/core";
import type { MascotEyes, MascotMotion } from "./mascot.types";

/** Peças na ordem de desenho; todas ocupam o mesmo palco 3:4, então já vêm alinhadas. */
const FEET = ["foot-left", "foot-right"] as const;
const UPPER = ["wing-left", "wing-right", "body"] as const;
const FACE = ["head", "eyes-open", "eyes-happy", "eyes-closed"] as const;
type DuduLayer = (typeof FEET)[number] | (typeof UPPER)[number] | (typeof FACE)[number];
const LAYER_COUNT = FEET.length + UPPER.length + FACE.length;

/** Dudu em camadas: asas giram no ombro, a cabeça leva os olhos e os pés ficam no chão. */
@Component({
  selector: "app-dudu-figure",
  templateUrl: "./dudu-figure.component.html",
  styleUrl: "./dudu-figure.component.css",
  host: {
    "[class]": "'dudu dudu-' + gesture + ' rest-' + eyes",
    "[class.ready]": "ready()",
    "[attr.role]": "label ? 'img' : null",
    "[attr.aria-label]": "label || null",
    "[attr.aria-hidden]": "label ? null : 'true'",
  },
})
export class DuduFigureComponent {
  @Input() gesture: MascotMotion = "none";
  @Input() eyes: MascotEyes = "open";
  @Input() label = "";
  readonly feet = FEET;
  readonly upper = UPPER;
  readonly face = FACE;
  readonly ready = signal(false);
  private loaded = new Set<DuduLayer>();
  private failed = false;

  /** Repouso pré-montado com as mesmas camadas: a troca para a versão animada não aparece. */
  get restSrc() { return `/mascot/articulated/rest-${this.eyes}.webp`; }
  layerSrc(layer: DuduLayer) { return `/mascot/articulated/${layer}.webp`; }

  async layerLoaded(layer: DuduLayer, event: Event) {
    try {
      // Download concluído não garante que o bitmap já possa aparecer no quadro.
      await (event.target as HTMLImageElement).decode();
      this.loaded.add(layer);
      this.ready.set(!this.failed && this.loaded.size === LAYER_COUNT);
    } catch { this.layerFailed(); }
  }

  /** Uma camada ausente mantém o repouso estático; o estudo continua disponível. */
  layerFailed() {
    this.failed = true;
    this.ready.set(false);
  }
}
