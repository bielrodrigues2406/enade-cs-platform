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
  template: `
    <section class="account-page" aria-labelledby="account-title">
      <button
        type="button"
        class="back text-button"
        (click)="cancel.emit()"
        [disabled]="busy"
      >
        ← Voltar ao estudo
      </button>
      <h1 id="account-title">
        {{ mode === "register" ? "Criar conta" : "Entrar" }}
      </h1>
      @if (mode === "register") {
        <p class="account-intro">
          Guarde as respostas já confirmadas nesta sessão e retome seus estudos
          em outro navegador.
        </p>
      } @else {
        <p class="account-intro">Entre para abrir o histórico da sua conta.</p>
        <p class="account-help">
          As respostas da sessão sem conta não são transferidas ao entrar. Para
          guardá-las em uma conta nova, escolha Criar conta.
        </p>
      }
      <form #accountForm="ngForm" (ngSubmit)="submit(accountForm)" novalidate>
        <fieldset [disabled]="busy">
          <div class="account-field">
            <label for="account-email">E-mail</label>
            <input
              id="account-email"
              type="email"
              name="email"
              [(ngModel)]="email"
              #emailField="ngModel"
              required
              email
              maxlength="254"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              [attr.aria-invalid]="
                submitted && emailField.invalid ? true : null
              "
              [attr.aria-describedby]="
                submitted && emailField.invalid ? 'email-error' : null
              "
            />
            @if (submitted && emailField.invalid) {
              <p id="email-error" class="field-error">
                Informe um e-mail válido.
              </p>
            }
          </div>
          <div class="account-field">
            <label for="account-password">Senha</label>
            <input
              id="account-password"
              type="password"
              name="password"
              [(ngModel)]="password"
              required
              maxlength="256"
              [attr.autocomplete]="
                mode === 'register' ? 'new-password' : 'current-password'
              "
              [attr.aria-invalid]="submitted && passwordError() ? true : null"
              aria-describedby="password-help password-error"
            />
            <p id="password-help" class="account-help">
              Use de 12 a 128 caracteres. Espaços são permitidos.
            </p>
            <p id="password-error" class="field-error">
              @if (submitted && passwordError()) {
                {{ passwordError() }}
              }
            </p>
          </div>
          @if (mode === "register") {
            <p class="account-limit">
              Nesta versão, o e-mail ainda não é confirmado e não há recuperação
              de senha. Guarde sua senha em um local seguro.
            </p>
          }
          <button type="submit">
            {{
              busy
                ? "Confirmando…"
                : mode === "register"
                  ? "Criar conta"
                  : "Entrar"
            }}
          </button>
        </fieldset>
        @if (error) {
          <div class="notice" role="alert">
            <p>{{ error }}</p>
          </div>
        }
        @if (busy) {
          <p class="account-help" role="status">
            Confirmando os dados da conta…
          </p>
        }
      </form>
      <p class="account-switch">
        {{
          mode === "register" ? "Já tem uma conta?" : "Primeira vez por aqui?"
        }}
        <button
          type="button"
          class="text-button"
          (click)="switchMode()"
          [disabled]="busy"
        >
          {{ mode === "register" ? "Entrar" : "Criar conta" }}
        </button>
      </p>
      <p class="account-help">
        Você também pode continuar estudando sem criar uma conta.
      </p>
    </section>
  `,
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
