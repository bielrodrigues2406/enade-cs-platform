import { Component, EventEmitter, Output, computed, inject } from "@angular/core";
import { EngagementService } from "./engagement.service";

// Anel da meta diária no topo (ENG-1): enche conforme as questões do dia; ao
// lado, a chama com a sequência. Abre a página de conquistas.

const RADIUS = 13;
export const RING_LENGTH = 2 * Math.PI * RADIUS;

@Component({
  selector: "app-goal-ring",
  templateUrl: "./goal-ring.component.html",
  styleUrl: "./goal-ring.component.css",
})
export class GoalRingComponent {
  @Output() open = new EventEmitter<void>();
  readonly engagement = inject(EngagementService);
  readonly radius = RADIUS;
  readonly length = RING_LENGTH;
  readonly offset = computed(() => {
    const s = this.engagement.state();
    const ratio = s ? Math.min(1, s.today / Math.max(1, s.goal)) : 0;
    return RING_LENGTH * (1 - ratio);
  });
  label() {
    const s = this.engagement.state();
    if (!s) return "Meta do dia";
    const streak = s.streak === 1 ? "1 dia seguido" : `${s.streak} dias seguidos`;
    return `Meta do dia: ${Math.min(s.today, s.goal)} de ${s.goal} questões. ${streak}. Abrir conquistas`;
  }
}
