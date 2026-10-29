import { Component, Input } from "@angular/core";

export type QuestionContent = {
  id: string;
  title: string;
  topic: string;
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

// Shared public content only: no selected answer, key or explanation belongs here.
@Component({
  selector: "app-question-content",
  template: `
    <p class="metadata">
      {{ question.topic }} <span>·</span>
      {{ originLabel(question.origin, question.demonstration) }}
      <span>·</span> Versão {{ question.versionNumber }}
    </p>
    <p class="metadata question-credit">
      {{ question.origin === "OFFICIAL" ? "Fonte" : "Autoria" }}:
      {{ question.authorCredit }}
    </p>
    <h1>{{ question.title }}</h1>
    @if (question.provenance) {
      <section
        class="question-provenance"
        aria-label="Fonte da questão"
      >
        <p>
          Edição {{ question.provenance!.exam.year }} ·
          {{ question.provenance!.exam.area }} ·
          {{ modalityLabel(question.provenance!.exam.modality) }}
        </p>
        <p>
          Questão {{ question.provenance!.questionNumber }} ·
          página {{ question.provenance!.page }}
        </p>
        <a
          [href]="question.provenance!.exam.officialUrl"
          target="_blank"
          rel="noopener noreferrer"
          >Prova oficial: {{ question.provenance!.exam.title }}</a
        >
      </section>
    }
    @if (isImage()) {
      <figure class="question-sheet">
        <div class="question-images">
          @for (
            image of question.images!;
            track image.url;
            let i = $index
          ) {
            <!-- Escala de impressão: 200 dpi ≈ 1,9 px por px CSS. -->
            <img
              [src]="image.url"
              [width]="image.width"
              [height]="image.height"
              [style.width.px]="image.width / 1.9"
              [attr.loading]="i ? 'lazy' : null"
              decoding="async"
              [alt]="imageAlt(i)"
              (click)="zoom.showModal()"
            />
          }
        </div>
        <figcaption>
          <span
            >Recorte da prova original{{
              question.images!.length > 1
                ? ", em " + question.images!.length + " partes"
                : ""
            }}.</span
          >
          <button
            type="button"
            class="text-button"
            (click)="zoom.showModal()"
          >
            Ampliar
          </button>
        </figcaption>
      </figure>
      <dialog
        #zoom
        class="zoom"
        aria-label="Questão ampliada"
        (click)="$event.target === zoom && zoom.close()"
      >
        <div class="zoom-bar">
          <span>{{ question.title }}</span>
          <button type="button" class="outline" (click)="zoom.close()">
            Fechar
          </button>
        </div>
        <div
          class="zoom-body"
          (click)="$event.target === $event.currentTarget && zoom.close()"
        >
          @for (image of question.images!; track image.url) {
            <img
              [src]="image.url"
              [width]="image.width"
              [height]="image.height"
              [style.--image-width]="image.width"
              alt=""
            />
          }
        </div>
      </dialog>
      @if (question.reviewOrigin === "ASSISTED") {
        <p class="assisted-label">
          Transcrição automatizada do PDF oficial, conferida por
          agentes; sem revisão humana. Em caso de diferença, vale a
          imagem.
        </p>
      }
      <details class="transcription">
        <summary>Transcrição automática do enunciado</summary>
        <p>{{ question.prompt || "Sem transcrição." }}</p>
        @for (option of question.options; track option.id) {
          @if (option.text) {
            <p><strong>{{ option.id }}</strong> {{ option.text }}</p>
          }
        }
      </details>
    } @else {
      <p class="prompt">{{ question.prompt }}</p>
    }
  `,
})
export class QuestionContentComponent {
  @Input({ required: true }) question!: QuestionContent;

  isImage() {
    return this.question.presentation === "IMAGE" && !!this.question.images?.length;
  }
  originLabel(origin: string, demonstration = false) {
    return origin === "OFFICIAL" ? "Oficial · Inep" : demonstration ? "Autoral demonstrativa" : "Autoral";
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
