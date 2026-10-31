import { Component, EventEmitter, Output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { initials } from "./initials";

type Profile = { email: string; name: string | null; enrollment: string | null; createdAt?: string };
type Status = { kind: "success" | "error"; text: string } | null;

const PASSWORD_RANGE = "A senha deve ter de 12 a 128 caracteres.";
const ENROLLMENT = /^[A-Z]{2}[0-9]{6,8}X?$/;

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch("/api/me/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Não foi possível salvar. Verifique a conexão e tente novamente.");
  return data as T;
}

/**
 * Meu perfil: a pessoa corrige nome, prontuário e e-mail e troca a senha.
 * Mudar o e-mail ou a senha pede a senha atual; trocar a senha encerra as
 * sessões dos outros aparelhos.
 */
@Component({
  selector: "app-profile",
  imports: [FormsModule],
  templateUrl: "./profile.component.html",
  styleUrl: "./profile.component.css",
})
export class ProfileComponent {
  /** Nome ou e-mail mudaram: o cabeçalho mostra os novos. */
  @Output() accountChange = new EventEmitter<{ email: string; name: string | null }>();
  @Output() back = new EventEmitter<void>();

  loaded = signal<Profile | null>(null);
  loadError = signal("");
  savingProfile = signal(false);
  savingPassword = signal(false);
  profileStatus = signal<Status>(null);
  passwordStatus = signal<Status>(null);

  name = "";
  enrollment = "";
  email = "";
  profilePassword = "";
  currentPassword = "";
  newPassword = "";
  confirmPassword = "";
  showPasswords = false;
  passwordSubmitted = false;
  profileSubmitted = false;

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.loadError.set("");
    try {
      const data = await call<Profile>("profile", "GET");
      this.loaded.set(data);
      this.name = data.name ?? "";
      this.enrollment = data.enrollment ?? "";
      this.email = data.email;
    } catch (error) {
      this.loadError.set(message(error));
    }
  }

  emailChanged() {
    return this.email.trim().toLowerCase() !== (this.loaded()?.email ?? "");
  }
  nameError() {
    const length = this.name.trim().length;
    return length < 2 ? "Informe seu nome." : length > 120 ? "Use até 120 caracteres." : "";
  }
  avatar() {
    const data = this.loaded();
    return initials(data?.name, data?.email);
  }
  enrollmentError() {
    const value = this.enrollment.trim().toUpperCase();
    return value && !ENROLLMENT.test(value) ? "Use o formato do prontuário IFSP, por exemplo PE3012345." : "";
  }
  memberSince() {
    const created = this.loaded()?.createdAt;
    return created ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(created)) : "";
  }

  async saveProfile() {
    this.profileSubmitted = true;
    if (this.savingProfile() || this.nameError() || this.enrollmentError()) return;
    if (this.emailChanged() && !this.profilePassword) {
      this.profileStatus.set({ kind: "error", text: "Para mudar o e-mail, informe a senha atual." });
      return;
    }
    this.savingProfile.set(true);
    this.profileStatus.set(null);
    try {
      const saved = await call<Profile>("profile", "PUT", {
        name: this.name.trim(),
        enrollment: this.enrollment.trim().toUpperCase(),
        email: this.email.trim(),
        ...(this.emailChanged() ? { currentPassword: this.profilePassword } : {}),
      });
      this.loaded.set({ ...this.loaded()!, ...saved });
      this.name = saved.name ?? "";
      this.enrollment = saved.enrollment ?? "";
      this.email = saved.email;
      this.profilePassword = "";
      this.profileSubmitted = false;
      this.accountChange.emit({ email: saved.email, name: saved.name });
      this.profileStatus.set({ kind: "success", text: "Dados salvos." });
    } catch (error) {
      this.profileStatus.set({ kind: "error", text: message(error) });
    } finally {
      this.savingProfile.set(false);
    }
  }

  newPasswordError() {
    const length = [...this.newPassword].length;
    if (length < 12 || length > 128) return PASSWORD_RANGE;
    if (this.newPassword !== this.confirmPassword) return "A confirmação não é igual à nova senha.";
    return "";
  }

  async changePassword() {
    this.passwordSubmitted = true;
    if (this.savingPassword() || !this.currentPassword || this.newPasswordError()) return;
    this.savingPassword.set(true);
    this.passwordStatus.set(null);
    try {
      await call("password", "POST", { currentPassword: this.currentPassword, newPassword: this.newPassword });
      this.currentPassword = this.newPassword = this.confirmPassword = "";
      this.passwordSubmitted = false;
      this.showPasswords = false;
      this.passwordStatus.set({ kind: "success", text: "Senha trocada. Os outros aparelhos precisam entrar de novo." });
    } catch (error) {
      this.passwordStatus.set({ kind: "error", text: message(error) });
    } finally {
      this.savingPassword.set(false);
    }
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Verifique a conexão e tente novamente.";
}
