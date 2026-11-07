import { Component, EventEmitter, Input, Output, signal } from "@angular/core";
import { requestJson } from "./api-request";
import { libraryPath } from "./study-navigation";

// Na correção de uma questão, o conceito que ela cobra e o caminho para a
// lição (ou a área, se ainda não há lição). Liga o banco e o treino à
// Biblioteca; a ligação das oficiais foi conferida item a item (R4).

type QuestionConcept = { id: string; name: string; area: string; slug: string; lesson: boolean };

@Component({
  selector: "app-question-concepts",
  templateUrl: "./question-concepts.component.html",
  styleUrl: "./question-concepts.component.css",
})
export class QuestionConceptsComponent {
  @Input({ required: true }) versionId!: string;
  /** Caminho da Biblioteca a abrir (lição ou área). */
  @Output() open = new EventEmitter<string>();
  concepts = signal<QuestionConcept[]>([]);

  async ngOnChanges() {
    this.concepts.set([]);
    const id = this.versionId;
    try {
      const data = await requestJson<{ concepts: QuestionConcept[] }>(`/api/core/question/${encodeURIComponent(id)}`);
      if (id === this.versionId) this.concepts.set(data.concepts);
    } catch {
      // Complemento da correção: sem a ligação, a questão continua utilizável.
    }
  }

  go(c: QuestionConcept) {
    this.open.emit(libraryPath({ area: c.slug, lesson: c.lesson ? c.id : null, sheet: null }));
  }
}
