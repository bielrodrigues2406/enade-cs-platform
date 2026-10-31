import { Component, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

// Registro de atividades (ACT-1): leitura para a administração, com filtro por
// categoria, busca por e-mail, assunto ou IP e resumo das últimas 24 horas.

type Category = "ACCESS" | "SECURITY" | "ACCOUNT" | "ROLE" | "CONTENT" | "CLASS";
type ActivityRow = {
  id: string; at: string; category: Category; action: string;
  actorEmail: string | null; actorName: string | null;
  subject: string | null; detail: string | null; ip: string | null;
};
type ActivityPage = {
  total: number; page: number; pageSize: number; retentionDays: number;
  summary: { logins: number; failedLogins: number; blocked: number; suspiciousIps: number };
  items: ActivityRow[];
};

export const CATEGORY_LABEL: Record<Category, string> = {
  ACCESS: "Acesso", SECURITY: "Segurança", ACCOUNT: "Conta", ROLE: "Papel", CONTENT: "Conteúdo", CLASS: "Turma",
};
/** Nome legível de cada ação; ações novas aparecem com o código até ganharem nome. */
export const ACTION_LABEL: Record<string, string> = {
  LOGIN: "Entrou", LOGIN_FAILED: "Senha errada no login", REGISTER: "Criou conta",
  LOGIN_BLOCKED: "Login bloqueado por tentativas", GUEST_LIMITED: "Sessões de visitante bloqueadas",
  RATE_LIMITED: "Excesso de requisições bloqueado", WRONG_PASSWORD: "Senha atual errada no perfil",
  PROFILE_UPDATED: "Atualizou o perfil", EMAIL_CHANGED: "Trocou o e-mail", PASSWORD_CHANGED: "Trocou a senha",
  ACCOUNT_CREATED: "Conta cadastrada pelo admin",
  ROLE_GRANTED: "Papel concedido", ROLE_INVITED: "E-mail autorizado", ROLE_CLAIMED: "Convite reivindicado no cadastro",
  ROLE_REVOKED: "Papel removido", ROLE_INVITATION_CANCELLED: "Autorização cancelada",
  QUESTION_CREATED: "Criou questão", QUESTION_SUBMITTED: "Enviou questão para revisão", QUESTION_PUBLISHED: "Publicou questão",
  QUESTION_REJECTED: "Devolveu questão", QUESTION_VERSION_CREATED: "Abriu nova versão de questão",
  IMPORT_UPLOADED: "Enviou prova para importar", IMPORT_PUBLISHED: "Publicou importação",
  CLASS_CREATED: "Criou turma", ROSTER_IMPORTED: "Importou lista da turma",
};

@Component({
  selector: "app-activity",
  imports: [FormsModule],
  templateUrl: "./activity.component.html",
  styleUrl: "./activity.component.css",
})
export class ActivityComponent {
  readonly categories = Object.entries(CATEGORY_LABEL) as [Category, string][];
  readonly categoryLabel = CATEGORY_LABEL;
  data = signal<ActivityPage | null>(null);
  loading = signal(false);
  error = signal("");
  category = "";
  search = "";

  ngOnInit() {
    void this.load(1);
  }

  async load(page: number) {
    this.loading.set(true);
    this.error.set("");
    try {
      const params = new URLSearchParams({ category: this.category, q: this.search.trim(), page: String(page) });
      const res = await fetch(`/api/admin/activity?${params}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Não foi possível carregar o registro.");
      this.data.set(body);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "Não foi possível carregar o registro.");
    } finally {
      this.loading.set(false);
    }
  }

  pageCount() {
    const data = this.data();
    return data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  }
  actionLabel(action: string) {
    return ACTION_LABEL[action] ?? action;
  }
  who(row: ActivityRow) {
    return row.actorName ? `${row.actorName} · ${row.actorEmail}` : row.actorEmail ?? "Sem conta";
  }
  when(iso: string) {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
  }
  /** Filtrar pelo IP de uma linha (por exemplo, para ver tudo o que um endereço suspeito fez). */
  filterIp(ip: string) {
    this.category = "";
    this.search = ip;
    void this.load(1);
  }
}
