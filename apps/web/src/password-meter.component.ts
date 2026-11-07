import { Component, Input, OnChanges, signal } from "@angular/core";
import { checkPassword, loadCommonPasswords, type PasswordCheck, type PasswordOwner } from "./password-rules";

const LABELS = ["", "Fraca", "Razoável", "Boa", "Forte"] as const;

/** Medidor de força da senha nova: barra de 4 partes e lista do que falta. */
@Component({
  selector: "app-password-meter",
  templateUrl: "./password-meter.component.html",
  styleUrl: "./password-meter.component.css",
})
export class PasswordMeterComponent implements OnChanges {
  @Input() password = "";
  @Input() owner: PasswordOwner = {};
  readonly check = signal<PasswordCheck>(checkPassword("", {}, null));
  private list: Set<string> | null = null;

  ngOnChanges() {
    this.update();
    if (this.password && !this.list)
      void loadCommonPasswords().then((list) => { this.list = list; this.update(); });
  }
  label() { return LABELS[this.check().score]; }
  private update() { this.check.set(checkPassword(this.password, this.owner, this.list)); }
}
