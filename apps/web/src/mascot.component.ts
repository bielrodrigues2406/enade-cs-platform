import { Component, Input, computed, inject, signal } from "@angular/core";
import { MascotService } from "./mascot.service";
import { DuduFigureComponent } from "./dudu-figure.component";
import type { MascotMotion } from "./mascot.types";

// Mascote Dudu, o pato de borracha (ver docs/MASCOT.md). Uma pose por
// momento: comemorar, telas vazias, carregar, erro. Nunca durante a
// resolução de uma questão e nunca com dica da resposta.

export type MascotPose =
  | "acenando" | "comemorando" | "sequencia" | "medalha" | "ouvindo" | "contente" | "lupa"
  | "relogio" | "cartoes" | "dormindo" | "lendo" | "em-obras" | "boiando" | "bug";

/** Texto alternativo de cada pose, para quando a imagem não é só decoração. */
export const MASCOT_ALT: Record<MascotPose, string> = {
  acenando: "Dudu, o pato, acenando",
  comemorando: "Dudu comemorando",
  sequencia: "Dudu com uma chama acesa sobre a cabeça",
  medalha: "Dudu segurando uma medalha",
  ouvindo: "Dudu ouvindo com atenção",
  contente: "Dudu contente",
  lupa: "Dudu olhando por uma lupa",
  relogio: "Dudu olhando o relógio",
  cartoes: "Dudu abraçando cartões de estudo",
  dormindo: "Dudu dormindo",
  lendo: "Dudu de óculos, lendo um livro",
  "em-obras": "Dudu de capacete, em obras",
  boiando: "Dudu boiando na água",
  bug: "Dudu com um besourinho na cabeça",
};

@Component({
  selector: "app-mascot",
  imports: [DuduFigureComponent],
  templateUrl: "./mascot.component.html",
  styleUrl: "./mascot.component.css",
  host: { "[class]": "'mascot mascot-' + motion", "[style.--mascot-size]": "size + 'px'", "[hidden]": "!visible()" },
})
export class MascotComponent {
  private prefs = inject(MascotService);
  private _pose = signal<MascotPose>("contente");
  readonly imageReady = signal(false);
  @Input() set pose(value: MascotPose) {
    if (value === this._pose()) return;
    this.imageReady.set(false);
    this._pose.set(value);
  }
  get pose() { return this._pose(); }
  /** Largura em px; a altura acompanha a proporção da imagem. */
  @Input() size = 96;
  /** Gestos únicos; só "bob" se repete, enquanto algo carrega. */
  @Input() motion: MascotMotion = "pop";
  /** Decorativo (padrão): o texto ao lado já diz tudo e o leitor de tela pula a imagem. */
  @Input() decorative = true;

  src = computed(() => `/mascot/${this._pose()}.webp`);
  alt = computed(() => (this.decorative ? "" : MASCOT_ALT[this._pose()]));
  visible = this.prefs.enabled;
  readonly articulated = computed(() => this.visible()
    && ["acenando", "contente", "ouvindo", "comemorando"].includes(this._pose()));
}
