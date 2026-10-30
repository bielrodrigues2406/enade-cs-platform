import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";

export type AccountMode = "login" | "register";
export type SessionStatus =
  | { mode: "guest" }
  | { mode: "account"; email: string };
export type Credentials = { email: string; password: string };

@Component({
  selector: "app-account",
  imports: [FormsModule],
  templateUrl: "./account.component.html",
})
export class AccountComponent {
  @Input({ required: true }) mode: AccountMode = "login";
  @Input() busy = false;
  @Input() error = "";
  @Output() modeChange = new EventEmitter<AccountMode>();
  @Output() submitCredentials = new EventEmitter<Credentials>();
  @Output() cancel = new EventEmitter<void>();
  email = "";
  password = "";
  submitted = false;

  ngOnChanges() {
    // Credentials are never kept when the form changes purpose or completes.
    this.password = "";
    this.submitted = false;
  }
  passwordError() {
    const length = [...this.password].length;
    return length < 12 || length > 128
      ? "A senha deve ter de 12 a 128 caracteres."
      : "";
  }
  submit(form: NgForm) {
    this.submitted = true;
    if (this.busy || form.invalid || this.passwordError()) return;
    this.submitCredentials.emit({
      email: this.email.trim(),
      password: this.password,
    });
  }
  switchMode() {
    this.password = "";
    this.submitted = false;
    this.modeChange.emit(this.mode === "register" ? "login" : "register");
  }
}
