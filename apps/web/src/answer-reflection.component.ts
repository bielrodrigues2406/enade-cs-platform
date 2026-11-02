import { Component, EventEmitter, HostListener, Input, Output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MascotComponent } from "./mascot.component";

type Reflection = { text: string; revision: number };

@Component({
  selector: "app-answer-reflection",
  imports: [FormsModule, MascotComponent],
  templateUrl: "./answer-reflection.component.html",
  styleUrl: "./answer-reflection.component.css",
})
export class AnswerReflectionComponent {
  @Input({ required: true }) versionId = "";
  @Output() stateChange = new EventEmitter<{ dirty: boolean; saving: boolean }>();
  text = "";
  revision = 0;
  loading = signal(true);
  loaded = signal(false);
  saving = signal(false);
  notice = signal("");
  error = signal("");
  private generation = 0;
  private savedText = "";

  ngOnChanges() { void this.load(); }
  ngOnDestroy() { this.generation++; this.stateChange.emit({ dirty: false, saving: false }); }

  edit(value: string) { this.text = value; this.publishState(); }
  private publishState() { this.stateChange.emit({ dirty: this.text !== this.savedText, saving: this.saving() }); }
  @HostListener("window:beforeunload", ["$event"])
  warnUnsaved(event: BeforeUnloadEvent) {
    if (this.text !== this.savedText || this.saving()) { event.preventDefault(); event.returnValue = ""; }
  }

  private async call(method: "GET" | "PUT", body?: Reflection): Promise<Reflection> {
    const response = await fetch(`/api/review/${encodeURIComponent(this.versionId)}/reflection`, {
      method, headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Não foi possível confirmar a reflexão.");
    return data;
  }

  async load() {
    const generation = ++this.generation;
    this.loading.set(true); this.loaded.set(false); this.saving.set(false); this.error.set(""); this.notice.set(""); this.text = ""; this.savedText = ""; this.revision = 0;
    try {
      const value = await this.call("GET");
      if (generation === this.generation) { this.text = value.text; this.savedText = value.text; this.revision = value.revision; this.loaded.set(true); }
    } catch (error) {
      if (generation === this.generation) this.error.set(message(error));
    } finally { if (generation === this.generation) { this.loading.set(false); this.publishState(); } }
  }

  async save() {
    if (!this.loaded() || this.loading() || this.saving()) return;
    const generation = this.generation;
    this.saving.set(true); this.error.set(""); this.notice.set("");
    this.publishState();
    try {
      const saved = await this.call("PUT", { text: this.text, revision: this.revision });
      if (generation === this.generation) {
        this.text = saved.text; this.savedText = saved.text; this.revision = saved.revision;
        this.notice.set(saved.text ? "Reflexão guardada no caderno de erros." : "Reflexão removida.");
      }
    } catch (error) {
      if (generation === this.generation) this.error.set(message(error));
    } finally { if (generation === this.generation) { this.saving.set(false); this.publishState(); } }
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Verifique a conexão e tente novamente.";
}
