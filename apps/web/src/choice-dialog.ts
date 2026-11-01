import { Component, ElementRef, Injectable, ViewChild, effect, inject, signal } from "@angular/core";

/**
 * Pergunta com botões próprios no lugar do confirm() do navegador. Um único
 * diálogo fica no shell; qualquer tela pede uma escolha e recebe o valor do
 * botão clicado, ou null ao cancelar (Esc, fechar ou clicar fora).
 */
export type ChoiceAction<T extends string> = { value: T; label: string; kind?: "primary" | "outline" | "danger" | "danger-link" };
export type ChoiceRequest<T extends string> = {
  eyebrow?: string;
  title: string;
  message: string;
  /** Rótulo do botão que só fecha; o padrão é "Cancelar". null: sem esse botão (fecha no X ou Esc). */
  cancel?: string | null;
  actions: ChoiceAction<T>[];
};
type Pending = ChoiceRequest<string> & { resolve: (value: string | null) => void };

@Injectable({ providedIn: "root" })
export class ChoiceService {
  readonly pending = signal<Pending | null>(null);

  choose<T extends string>(request: ChoiceRequest<T>): Promise<T | null> {
    this.pending()?.resolve(null);
    return new Promise((resolve) => this.pending.set({ ...request, resolve: resolve as (value: string | null) => void }));
  }
  /** Sim ou não, com o rótulo da ação. */
  async confirm(request: Omit<ChoiceRequest<"ok">, "actions"> & { confirm: string; danger?: boolean }) {
    const { confirm, danger, ...rest } = request;
    return (await this.choose({ ...rest, actions: [{ value: "ok", label: confirm, kind: danger ? "danger" : "primary" }] })) === "ok";
  }
  answer(value: string | null) {
    const pending = this.pending();
    this.pending.set(null);
    pending?.resolve(value);
  }
}

@Component({
  selector: "app-choice-dialog",
  templateUrl: "./choice-dialog.html",
})
export class ChoiceDialogComponent {
  readonly choice = inject(ChoiceService);
  @ViewChild("dialog", { static: true }) dialog!: ElementRef<HTMLDialogElement>;

  constructor() {
    effect(() => {
      const element = this.dialog?.nativeElement;
      if (!element) return;
      if (this.choice.pending() && !element.open) element.showModal();
      if (!this.choice.pending() && element.open) element.close();
    });
  }
  /** Fechar por Esc ou pelo X conta como cancelar. */
  closed() {
    if (this.choice.pending()) this.choice.answer(null);
  }
}
