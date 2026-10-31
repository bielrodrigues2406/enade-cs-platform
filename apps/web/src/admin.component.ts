import { Component, EventEmitter, Output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ExamImportComponent } from "./exam-import.component";

// Administração (ROLE-1, D14): contas cadastradas e papéis. O servidor
// confere o papel em cada chamada; esta tela só organiza as ações.
type Role = "ADMIN" | "PROFESSOR";
type UserRow = {
  id: string;
  email: string;
  name: string | null;
  enrollment: string | null;
  createdAt: string;
  roles: Role[];
  answers: number;
};
/** Convite de papel; com `claimedAt`, a pessoa já se cadastrou e aguarda confirmação. */
type Invitation = {
  email: string; role: Role; createdAt: string;
  claimedAt: string | null; claimedName: string | null; claimedEnrollment: string | null;
};
type UsersPage = { total: number; page: number; pageSize: number; items: UserRow[]; invitations: Invitation[] };

/** Senha inicial legível: 4 grupos de 4 letras e dígitos sem caracteres ambíguos (≈80 bits). */
export function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Administração", PROFESSOR: "Professor" };

@Component({
  selector: "app-admin",
  imports: [FormsModule, ExamImportComponent],
  templateUrl: "./admin.component.html",
})
export class AdminComponent {
  @Output() back = new EventEmitter<void>();
  readonly roleLabel = ROLE_LABEL;
  tab = signal<"accounts" | "imports">("accounts");
  data = signal<UsersPage | null>(null);
  loading = signal(false);
  error = signal("");
  notice = signal("");
  search = "";
  inviteEmail = "";
  inviteRole: Role = "PROFESSOR";
  newAccount = { name: "", enrollment: "", email: "", role: "" as Role | "", password: "" };
  creating = signal(false);
  createError = signal("");

  ngOnInit() {
    void this.load(1);
  }
  pageCount() {
    const data = this.data();
    return data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  }
  date(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR");
  }
  async load(page: number) {
    this.loading.set(true);
    this.error.set("");
    try {
      const params = new URLSearchParams({ q: this.search.trim(), page: String(page) });
      this.data.set(await this.request<UsersPage>(`admin/users?${params}`));
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }
  async authorize() {
    const email = this.inviteEmail.trim();
    if (!email) return;
    const result = await this.change("admin/roles", email, this.inviteRole);
    if (!result) return;
    this.notice.set(
      result.status === "GRANTED"
        ? `${email} agora tem o papel ${ROLE_LABEL[this.inviteRole]}.`
        : `${email} ainda não tem conta. Quando a pessoa se cadastrar, confirme aqui para o papel ${ROLE_LABEL[this.inviteRole]} valer.`,
    );
    this.inviteEmail = "";
  }
  async grant(user: UserRow, role: Role) {
    if (await this.change("admin/roles", user.email, role))
      this.notice.set(`${user.email} agora tem o papel ${ROLE_LABEL[role]}.`);
  }
  /** Confirma o papel de quem se cadastrou com um e-mail convidado. */
  async confirm(invitation: Invitation) {
    if (await this.change("admin/roles", invitation.email, invitation.role))
      this.notice.set(`${invitation.claimedName ?? invitation.email} agora tem o papel ${ROLE_LABEL[invitation.role]}.`);
  }
  openCreate(dialog: HTMLDialogElement) {
    this.newAccount = { name: "", enrollment: "", email: "", role: "", password: generatePassword() };
    this.createError.set("");
    dialog.showModal();
  }
  suggestPassword() {
    this.newAccount.password = generatePassword();
  }
  /** Cadastro feito pelo admin: a conta já nasce com o papel escolhido, sem convite. */
  async createAccount(dialog: HTMLDialogElement) {
    const account = this.newAccount;
    const length = [...account.password].length;
    if (!account.email.trim()) return this.createError.set("Informe o e-mail.");
    if (length < 12 || length > 128) return this.createError.set("A senha inicial deve ter de 12 a 128 caracteres.");
    this.creating.set(true);
    this.createError.set("");
    try {
      await this.request("admin/accounts", {
        email: account.email.trim(),
        password: account.password,
        name: account.name.trim(),
        enrollment: account.enrollment.trim().toUpperCase(),
        role: account.role || null,
      });
      dialog.close();
      this.notice.set(`Conta de ${account.email.trim()} cadastrada${account.role ? ` com o papel ${ROLE_LABEL[account.role]}` : ""}. Entregue a senha inicial por um canal seguro.`);
      await this.load(1);
    } catch (error) {
      this.createError.set(this.message(error));
    } finally {
      this.creating.set(false);
    }
  }
  claimed() { return (this.data()?.invitations ?? []).filter((i) => i.claimedAt); }
  waiting() { return (this.data()?.invitations ?? []).filter((i) => !i.claimedAt); }
  async revoke(email: string, role: Role) {
    if (await this.change("admin/roles/revoke", email, role))
      this.notice.set(`Papel ${ROLE_LABEL[role]} removido de ${email}.`);
  }

  private async change(path: string, email: string, role: Role) {
    this.error.set("");
    this.notice.set("");
    try {
      const result = await this.request<{ status: string }>(path, { email, role });
      await this.load(this.data()?.page ?? 1);
      return result;
    } catch (error) {
      this.error.set(this.message(error));
      return null;
    }
  }
  private async request<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch("/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || "Não foi possível concluir. Tente novamente.");
    }
    return res.json();
  }
  private message(error: unknown) {
    return error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";
  }
}
