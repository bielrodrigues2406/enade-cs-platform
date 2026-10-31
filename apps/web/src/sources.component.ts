import { Component, EventEmitter, Output, signal } from "@angular/core";
import { FormsModule, type NgForm } from "@angular/forms";

export type OfficialSource = {
  id: string;
  title: string;
  officialUrl: string;
  kind: "EXAM" | "ANSWER_KEY" | "RESPONSE_STANDARD" | "EXAM_MAP";
  year: number;
  area: string;
  modality: "BACHARELADO" | "LICENCIATURA" | "CST" | "COMUM";
  acquisitionMethod: "DIRECT" | "MIRROR" | "LOCAL";
  retrievalUrl: string | null;
  sha256: string;
  byteSize: number;
  pageCount: number;
  status: "IMPORTED" | "VERIFIED" | "REJECTED";
  revision: number;
  canReview: boolean;
  note: string | null;
  isFinal: boolean;
};

@Component({
  selector: "app-sources",
  imports: [FormsModule],
  templateUrl: "./sources.component.html",
})
export class SourcesComponent {
  @Output() busyChange = new EventEmitter<boolean>();
  readonly currentYear = new Date().getUTCFullYear();
  rows = signal<OfficialSource[]>([]);
  selected = signal<OfficialSource | null>(null);
  loading = signal(false);
  busy = signal(false);
  error = signal("");
  notice = signal("");
  metadata: Pick<
    OfficialSource,
    "title" | "kind" | "year" | "area" | "modality"
  > = {
    title: "",
    kind: "EXAM",
    year: 2021,
    area: "",
    modality: "BACHARELADO",
  };
  note = "";
  checks = { origin: false, edition: false, integrity: false, final: false };
  private savedMetadata = "";
  private active = true;
  private sequence = 0;
  private abort = new AbortController();
  constructor() {
    void this.load();
  }
  ngOnDestroy() {
    this.active = false;
    this.sequence++;
    this.abort.abort();
    this.busyChange.emit(false);
  }
  private async api<T>(path = "", init?: RequestInit): Promise<T> {
    const response = await fetch("/api/curation/sources" + path, {
      ...init,
      headers: { "Content-Type": "application/json" },
      signal: this.abort.signal,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(
        error?.message ||
          "Não foi possível confirmar a operação. Tente novamente.",
      );
    }
    return response.json();
  }
  kindLabel(kind: OfficialSource["kind"]) {
    return {
      EXAM: "Prova",
      ANSWER_KEY: "Gabarito",
      RESPONSE_STANDARD: "Padrão de resposta",
      EXAM_MAP: "Mapa de prova",
    }[kind];
  }
  statusLabel(status: OfficialSource["status"]) {
    return {
      IMPORTED: "A conferir",
      VERIFIED: "Verificada",
      REJECTED: "Rejeitada",
    }[status];
  }
  modalityLabel(modality: OfficialSource["modality"]) {
    return {
      BACHARELADO: "Bacharelado",
      LICENCIATURA: "Licenciatura",
      CST: "Curso superior de tecnologia",
      COMUM: "Caderno compartilhado",
    }[modality];
  }
  bytes(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "unit",
      unit: "kilobyte",
      maximumFractionDigits: 1,
    }).format(value / 1024);
  }
  metadataChanged() {
    return JSON.stringify(this.metadata) !== this.savedMetadata;
  }
  validNote() {
    const length = [...this.note.trim()].length;
    return length >= 10 && length <= 2000;
  }
  canVerify() {
    return (
      this.validNote() &&
      this.checks.origin &&
      this.checks.edition &&
      this.checks.integrity &&
      (this.selected()?.kind !== "ANSWER_KEY" || this.checks.final)
    );
  }
  async load() {
    if (this.busy()) return;
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set("");
    try {
      const rows = await this.api<OfficialSource[]>();
      if (this.active && sequence === this.sequence) this.rows.set(rows);
    } catch (err) {
      if (this.active && sequence === this.sequence)
        this.error.set(this.message(err));
    } finally {
      if (this.active && sequence === this.sequence) this.loading.set(false);
    }
  }
  async open(id: string) {
    if (this.busy()) return;
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set("");
    this.notice.set("");
    try {
      const source = await this.api<OfficialSource>(
        "/" + encodeURIComponent(id),
      );
      if (this.active && sequence === this.sequence) {
        this.apply(source);
        this.focusHeading();
      }
    } catch (err) {
      if (this.active && sequence === this.sequence)
        this.error.set(this.message(err));
    } finally {
      if (this.active && sequence === this.sequence) this.loading.set(false);
    }
  }
  back() {
    if (this.busy()) return;
    this.selected.set(null);
    this.notice.set("");
    void this.load();
  }
  async save(form: NgForm) {
    if (
      form.invalid ||
      !this.metadata.title.trim() ||
      !this.metadata.area.trim()
    ) {
      this.error.set("Preencha os metadados da edição.");
      return;
    }
    await this.mutate(
      "PUT",
      { ...this.metadata, baseRevision: this.selected()!.revision },
      "Metadados salvos. A fonte aguarda conferência independente.",
    );
  }
  async review(decision: "VERIFY" | "REJECT") {
    if (
      !this.validNote() ||
      this.metadataChanged() ||
      (decision === "VERIFY" && !this.canVerify())
    )
      return;
    await this.mutate(
      "POST",
      {
        baseRevision: this.selected()!.revision,
        decision,
        note: this.note,
        ...(decision === "VERIFY"
          ? {
              checklist: {
                origin: this.checks.origin,
                edition: this.checks.edition,
                integrity: this.checks.integrity,
                ...(this.selected()!.kind === "ANSWER_KEY"
                  ? { final: this.checks.final }
                  : {}),
              },
            }
          : {}),
      },
      decision === "VERIFY" ? "Fonte verificada." : "Fonte rejeitada.",
      "/review",
    );
  }
  private async mutate(
    method: string,
    body: unknown,
    notice: string,
    suffix = "",
  ) {
    if (this.busy() || !this.selected()) return;
    const sequence = ++this.sequence;
    this.busy.set(true);
    this.busyChange.emit(true);
    this.error.set("");
    this.notice.set("");
    try {
      const source = await this.api<OfficialSource>(
        "/" + this.selected()!.id + suffix,
        { method, body: JSON.stringify(body) },
      );
      if (this.active && sequence === this.sequence) {
        this.apply(source);
        this.notice.set(notice);
      }
    } catch (err) {
      if (this.active && sequence === this.sequence)
        this.error.set(this.message(err));
    } finally {
      if (this.active && sequence === this.sequence) {
        this.busy.set(false);
        this.busyChange.emit(false);
      }
    }
  }
  private apply(source: OfficialSource) {
    this.selected.set(source);
    this.metadata = {
      title: source.title,
      kind: source.kind,
      year: source.year,
      area: source.area,
      modality: source.modality,
    };
    this.savedMetadata = JSON.stringify(this.metadata);
    this.note = "";
    this.checks = {
      origin: false,
      edition: false,
      integrity: false,
      final: false,
    };
  }
  private focusHeading() {
    setTimeout(() => {
      if (this.active) document.getElementById("source-heading")?.focus();
    }, 0);
  }
  private message(err: unknown) {
    return err instanceof Error
      ? err.message
      : "Falha de conexão. Tente novamente.";
  }
}
