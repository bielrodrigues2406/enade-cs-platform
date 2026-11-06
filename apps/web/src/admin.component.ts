import { requestJson } from "./api-request";
import { Component, EventEmitter, Output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ExamImportComponent } from "./exam-import.component";
import { ActivityComponent } from "./activity.component";

// Administração (ROLE-1, D14): contas cadastradas e papéis. O servidor
// confere o papel em cada chamada; esta tela só organiza as ações.
type Role = "ADMIN" | "PROFESSOR";
type AdminTab = "accounts" | "imports" | "activity";
type UserRow = {
  id: string;
  email: string;
  name: string | null;
  enrollment: string | null;
  createdAt: string;
  roles: Role[];
  answers: number;
  activeSessions: number;
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

function validateDisplayName(value: string): string {
  const length = value.trim().replace(/\s+/g, " ").length;
  return length < 2 ? "Informe o nome com pelo menos 2 caracteres."
    : length > 120 ? "Use até 120 caracteres no nome." : "";
}

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Administração", PROFESSOR: "Professor" };

@Component({
  selector: "app-admin",
  imports: [FormsModule, ExamImportComponent, ActivityComponent],
  templateUrl: "./admin.component.html",
  styleUrl: "./admin.component.css",
})
export class AdminComponent {
  @Output() back = new EventEmitter<void>();
  readonly roleLabel = ROLE_LABEL;
  readonly tabs: { id: AdminTab; label: string }[] = [
    { id: "accounts", label: "Contas e papéis" },
    { id: "imports", label: "Importar prova" },
    { id: "activity", label: "Atividades" },
  ];
  tab = signal<AdminTab>("accounts");
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
  nameChecked = signal(false);

  managedUser = signal<UserRow | null>(null);
  editForm = { name: "", enrollment: "", email: "", adminPassword: "", reason: "" };
  resetForm = { newPassword: "", adminPassword: "", reason: "" };
  deleteForm = { confirmText: "", adminPassword: "", reason: "" };
  sessionReason = "";
  savingEdit = signal(false);
  editError = signal("");
  editNameChecked = signal(false);
  resettingPassword = signal(false);
  resetError = signal("");
  revokingSessions = signal(false);
  sessionError = signal("");
  deletingAccount = signal(false);
  deleteError = signal("");
  showEditAdminPassword = false;
  showResetAdminPassword = false;
  showDeleteAdminPassword = false;

  ngOnInit() {
    void this.load(1);
  }
  navigateTabs(event: KeyboardEvent, index: number) {
    const last = this.tabs.length - 1;
    const next = event.key === "Home" ? 0 : event.key === "End" ? last
      : event.key === "ArrowRight" ? (index + 1) % this.tabs.length
      : event.key === "ArrowLeft" ? (index + last) % this.tabs.length : null;
    if (next === null) return;
    event.preventDefault();
    this.tab.set(this.tabs[next].id);
    const button = event.currentTarget as HTMLButtonElement;
    button.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  accountNameError() {
    return validateDisplayName(this.newAccount.name);
  }
  managedNameError() {
    return validateDisplayName(this.editForm.name);
  }
  managedEmailChanged() {
    const current = this.managedUser()?.email ?? "";
    const next = this.editForm.email.trim().toLowerCase();
    return Boolean(current && next && next !== current);
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
    this.nameChecked.set(false);
    dialog.showModal();
  }
  suggestPassword() {
    this.newAccount.password = generatePassword();
  }
  openManage(user: UserRow, dialog: HTMLDialogElement) {
    this.managedUser.set(user);
    this.editForm = {
      name: user.name ?? "",
      enrollment: user.enrollment ?? "",
      email: user.email,
      adminPassword: "",
      reason: "",
    };
    this.resetForm = { newPassword: generatePassword(), adminPassword: "", reason: "" };
    this.deleteForm = { confirmText: "", adminPassword: "", reason: "" };
    this.sessionReason = "";
    this.editError.set("");
    this.editNameChecked.set(false);
    this.resetError.set("");
    this.sessionError.set("");
    this.deleteError.set("");
    this.showEditAdminPassword = false;
    this.showResetAdminPassword = false;
    this.showDeleteAdminPassword = false;
    dialog.showModal();
  }
  suggestResetPassword() {
    this.resetForm.newPassword = generatePassword();
  }
  async saveManagedProfile(dialog: HTMLDialogElement) {
    const user = this.managedUser();
    if (!user) return;
    this.editError.set("");
    this.editNameChecked.set(true);
    if (this.managedNameError()) {
      dialog.querySelector<HTMLInputElement>("#manage-account-name")?.focus();
      return;
    }
    const email = this.editForm.email.trim();
    if (!email) return this.editError.set("Informe o e-mail.");
    if (this.managedEmailChanged() && !this.editForm.adminPassword) {
      return this.editError.set("Confirme sua senha de administrador para alterar o e-mail.");
    }
    this.savingEdit.set(true);
    try {
      const updated = await this.request<{ email: string; name: string | null }>(
        `admin/accounts/${user.id}`,
        {
          name: this.editForm.name.trim(),
          enrollment: this.editForm.enrollment.trim().toUpperCase(),
          email,
          adminPassword: this.managedEmailChanged() ? this.editForm.adminPassword : undefined,
          reason: this.editForm.reason.trim() || undefined,
        },
        "PUT",
      );
      dialog.close();
      this.notice.set(`Dados da conta de ${updated.email} atualizados.`);
      await this.load(this.data()?.page ?? 1);
    } catch (error) {
      this.editError.set(this.message(error));
    } finally {
      this.savingEdit.set(false);
    }
  }
  async resetManagedPassword(dialog: HTMLDialogElement) {
    const user = this.managedUser();
    if (!user) return;
    this.resetError.set("");
    const length = [...this.resetForm.newPassword].length;
    if (length < 12 || length > 128) {
      return this.resetError.set("A senha provisória deve ter de 12 a 128 caracteres.");
    }
    if (!this.resetForm.adminPassword) {
      return this.resetError.set("Confirme sua senha de administrador para redefinir a senha.");
    }
    this.resettingPassword.set(true);
    try {
      const result = await this.request<{ revokedSessions: number }>(
        `admin/accounts/${user.id}/reset-password`,
        {
          newPassword: this.resetForm.newPassword,
          adminPassword: this.resetForm.adminPassword,
          reason: this.resetForm.reason.trim() || undefined,
        },
      );
      dialog.close();
      const sessionsNote = result.revokedSessions
        ? ` (${result.revokedSessions} sessão(ões) encerrada(s))`
        : "";
      this.notice.set(
        `Senha de ${user.email} redefinida${sessionsNote}. Entregue a senha provisória por um canal seguro.`,
      );
      await this.load(this.data()?.page ?? 1);
    } catch (error) {
      this.resetError.set(this.message(error));
    } finally {
      this.resettingPassword.set(false);
    }
  }
  async revokeManagedSessions(dialog: HTMLDialogElement) {
    const user = this.managedUser();
    if (!user) return;
    this.sessionError.set("");
    this.revokingSessions.set(true);
    try {
      const result = await this.request<{ revokedSessions: number }>(
        `admin/accounts/${user.id}/revoke-sessions`,
        { reason: this.sessionReason.trim() || undefined },
      );
      dialog.close();
      this.notice.set(
        result.revokedSessions
          ? `${result.revokedSessions} sessão(ões) de ${user.email} encerrada(s).`
          : `Nenhuma sessão ativa para encerrar em ${user.email}.`,
      );
      await this.load(this.data()?.page ?? 1);
    } catch (error) {
      this.sessionError.set(this.message(error));
    } finally {
      this.revokingSessions.set(false);
    }
  }
  async deleteManagedAccount(dialog: HTMLDialogElement) {
    const user = this.managedUser();
    if (!user) return;
    this.deleteError.set("");
    if (this.deleteForm.confirmText.trim().toUpperCase() !== "EXCLUIR") {
      return this.deleteError.set("Digite EXCLUIR para confirmar a remoção definitiva.");
    }
    if (!this.deleteForm.adminPassword) {
      return this.deleteError.set("Confirme sua senha de administrador para excluir a conta.");
    }
    this.deletingAccount.set(true);
    try {
      const result = await this.request<{ status: "DELETED" | "ANONYMIZED" }>(
        `admin/accounts/${user.id}/delete`,
        {
          adminPassword: this.deleteForm.adminPassword,
          reason: this.deleteForm.reason.trim() || undefined,
        },
      );
      dialog.close();
      this.notice.set(
        result.status === "DELETED"
          ? `Conta e dados de estudo de ${user.email} excluídos.`
          : `Dados pessoais e de estudo de ${user.email} excluídos (autoria institucional anonimizada).`,
      );
      await this.load(1);
    } catch (error) {
      this.deleteError.set(this.message(error));
    } finally {
      this.deletingAccount.set(false);
    }
  }
  /** Cadastro feito pelo admin: a conta já nasce com o papel escolhido, sem convite. */
  async createAccount(dialog: HTMLDialogElement) {
    const account = this.newAccount;
    const length = [...account.password].length;
    this.createError.set("");
    this.nameChecked.set(true);
    if (this.accountNameError()) {
      dialog.querySelector<HTMLInputElement>("#new-account-name")?.focus();
      return;
    }
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
  private async request<T>(path: string, body?: unknown, method?: "GET" | "POST" | "PUT"): Promise<T> {
    return requestJson<T>("/api/" + path, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  private message(error: unknown) {
    return error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";
  }
}
