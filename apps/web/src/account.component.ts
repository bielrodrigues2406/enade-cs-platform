import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";

export type AccountMode = "login" | "register";
export type SessionStatus =
  | { mode: "guest" }
  | { mode: "account"; email: string };
export type Credentials = {
  email: string;
  password: string;
  name?: string;
  enrollment?: string;
};

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
  name = "";
  enrollment = "";
  showPassword = false;
  submitted = false;

  ngOnChanges() {
    // Credentials are never kept when the form changes purpose or completes.
    this.password = "";
    this.showPassword = false;
    this.submitted = false;
  }
  passwordError() {
    const length = [...this.password].length;
    return length < 12 || length > 128
      ? "A senha deve ter de 12 a 128 caracteres."
      : "";
  }
  // Mesmo formato que a API aceita: duas letras e 6 a 8 dígitos, X opcional.
  enrollmentError() {
    const value = this.enrollment.trim().toUpperCase();
    return value && !/^[A-Z]{2}[0-9]{6,8}X?$/.test(value)
      ? "Use o formato do prontuário IFSP, por exemplo PE3012345."
      : "";
  }
  submit(form: NgForm) {
    this.submitted = true;
    if (this.busy || form.invalid || this.passwordError()) return;
    if (this.mode === "register" && this.enrollmentError()) return;
    this.submitCredentials.emit({
      email: this.email.trim(),
      password: this.password,
      ...(this.mode === "register" ? this.profile() : {}),
    });
  }
  private profile() {
    const name = this.name.trim();
    const enrollment = this.enrollment.trim().toUpperCase();
    return { ...(name ? { name } : {}), ...(enrollment ? { enrollment } : {}) };
  }
  switchMode() {
    this.password = "";
    this.submitted = false;
    this.modeChange.emit(this.mode === "register" ? "login" : "register");
  }
}
