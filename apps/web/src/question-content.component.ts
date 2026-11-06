import { Component, Input } from "@angular/core";
import { originLabel } from "./origin-label";

export type QuestionContent = {
  id: string;
  title: string;
  topic: string;
  subject?: string | null;
  origin: string;
  authorCredit: string;
  demonstration: boolean;
  versionNumber: number;
  prompt: string;
  options: { id: string; text: string }[];
  presentation?: "TEXT" | "IMAGE";
  images?: { url: string; width: number; height: number; page: number }[];
  reviewOrigin?: "HUMAN" | "ASSISTED";
  provenance: {
    exam: { year: number; area: string; modality: string; officialUrl: string; title: string };
    page: number;
    questionNumber: number;
  } | null;
};

export function promptBlocks(prompt: string) {
  return prompt.split(/^```[a-z]*\n?/m).map((text, i) => ({ code: i % 2 === 1, text: text.replace(/\n+$/, "").replace(/^\n+/, "") }))
    .filter((block) => block.text);
}

// Shared public content only: no selected answer, key or explanation belongs here.
@Component({
  selector: "app-question-content",
  templateUrl: "./question-content.component.html",
})
export class QuestionContentComponent {
  @Input({ required: true }) question!: QuestionContent;

  /** Enunciado em texto: trechos entre ``` são código e mantêm a fonte e a indentação. */
  promptBlocks() {
    return promptBlocks(this.question.prompt);
  }

  isImage() {
    return this.question.presentation === "IMAGE" && !!this.question.images?.length;
  }
  originLabel(origin: string, demonstration = false) {
    return originLabel(origin, demonstration);
  }
  modalityLabel(modality: string) {
    return ({ BACHARELADO: "Bacharelado", LICENCIATURA: "Licenciatura", CST: "Curso superior de tecnologia", COMUM: "Caderno compartilhado" } as Record<string, string>)[modality] || modality;
  }
  imageAlt(index: number) {
    const q = this.question;
    const parts = q.images!.length;
    return `Questão ${q.provenance?.questionNumber ?? ""} da prova ENADE ${q.provenance?.exam.year ?? ""}` +
      (parts > 1 ? `, parte ${index + 1} de ${parts}` : "") +
      ". O texto está na transcrição automática abaixo.";
  }
}
