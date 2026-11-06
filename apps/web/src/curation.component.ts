import { requestJson } from "./api-request";
import { Component, EventEmitter, HostListener, Output, signal } from "@angular/core";
import { FormsModule, type NgForm } from "@angular/forms";
import { SourcesComponent, type OfficialSource } from "./sources.component";
import { QuestionImportsComponent } from "./question-imports.component";
type OfficialProvenance = {
  examSourceId: string;
  keySourceId: string;
  page: number;
  questionNumber: number;
  keyPage: number;
};

type EditorialStatus = "DRAFT" | "IN_REVIEW" | "REJECTED" | "PUBLISHED";
type EditorialRow = {
  questionId: string;
  id: string;
  title: string;
  topic: string;
  origin: "AUTHOR_CREATED" | "OFFICIAL";
  editorialStatus: EditorialStatus;
  sequence: number;
  revision: number;
  authorCredit: string;
  currentVersionId: string | null;
  canReview: boolean;
  isAuthor: boolean;
};
type EditorialDetail = EditorialRow & {
  prompt: string;
  explanation: string;
  correctOptionId: string;
  options: { id: string; text: string }[];
  reviewNote: string | null;
  explanationCredit: string;
  provenance: OfficialProvenance | null;
};
type EditorialPage = { items: EditorialRow[]; total: number; offset: number; limit: number };
const QUEUE_PAGE_SIZE = 20;
type Draft = Pick<
  EditorialDetail,
  | "title"
  | "topic"
  | "prompt"
  | "authorCredit"
  | "explanation"
  | "correctOptionId"
  | "options"
  | "origin"
  | "explanationCredit"
  | "provenance"
>;
const emptyDraft = (
  origin: "AUTHOR_CREATED" | "OFFICIAL" = "AUTHOR_CREATED",
): Draft => ({
  origin,
  explanationCredit: "",
  provenance:
    origin === "OFFICIAL"
      ? {
          examSourceId: "",
          keySourceId: "",
          page: 1,
          questionNumber: 1,
          keyPage: 1,
        }
      : null,
  title: "",
  topic: "",
  prompt: "",
  authorCredit: origin === "OFFICIAL" ? "Inep" : "",
  explanation: "",
  correctOptionId: "",
  options: ["a", "b", "c", "d"].map((id) => ({ id: `option-${id}`, text: "" })),
});

@Component({
  selector: "app-curation",
  imports: [FormsModule, SourcesComponent, QuestionImportsComponent],
  templateUrl: "./curation.component.html",
  styleUrl: "./curation.component.css",
})
export class CurationComponent {
  @Output() busyChange = new EventEmitter<boolean>();
  rows = signal<EditorialRow[]>([]);
  queueTotal = signal(0);
  queueOffset = signal(0);
  readonly queuePageSize = QUEUE_PAGE_SIZE;
  answerError = signal("");
  sourceView = signal(false);
  importView = signal(false);
  sourceBusy = signal(false);
  sourceLoading = signal(false);
  sources = signal<OfficialSource[]>([]);
  detail = signal<EditorialDetail | null>(null);
  editing = signal(false);
  loading = signal(false);
  busy = signal(false);
  error = signal("");
  notice = signal("");
  discard = signal(false);
  confirmPublication = signal(false);
  draft = emptyDraft();
  reviewNote = "";
  checks = { content: false, answer: false, credit: false, source: false };
  readonly letters = "ABCDE";
  private active = true;
  private sequence = 0;
  private savedDraft = "";
  private abort = new AbortController();
  private requestedOffset = 0;
  constructor() {
    void this.loadQueue();
  }
  ngOnDestroy() {
    this.active = false;
    this.sequence++;
    this.abort.abort();
    this.busyChange.emit(false);
  }
  @HostListener("input")
  @HostListener("change")
  changed() {
    this.emitBusy();
  }
  @HostListener("window:beforeunload", ["$event"])
  beforeUnload(event: BeforeUnloadEvent) {
    if (this.busy() || this.sourceBusy() || this.hasUnsavedChanges()) event.preventDefault();
  }
  private hasUnsavedChanges() {
    return this.editing() && (
      this.hasChanges() || this.reviewNote !== "" || Object.values(this.checks).some(Boolean)
    );
  }
  private emitBusy() {
    this.busyChange.emit(this.busy() || this.sourceBusy() || this.hasUnsavedChanges());
  }
  private async api<T>(path: string, init?: RequestInit): Promise<T> {
    return requestJson<T>("/api/curation/" + path, {
      ...init,
      headers: { "Content-Type": "application/json" },
      signal: this.abort.signal,
    });
  }
  statusLabel(status: EditorialStatus) {
    return {
      DRAFT: "Rascunho",
      IN_REVIEW: "Em revisão",
      REJECTED: "Ajustes solicitados",
      PUBLISHED: "Publicada",
    }[status];
  }
  editable() {
    return (
      !this.detail() ||
      ["DRAFT", "REJECTED"].includes(this.detail()!.editorialStatus)
    );
  }
  hasChanges() {
    return JSON.stringify(this.draft) !== this.savedDraft;
  }
  validReviewNote() {
    const count = [...this.reviewNote.trim()].length;
    return count >= 10 && count <= 2000;
  }
  canPublish() {
    return (
      this.validReviewNote() &&
      this.checks.content &&
      this.checks.answer &&
      this.checks.credit &&
      (this.detail()?.origin !== "OFFICIAL" || this.checks.source)
    );
  }
  showSources() {
    if (this.busy() || this.sourceBusy()) return;
    this.sequence++;
    this.loading.set(false);
    this.importView.set(false);
    this.sourceView.set(true);
  }
  showImports() {
    if (this.busy() || this.sourceBusy()) return;
    this.sequence++;
    this.loading.set(false);
    this.sourceView.set(false);
    this.importView.set(true);
  }
  showQuestions() {
    if (this.busy() || this.sourceBusy()) return;
    this.sourceView.set(false);
    this.importView.set(false);
    void this.loadQueue();
  }
  setSourceBusy(value: boolean) {
    this.sourceBusy.set(value);
    this.emitBusy();
  }
  verifiedExams() {
    return this.sources().filter(
      (source) => source.status === "VERIFIED" && source.kind === "EXAM",
    );
  }
  exam() {
    return this.sources().find(
      (source) => source.id === this.draft.provenance?.examSourceId,
    );
  }
  keySource() {
    return this.sources().find(
      (source) => source.id === this.draft.provenance?.keySourceId,
    );
  }
  compatibleKeys() {
    const exam = this.exam();
    return this.sources().filter(
      (source) =>
        source.status === "VERIFIED" &&
        source.kind === "ANSWER_KEY" &&
        source.isFinal &&
        !!exam &&
        source.year === exam.year &&
        source.area === exam.area &&
        source.modality === exam.modality,
    );
  }
  examChanged() {
    if (this.draft.provenance) {
      this.draft.provenance.keySourceId = "";
      this.draft.provenance.page = 1;
      this.draft.provenance.keyPage = 1;
    }
    this.emitBusy();
  }
  async loadSources() {
    if (this.sourceLoading()) return;
    this.sourceLoading.set(true);
    try {
      const sources = await this.api<OfficialSource[]>("sources");
      if (this.active) this.sources.set(sources);
    } catch (err) {
      if (this.active) this.error.set(this.message(err));
    } finally {
      if (this.active) this.sourceLoading.set(false);
    }
  }
  async loadQueue(offset = this.requestedOffset, focus = false) {
    if (this.busy()) return;
    this.requestedOffset = offset;
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set("");
    try {
      const page = await this.api<EditorialPage>(
        `questions?limit=${QUEUE_PAGE_SIZE}&offset=${offset}`,
      );
      if (this.active && sequence === this.sequence) {
        this.rows.set(page.items);
        this.queueTotal.set(page.total);
        this.queueOffset.set(page.offset);
        this.requestedOffset = page.offset;
        if (focus) this.focusHeading("editorial-queue-title");
      }
    } catch (err) {
      if (this.active && sequence === this.sequence)
        this.error.set(this.message(err));
    } finally {
      if (this.active && sequence === this.sequence) this.loading.set(false);
    }
  }
  changeQueuePage(direction: -1 | 1) {
    if (this.loading() || this.busy()) return;
    const offset = this.queueOffset() + direction * QUEUE_PAGE_SIZE;
    if (offset < 0 || offset >= this.queueTotal()) return;
    void this.loadQueue(offset, true);
  }
  newDraft(origin: "AUTHOR_CREATED" | "OFFICIAL" = "AUTHOR_CREATED") {
    if (this.busy() || this.sourceBusy()) return;
    this.sequence++;
    this.loading.set(false);
    this.detail.set(null);
    this.draft = emptyDraft(origin);
    this.answerError.set("");
    this.savedDraft = JSON.stringify(this.draft);
    this.reviewNote = "";
    this.checks = { content: false, answer: false, credit: false, source: false };
    this.discard.set(false);
    this.confirmPublication.set(false);
    this.error.set("");
    this.notice.set("");
    this.editing.set(true);
    this.emitBusy();
    if (origin === "OFFICIAL") void this.loadSources();
    this.focusHeading();
  }
  async open(id: string) {
    if (this.busy()) return;
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set("");
    this.notice.set("");
    try {
      const detail = await this.api<EditorialDetail>(
        "versions/" + encodeURIComponent(id),
      );
      if (this.active && sequence === this.sequence) {
        this.applyDetail(detail);
        this.focusHeading();
      }
    } catch (err) {
      if (this.active && sequence === this.sequence)
        this.error.set(this.message(err));
    } finally {
      if (this.active && sequence === this.sequence) this.loading.set(false);
    }
  }
  backToQueue() {
    if (this.busy()) return;
    if (this.hasUnsavedChanges()) {
      this.discard.set(true);
      this.focusHeading("editorial-discard-message");
      return;
    }
    this.exitToQueue();
  }
  continueEditing() {
    this.discard.set(false);
    this.focusHeading("editorial-back");
  }
  discardAndBack() {
    if (this.busy()) return;
    this.exitToQueue();
  }
  private exitToQueue() {
    this.discard.set(false);
    this.editing.set(false);
    this.notice.set("");
    this.emitBusy();
    void this.loadQueue();
    this.focusHeading("curation-heading");
  }
  addOption() {
    if (!this.busy() && this.draft.options.length < 5) {
      this.draft.options.push({
        id: "option-" + crypto.randomUUID(),
        text: "",
      });
      this.emitBusy();
    }
  }
  removeOption(id: string) {
    if (this.busy() || this.draft.options.length <= 2) return;
    this.draft.options = this.draft.options.filter(
      (option) => option.id !== id,
    );
    if (this.draft.correctOptionId === id) {
      this.draft.correctOptionId = "";
      this.answerError.set("A alternativa correta foi removida. Escolha outra resposta correta.");
    }
    this.emitBusy();
  }
  selectCorrectOption(id: string) {
    this.draft.correctOptionId = id;
    this.answerError.set("");
    this.emitBusy();
  }
  async save(form: NgForm) {
    if (this.busy()) return;
    if (!this.draft.options.some((option) => option.id === this.draft.correctOptionId)) {
      this.answerError.set("Escolha a alternativa correta antes de salvar o rascunho.");
      this.focusHeading("draft-options");
      return;
    }
    this.answerError.set("");
    if (
      form.invalid ||
      !this.draft.title.trim() ||
      !this.draft.topic.trim() ||
      !this.draft.prompt.trim() ||
      !this.draft.explanation.trim() ||
      !this.draft.authorCredit.trim() ||
      this.draft.options.some((option) => !option.text.trim())
    ) {
      this.error.set(
        "Preencha todos os campos da questão e suas alternativas.",
      );
      return;
    }
    if (
      this.draft.origin === "OFFICIAL" &&
      (!this.draft.explanationCredit.trim() ||
        !this.draft.provenance?.examSourceId ||
        !this.draft.provenance.keySourceId ||
        ![
          this.draft.provenance.page,
          this.draft.provenance.keyPage,
          this.draft.provenance.questionNumber,
        ].every((value) => Number.isInteger(value) && value > 0))
    ) {
      this.error.set(
        "Informe as fontes verificadas, páginas, número da questão e crédito da explicação.",
      );
      return;
    }
    const current = this.detail();
    const copy = structuredClone(this.draft);
    const { explanationCredit, ...authored } = copy;
    const payload = copy.origin === "OFFICIAL" ? copy : authored;
    await this.mutate(
      current ? `versions/${current.id}` : "questions",
      current ? "PUT" : "POST",
      { ...payload, ...(current ? { baseRevision: current.revision } : {}) },
      "Rascunho salvo.",
    );
  }
  async submitForReview() {
    const current = this.detail();
    if (!current || this.hasChanges() || current.editorialStatus !== "DRAFT")
      return;
    await this.mutate(
      `versions/${current.id}/submit`,
      "POST",
      { baseRevision: current.revision },
      "Versão enviada para revisão independente.",
    );
  }
  async review(decision: "PUBLISH" | "REJECT") {
    const current = this.detail();
    if (
      !current ||
      !this.validReviewNote() ||
      (decision === "PUBLISH" && !this.canPublish())
    )
      return;
    await this.mutate(
      `versions/${current.id}/review`,
      "POST",
      {
        baseRevision: current.revision,
        decision,
        note: this.reviewNote,
        ...(decision === "PUBLISH" ? { checklist: this.checks } : {}),
      },
      decision === "PUBLISH"
        ? "Versão publicada."
        : "Versão devolvida para ajustes.",
    );
  }
  async cloneVersion() {
    const current = this.detail();
    if (!current) return;
    await this.mutate(
      `questions/${current.questionId}/versions`,
      "POST",
      { baseCurrentVersionId: current.currentVersionId },
      "Nova versão preparada. A versão anterior segue publicada.",
    );
  }
  private async mutate(
    path: string,
    method: string,
    body: unknown,
    notice: string,
  ) {
    if (this.busy()) return;
    const sequence = ++this.sequence;
    this.busy.set(true);
    this.emitBusy();
    this.error.set("");
    this.notice.set("");
    try {
      const detail = await this.api<EditorialDetail>(path, {
        method,
        body: JSON.stringify(body),
      });
      if (this.active && sequence === this.sequence) {
        this.applyDetail(detail);
        this.notice.set(notice);
        this.focusHeading();
      }
    } catch (err) {
      if (this.active && sequence === this.sequence)
        this.error.set(this.message(err));
    } finally {
      if (this.active && sequence === this.sequence) {
        this.busy.set(false);
        this.emitBusy();
      }
    }
  }
  private applyDetail(detail: EditorialDetail) {
    this.answerError.set("");
    this.detail.set(detail);
    this.editing.set(true);
    this.draft = {
      origin: detail.origin,
      explanationCredit: detail.explanationCredit || "",
      provenance: detail.provenance ? { ...detail.provenance } : null,
      title: detail.title,
      topic: detail.topic,
      prompt: detail.prompt,
      authorCredit: detail.authorCredit,
      explanation: detail.explanation,
      correctOptionId: detail.correctOptionId,
      options: detail.options.map((option) => ({ ...option })),
    };
    this.savedDraft = JSON.stringify(this.draft);
    this.reviewNote = "";
    this.checks = {
      content: false,
      answer: false,
      credit: false,
      source: false,
    };
    this.confirmPublication.set(false);
    this.discard.set(false);
    this.emitBusy();
    if (detail.origin === "OFFICIAL") void this.loadSources();
  }
  private focusHeading(id = "editorial-heading") {
    setTimeout(() => {
      if (this.active) document.getElementById(id)?.focus();
    }, 0);
  }
  private message(err: unknown) {
    return err instanceof Error
      ? err.message
      : "Falha de conexão. Tente novamente.";
  }
}
