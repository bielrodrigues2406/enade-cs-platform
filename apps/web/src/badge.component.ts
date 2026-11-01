import { Component, Input } from "@angular/core";

// Medalha de conquista (ENG-1): aro e face na cor do nível, símbolo desenhado
// em traço. Ícones próprios (24×24, traço), sem biblioteca externa.

const GLYPHS: Record<string, string[]> = {
  spark: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "M6 6l2.5 2.5", "M15.5 15.5L18 18", "M18 6l-2.5 2.5", "M8.5 15.5L6 18"],
  target: ["M4 12a8 8 0 1 0 16 0a8 8 0 1 0 -16 0", "M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0", "M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"],
  flame: ["M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1.2 2.6 2.5 3 0-3-.5-5.5 0-8z"],
  stack: ["M4 8l8-4 8 4-8 4-8-4z", "M4 12l8 4 8-4", "M4 16l8 4 8-4"],
  crown: ["M4 18h16", "M5 18l-1-10 5 4 3-7 3 7 5-4-1 10"],
  compass: ["M4 12a8 8 0 1 0 16 0a8 8 0 1 0 -16 0", "M15.5 8.5l-2 5-5 2 2-5 5-2z"],
  loop: ["M5 11a7 7 0 0 1 12.5-4.3", "M18 3v4h-4", "M19 13a7 7 0 0 1-12.5 4.3", "M6 21v-4h4"],
  trophy: ["M8 4h8v5a4 4 0 0 1-8 0V4z", "M8 6H5a3 3 0 0 0 3 4", "M16 6h3a3 3 0 0 1-3 4", "M12 13v4", "M8 20h8", "M9.5 17h5"],
  pen: ["M4 20l4-1 11-11-3-3L5 16l-1 4z", "M14 6l3 3"],
  cards: ["M8 5h11v14H8z", "M5 8v12h11"],
};

@Component({
  selector: "app-badge",
  templateUrl: "./badge.component.html",
  styleUrl: "./badge.component.css",
  host: { "[class]": "'badge tier-' + tier", "[class.is-locked]": "locked", "aria-hidden": "true" },
})
export class BadgeComponent {
  @Input() icon = "spark";
  @Input() tier: "bronze" | "silver" | "gold" = "bronze";
  @Input() locked = false;
  glyph() {
    return GLYPHS[this.icon] ?? GLYPHS["spark"];
  }
}
