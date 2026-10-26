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
  template: `
    @if (!selected()) {
      <section class="page-intro">
        <p class="eyebrow">PROCEDÊNCIA DO CONTEÚDO</p>
        <h1>Fontes oficiais</h1>
        <p>
          Confira a origem, a edição e o arquivo de cada documento antes de
          usá-lo em uma questão.
        </p>
      </section>
      <p class="editorial-scope">
        Novos documentos são cadastrados pela administração. Depois da
        importação, a curadoria confere as fontes nesta fila.
      </p>
      <div class="editorial-queue-heading">
        <h2>Documentos cadastrados</h2>
        <button class="text-button" (click)="load()" [disabled]="loading()">
          Atualizar fontes
        </button>
      </div>
      @if (loading()) {
        <p role="status">Carregando fontes…</p>
      }
      @if (error()) {
        <div class="notice" role="alert">
          <p>{{ error() }}</p>
          <button (click)="load()">Tentar novamente</button>
        </div>
      } @else if (!loading() && rows().length === 0) {
        <div class="empty">
          <h3>Nenhuma fonte cadastrada</h3>
          <p>
            A fila será preenchida após a importação de provas, gabaritos e
            padrões de resposta pela administração.
          </p>
        </div>
      } @else {
        <table class="editorial-table source-table">
          <caption class="visually-hidden">
            Fontes oficiais cadastradas
          </caption>
          <thead>
            <tr>
              <th scope="col">Documento</th>
              <th scope="col">Situação</th>
              <th scope="col">Arquivo</th>
              <th scope="col"><span class="visually-hidden">Ação</span></th>
            </tr>
          </thead>
          <tbody>
            @for (source of rows(); track source.id) {
              <tr>
                <td>
                  <strong>{{ source.title }}</strong
                  ><span class="editorial-row-meta"
                    >{{ kindLabel(source.kind) }} · {{ source.year }} ·
                    {{ source.area }}</span
                  ><span class="editorial-row-meta">{{
                    modalityLabel(source.modality)
                  }}</span>
                </td>
                <td>
                  <span
                    class="editorial-status"
                    [class.published]="source.status === 'VERIFIED'"
                    >{{ statusLabel(source.status) }}</span
                  >
                </td>
                <td>
                  {{ source.pageCount }} páginas<span
                    class="editorial-row-meta"
                    >{{ bytes(source.byteSize) }}</span
                  >
                </td>
                <td>
                  <button
                    class="outline"
                    (click)="open(source.id)"
                    [disabled]="loading()"
                    [attr.aria-label]="'Conferir fonte: ' + source.title"
                  >
                    Conferir <span aria-hidden="true">→</span>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    } @else {
      <button class="back text-button" (click)="back()" [disabled]="busy()">
        ← Voltar às fontes
      </button>
      <article class="editorial-document source-document">
        <p class="eyebrow">
          DOCUMENTO OFICIAL · {{ kindLabel(selected()!.kind) }}
        </p>
        <h1 id="source-heading" tabindex="-1">{{ selected()!.title }}</h1>
        <p class="editorial-document-state">
          <span
            class="editorial-status"
            [class.published]="selected()!.status === 'VERIFIED'"
            >{{ statusLabel(selected()!.status) }}</span
          >
          @if (selected()!.isFinal) {
            <span>Gabarito definitivo conferido</span>
          }
        </p>
        @if (notice()) {
          <p class="account-success" role="status">{{ notice() }}</p>
        }
        <section class="source-archive" aria-label="Arquivo e procedência">
          <h2>Documento para conferência</h2>
          <p>
            <a
              [href]="selected()!.officialUrl"
              target="_blank"
              rel="noopener noreferrer"
              >Abrir endereço oficial
              <span class="visually-hidden">em nova aba</span></a
            >
          </p>
          <p class="source-url">{{ selected()!.officialUrl }}</p>
          @if (selected()!.acquisitionMethod === "MIRROR") {
            <p>
              Arquivo obtido como cópia em repositório público.
              <a
                [href]="selected()!.retrievalUrl"
                target="_blank"
                rel="noopener noreferrer"
                >Consultar a cópia identificada pelo commit</a
              >. Confira a correspondência com a referência oficial antes de
              verificar a fonte.
            </p>
          } @else if (selected()!.acquisitionMethod === "LOCAL") {
            <p>
              Arquivo fornecido localmente. A URL oficial é uma referência; o
              servidor não confirmou um download direto desse endereço.
            </p>
          }
          @if (selected()!.modality === "COMUM") {
            <p>
              Caderno compartilhado: contém blocos de cursos diferentes. Confira
              o bloco e o número original ao transcrever uma questão.
            </p>
          }
          <p>
            <a [href]="'/api/curation/sources/' + selected()!.id + '/file'"
              >Baixar PDF arquivado</a
            >
            · {{ selected()!.pageCount }} páginas ·
            {{ bytes(selected()!.byteSize) }}
          </p>
          <details>
            <summary>Identidade do arquivo (SHA-256)</summary>
            <code class="source-hash">{{ selected()!.sha256 }}</code>
          </details>
        </section>
        @if (selected()!.note) {
          <section class="editorial-review-note">
            <h2>Último parecer</h2>
            <p>{{ selected()!.note }}</p>
          </section>
        }
        @if (selected()!.status !== "VERIFIED") {
          <form
            #metadataForm="ngForm"
            (ngSubmit)="save(metadataForm)"
            novalidate
          >
            <fieldset [disabled]="busy()">
              <legend class="source-section-title">Metadados da edição</legend>
              <div class="editorial-field">
                <label for="source-title">Título do documento</label
                ><input
                  id="source-title"
                  name="title"
                  [(ngModel)]="metadata.title"
                  required
                  maxlength="200"
                />
              </div>
              <div class="editorial-fields-row">
                <div class="editorial-field">
                  <label for="source-kind">Tipo de documento</label
                  ><select
                    id="source-kind"
                    name="kind"
                    [(ngModel)]="metadata.kind"
                  >
                    <option value="EXAM">Prova</option>
                    <option value="ANSWER_KEY">Gabarito</option>
                    <option value="RESPONSE_STANDARD">
                      Padrão de resposta
                    </option>
                    <option value="EXAM_MAP">Mapa de prova</option>
                  </select>
                </div>
                <div class="editorial-field">
                  <label for="source-year">Ano da edição</label
                  ><input
                    id="source-year"
                    name="year"
                    type="number"
                    [(ngModel)]="metadata.year"
                    required
                    min="2004"
                    [max]="currentYear"
                  />
                </div>
              </div>
              <div class="editorial-fields-row">
                <div class="editorial-field">
                  <label for="source-area">Área</label
                  ><input
                    id="source-area"
                    name="area"
                    [(ngModel)]="metadata.area"
                    required
                    maxlength="120"
                  />
                </div>
                <div class="editorial-field">
                  <label for="source-modality">Modalidade</label
                  ><select
                    id="source-modality"
                    name="modality"
                    [(ngModel)]="metadata.modality"
                  >
                    <option value="BACHARELADO">Bacharelado</option>
                    <option value="LICENCIATURA">Licenciatura</option>
                    <option value="CST">Curso superior de tecnologia</option>
                    <option value="COMUM">Caderno compartilhado</option>
                  </select>
                </div>
              </div>
              <button type="submit">
                {{ busy() ? "Salvando…" : "Salvar metadados" }}
              </button>
              <p class="account-help">
                A edição altera apenas os metadados. Endereço oficial, arquivo e
                número de páginas são preservados.
              </p>
            </fieldset>
          </form>
        } @else {
          <dl class="source-metadata">
            <div>
              <dt>Edição</dt>
              <dd>{{ selected()!.year }}</dd>
            </div>
            <div>
              <dt>Área</dt>
              <dd>{{ selected()!.area }}</dd>
            </div>
            <div>
              <dt>Modalidade</dt>
              <dd>{{ modalityLabel(selected()!.modality) }}</dd>
            </div>
          </dl>
        }
        @if (selected()!.status !== "VERIFIED") {
          @if (selected()!.canReview) {
            <section class="editorial-review">
              <h2>Conferência independente da fonte</h2>
              <p>
                Abra o documento e confira os dados abaixo. Salve eventuais
                alterações de metadados antes de registrar o parecer.
              </p>
              <fieldset [disabled]="busy() || metadataChanged()">
                <legend class="visually-hidden">Conferência da fonte</legend>
                <label class="editorial-check"
                  ><input type="checkbox" [(ngModel)]="checks.origin" />Conferi
                  que o endereço e o documento são de origem oficial.</label
                ><label class="editorial-check"
                  ><input type="checkbox" [(ngModel)]="checks.edition" />Conferi
                  ano, área e modalidade no documento.</label
                ><label class="editorial-check"
                  ><input
                    type="checkbox"
                    [(ngModel)]="checks.integrity"
                  />Conferi a integridade e a leitura do PDF arquivado.</label
                >
                @if (selected()!.kind === "ANSWER_KEY") {
                  <label class="editorial-check"
                    ><input type="checkbox" [(ngModel)]="checks.final" />Conferi
                    que este é o gabarito definitivo.</label
                  >
                }
                <div class="editorial-field">
                  <label for="source-note">Parecer sobre a fonte</label
                  ><textarea
                    id="source-note"
                    [(ngModel)]="note"
                    minlength="10"
                    maxlength="2000"
                    rows="4"
                    aria-describedby="source-note-help"
                  ></textarea>
                  <p id="source-note-help" class="account-help">
                    Registre de 10 a 2.000 caracteres. Ao rejeitar, explique o
                    que precisa ser corrigido.
                  </p>
                </div>
                <div class="editorial-actions">
                  <button (click)="review('VERIFY')" [disabled]="!canVerify()">
                    Verificar fonte</button
                  ><button
                    class="outline"
                    (click)="review('REJECT')"
                    [disabled]="!validNote()"
                  >
                    Rejeitar fonte
                  </button>
                </div>
              </fieldset>
              @if (metadataChanged()) {
                <p class="account-help">
                  Há metadados alterados nesta tela. Salve ou reabra a fonte
                  antes da conferência.
                </p>
              }
            </section>
          } @else {
            <p class="editorial-scope">
              @if (selected()!.status === "REJECTED") {
                Revise e salve os metadados para encaminhar a fonte novamente à
                conferência independente.
              } @else {
                Quem importou ou editou os metadados não pode verificar esta
                fonte. Outra pessoa da curadoria deve fazer a conferência.
              }
            </p>
          }
        }
        @if (error()) {
          <div class="notice" role="alert">
            <p>{{ error() }}</p>
            <p>Os dados preenchidos nesta tela foram mantidos.</p>
            <button
              class="outline"
              (click)="open(selected()!.id)"
              [disabled]="busy()"
            >
              Reabrir fonte
            </button>
            <p class="account-help">
              Reabrir consulta o servidor e descarta metadados locais ainda não
              salvos.
            </p>
          </div>
        }
      </article>
    }
  `,
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
