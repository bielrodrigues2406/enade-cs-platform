import { Component, signal } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";
import {
  AccountComponent,
  type AccountMode,
  type Credentials,
  type SessionStatus,
} from "./account.component";
type Summary = {
  id: string;
  title: string;
  topic: string;
  origin: string;
  answered: boolean;
};
type Answer = {
  optionId: string;
  revision: number;
  correct: boolean;
  correctOptionId: string;
  explanation: string;
};
type Question = Summary & {
  prompt: string;
  options: { id: string; text: string }[];
  answer: Answer | null;
};

@Component({
  selector: "app-root",
  imports: [FormsModule, AccountComponent],
  template: `
    <a class="skip" href="#content">Ir para o conteúdo</a>
    <header>
      <a href="/" class="brand" aria-label="Caderno de Computação, início"
        ><span class="brand-symbol" aria-hidden="true">cc.</span
        ><span
          >Caderno<span class="brand-sub">CIÊNCIA DA COMPUTAÇÃO</span></span
        ></a
      >
      <div class="header-actions">
        <span class="environment">Base de desenvolvimento</span>
        @if (!booting() && !bootError()) {
          @if (session().mode === "account") {
            <span class="account-email" aria-label="Conta conectada">{{
              accountEmail()
            }}</span>
            <button
              class="text-button"
              (click)="logout()"
              [disabled]="saving() || authBusy()"
            >
              Sair da conta
            </button>
          } @else {
            <button
              class="text-button"
              (click)="openAccount('login')"
              [disabled]="saving() || authBusy()"
            >
              Entrar
            </button>
            <button
              class="outline"
              (click)="openAccount('register')"
              [disabled]="saving() || authBusy()"
            >
              Criar conta
            </button>
          }
        }
      </div>
    </header>
    <div class="layout">
      <aside aria-label="Sobre este caderno">
        <p class="eyebrow">SEU ESPAÇO DE ESTUDO</p>
        <button
          class="nav"
          (click)="back()"
          [disabled]="saving() || authBusy()"
        >
          Banco de questões <span aria-hidden="true">→</span>
        </button>
        <div class="sidebar-note">
          <span class="small-rule"></span>
          <h2>Uma questão.<br />Um conceito mais claro.</h2>
          <p>Leia com atenção, confirme sua resposta e retome de onde parou.</p>
          <p class="muted">
            Nesta base, as questões são autorais demonstrativas. Ainda não há
            questões oficiais importadas.
          </p>
        </div>
      </aside>
      <main id="content" tabindex="-1">
        <div class="breadcrumb">
          ESTUDAR <span>/</span>
          {{
            accountView()
              ? "CONTA"
              : question()
                ? "RESOLUÇÃO"
                : "BANCO DE QUESTÕES"
          }}
        </div>
        @if (booting()) {
          <p role="status">Preparando seu caderno…</p>
        } @else if (bootError()) {
          <section class="notice" role="alert">
            <h1>Não foi possível abrir o caderno</h1>
            <p>{{ bootError() }}</p>
            <button (click)="boot()">Tentar novamente</button>
          </section>
        } @else {
          @if (accountNotice()) {
            <p class="account-success" role="status">{{ accountNotice() }}</p>
          }
          @if (accountView()) {
            <app-account
              [mode]="accountView()!"
              [busy]="authBusy()"
              [error]="authError()"
              (modeChange)="changeAccountMode($event)"
              (submitCredentials)="authenticate($event)"
              (cancel)="closeAccount()"
            />
          } @else if (authBusy()) {
            <p role="status">Atualizando sua sessão…</p>
          } @else if (!question()) {
            <section class="page-intro">
              <p class="eyebrow">PRÁTICA COM CONTEXTO</p>
              <h1>Banco de questões</h1>
              <p>
                Escolha um assunto. Entenda o raciocínio.<br class="desktop" />
                Continue a construir sua base.
              </p>
            </section>
            <div class="source-note">
              <span class="dot" aria-hidden="true"></span>
              <p>
                <strong>Conteúdo de demonstração</strong> · Questões autorais
                para experimentar o fluxo de estudo. Não são questões oficiais
                do ENADE.
              </p>
            </div>
            <form class="filters" (ngSubmit)="loadCatalog()">
              <div>
                <label for="search">Buscar no caderno</label
                ><input
                  id="search"
                  name="search"
                  [(ngModel)]="search"
                  maxlength="120"
                  placeholder="Título ou trecho do enunciado"
                />
              </div>
              <div>
                <label for="topic">Assunto</label
                ><select id="topic" name="topic" [(ngModel)]="topic">
                  <option value="">Todos os assuntos</option>
                  <option>Algoritmos</option>
                  <option>Banco de dados</option>
                  <option>Redes</option>
                </select>
              </div>
              <button type="submit" [disabled]="loading()">Filtrar</button>
              @if (search || topic) {
                <button
                  type="button"
                  class="text-button"
                  (click)="clearFilters()"
                >
                  Limpar
                </button>
              }
            </form>
            <div class="list-heading">
              <h2>Explore o caderno</h2>
              <span>{{ rows().length }} questões nesta seleção</span>
            </div>
            @if (loading()) {
              <p role="status">Buscando questões…</p>
            }
            @if (error()) {
              <div class="notice" role="alert">
                <p>{{ error() }}</p>
                <button (click)="loadCatalog()">Tentar novamente</button>
              </div>
            } @else if (!loading() && rows().length === 0) {
              <div class="empty">
                <h3>Nenhuma questão nesta seleção</h3>
                <p>Experimente outra palavra ou remova os filtros.</p>
                <button (click)="clearFilters()">Limpar filtros</button>
              </div>
            } @else {
              <ol class="question-list">
                @for (row of rows(); track row.id; let i = $index) {
                  <li>
                    <span class="question-number" aria-hidden="true">{{
                      (i + 1).toString().padStart(2, "0")
                    }}</span>
                    <div class="question-summary">
                      <p class="metadata">
                        {{ row.topic }} <span>·</span> Autoral demonstrativa
                      </p>
                      <h3>{{ row.title }}</h3>
                      <p class="state">
                        {{
                          row.answered
                            ? "Resposta salva · você pode revisar"
                            : "Disponível para praticar"
                        }}
                      </p>
                    </div>
                    <button
                      class="outline"
                      (click)="open(row.id)"
                      [disabled]="loading()"
                      [attr.aria-label]="
                        (row.answered ? 'Revisar: ' : 'Resolver: ') + row.title
                      "
                    >
                      {{ row.answered ? "Revisar" : "Resolver" }}
                      <span aria-hidden="true">→</span>
                    </button>
                  </li>
                }
              </ol>
            }
            <footer>
              @if (session().mode === "account") {
                Seu histórico está salvo na sua conta. Entre com o mesmo e-mail
                e senha para retomá-lo em outro navegador.
              } @else {
                Seu histórico fica associado à sessão deste navegador por até 30
                dias.
                <button
                  type="button"
                  class="text-button"
                  (click)="openAccount('register')"
                >
                  Guardar meu histórico em uma conta
                </button>
              }
            </footer>
          } @else {
            <button class="back text-button" (click)="back()">
              ← Voltar ao banco
            </button>
            <article class="resolution">
              <p class="metadata">
                {{ question()!.topic }} <span>·</span> Autoral demonstrativa
                <span>·</span> Versão 1
              </p>
              <h1>{{ question()!.title }}</h1>
              <p class="prompt">{{ question()!.prompt }}</p>
              <form (ngSubmit)="save()">
                <fieldset
                  [disabled]="saving() || (!!question()!.answer && !editing())"
                >
                  <legend>Selecione uma alternativa</legend>
                  @for (
                    option of question()!.options;
                    track option.id;
                    let i = $index
                  ) {
                    <label
                      class="option"
                      [class.selected]="selected === option.id"
                      ><input
                        type="radio"
                        name="answer"
                        [value]="option.id"
                        [(ngModel)]="selected"
                      /><span class="letter" aria-hidden="true">{{
                        "ABCD"[i]
                      }}</span
                      ><span>{{ option.text }}</span></label
                    >
                  }
                </fieldset>
                @if (!question()!.answer || editing()) {
                  <div class="submit-row">
                    <button type="submit" [disabled]="!selected || saving()">
                      {{
                        saving() ? "Confirmando…" : "Confirmar resposta"
                      }}</button
                    ><span>O feedback aparece após a confirmação.</span>
                  </div>
                }
              </form>
              @if (error()) {
                <div class="notice" role="alert">
                  <p>{{ error() }}</p>
                  <p>
                    Sua seleção foi preservada. Tente confirmar novamente; se
                    houver conflito, reabra a questão.
                  </p>
                  <button class="outline" (click)="open(question()!.id)">
                    Reabrir questão
                  </button>
                </div>
              }
              @if (question()!.answer && !editing()) {
                <section
                  class="feedback"
                  aria-label="Resultado da resposta"
                  role="status"
                >
                  <p class="eyebrow">RESPOSTA SALVA</p>
                  <h2>
                    {{
                      question()!.answer!.correct
                        ? "Você acertou."
                        : "Vamos entender este conceito."
                    }}
                  </h2>
                  <p>
                    <strong>Alternativa correta:</strong> {{ correctText() }}
                  </p>
                  <p>{{ question()!.answer!.explanation }}</p>
                  <button class="text-button" (click)="editing.set(true)">
                    Alterar resposta
                  </button>
                </section>
              }
            </article>
          }
        }
      </main>
    </div>
  `,
})
class App {
  rows = signal<Summary[]>([]);
  question = signal<Question | null>(null);
  booting = signal(true);
  bootError = signal("");
  loading = signal(false);
  saving = signal(false);
  error = signal("");
  editing = signal(false);
  search = "";
  topic = "";
  selected = "";
  session = signal<SessionStatus>({ mode: "guest" });
  accountView = signal<AccountMode | null>(null);
  authBusy = signal(false);
  authError = signal("");
  accountNotice = signal("");
  private identityGeneration = 0;
  private identityTransition = 0;
  private requestNumber = 0;
  private identityChannel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel("enade-identity");
  constructor() {
    if (this.identityChannel) {
      this.identityChannel.onmessage = (event) => {
        if (event.data?.type === "identity-changed")
          void this.refreshIdentity(true);
      };
    }
    void this.boot();
  }
  ngOnDestroy() {
    this.identityChannel?.close();
  }
  async api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch("/api/" + path, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(
        data?.message ||
          "Não foi possível confirmar a operação. Verifique a conexão e tente novamente.",
      );
    }
    return res.json();
  }
  async boot() {
    await this.refreshIdentity(false);
  }
  private async refreshIdentity(fromOtherTab: boolean) {
    const transition = ++this.identityTransition;
    this.clearStudyState();
    this.booting.set(true);
    this.authBusy.set(true);
    this.bootError.set("");
    this.authError.set("");
    this.accountView.set(null);
    this.accountNotice.set("");
    try {
      const session = await this.api<SessionStatus>("session", {
        method: "POST",
      });
      if (transition !== this.identityTransition) return;
      this.session.set(session);
      await this.loadCatalog(true);
      if (fromOtherTab && transition === this.identityTransition)
        this.accountNotice.set("Sua sessão foi atualizada em outra aba.");
    } catch (err) {
      if (transition === this.identityTransition)
        this.bootError.set(this.message(err));
    } finally {
      if (transition === this.identityTransition) {
        this.booting.set(false);
        this.authBusy.set(false);
      }
    }
  }
  async loadCatalog(duringTransition = false) {
    if (this.authBusy() && !duringTransition) return;
    const request = ++this.requestNumber;
    this.loading.set(true);
    this.error.set("");
    try {
      const rows = await this.api<Summary[]>(
        "questions?" +
          new URLSearchParams({ q: this.search, topic: this.topic }),
      );
      if (request === this.requestNumber) this.rows.set(rows);
    } catch (err) {
      if (request === this.requestNumber) this.error.set(this.message(err));
    } finally {
      if (request === this.requestNumber) this.loading.set(false);
    }
  }
  async open(id: string) {
    if (this.authBusy()) return;
    const request = ++this.requestNumber;
    this.loading.set(true);
    this.error.set("");
    try {
      const q = await this.api<Question>("questions/" + encodeURIComponent(id));
      if (request !== this.requestNumber) return;
      this.question.set(q);
      this.selected = q.answer?.optionId || "";
      this.editing.set(false);
      this.focusMain();
    } catch (err) {
      if (request === this.requestNumber) this.error.set(this.message(err));
    } finally {
      if (request === this.requestNumber) this.loading.set(false);
    }
  }
  async save() {
    const q = this.question();
    if (!q || !this.selected || this.saving() || this.authBusy()) return;
    const identity = this.identityGeneration;
    this.saving.set(true);
    this.error.set("");
    try {
      const answer = await this.api<Answer>(`questions/${q.id}/answer`, {
        method: "PUT",
        body: JSON.stringify({
          optionId: this.selected,
          baseRevision: q.answer?.revision || 0,
        }),
      });
      if (
        identity === this.identityGeneration &&
        this.question()?.id === q.id
      ) {
        this.question.set({ ...q, answer });
        this.editing.set(false);
      }
    } catch (err) {
      if (identity === this.identityGeneration)
        this.error.set(this.message(err));
    } finally {
      if (identity === this.identityGeneration) this.saving.set(false);
    }
  }
  back() {
    if (this.saving() || this.authBusy()) return;
    this.accountView.set(null);
    this.authError.set("");
    this.accountNotice.set("");
    this.question.set(null);
    this.error.set("");
    void this.loadCatalog();
    this.focusMain();
  }
  clearFilters() {
    if (this.authBusy()) return;
    this.search = "";
    this.topic = "";
    void this.loadCatalog();
  }
  accountEmail() {
    const session = this.session();
    return session.mode === "account" ? session.email : "";
  }
  openAccount(mode: AccountMode) {
    if (this.saving() || this.authBusy() || this.session().mode === "account")
      return;
    this.accountView.set(mode);
    this.authError.set("");
    this.accountNotice.set("");
    this.focusMain();
  }
  changeAccountMode(mode: AccountMode) {
    if (this.authBusy()) return;
    this.accountView.set(mode);
    this.authError.set("");
    this.focusMain();
  }
  closeAccount() {
    if (this.authBusy()) return;
    this.accountView.set(null);
    this.authError.set("");
    if (!this.question()) void this.loadCatalog();
    this.focusMain();
  }
  private clearStudyState() {
    this.identityGeneration++;
    this.requestNumber++;
    this.rows.set([]);
    this.question.set(null);
    this.selected = "";
    this.search = "";
    this.topic = "";
    this.error.set("");
    this.editing.set(false);
    this.loading.set(false);
    this.saving.set(false);
  }
  async authenticate(credentials: Credentials) {
    const mode = this.accountView();
    if (!mode || this.authBusy() || this.saving()) return;
    const transition = ++this.identityTransition;
    this.authBusy.set(true);
    this.authError.set("");
    this.accountNotice.set("");
    this.clearStudyState();
    try {
      const session = await this.api<SessionStatus>(`auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      this.identityChannel?.postMessage({ type: "identity-changed" });
      if (transition !== this.identityTransition) {
        await this.refreshIdentity(false);
        return;
      }
      this.clearStudyState();
      this.session.set(session);
      this.accountView.set(null);
      this.accountNotice.set(
        mode === "register"
          ? "Conta criada. Suas respostas confirmadas foram mantidas."
          : "Você entrou na sua conta. Seu histórico está disponível.",
      );
      await this.loadCatalog(true);
      this.focusMain();
    } catch (err) {
      if (transition !== this.identityTransition) {
        await this.refreshIdentity(false);
        return;
      }
      this.authError.set(this.message(err));
      // A lost response may have applied its cookie. Reconcile before showing study data.
      await this.reconcileSession(transition);
    } finally {
      credentials.password = "";
      if (transition === this.identityTransition) this.authBusy.set(false);
    }
  }
  async logout() {
    if (this.authBusy() || this.saving()) return;
    const transition = ++this.identityTransition;
    this.authBusy.set(true);
    this.authError.set("");
    this.accountNotice.set("");
    this.clearStudyState();
    try {
      const session = await this.api<SessionStatus>("auth/logout", {
        method: "POST",
      });
      this.identityChannel?.postMessage({ type: "identity-changed" });
      if (transition !== this.identityTransition) {
        await this.refreshIdentity(false);
        return;
      }
      this.clearStudyState();
      this.session.set(session);
      this.accountView.set(null);
      this.accountNotice.set(
        "Você saiu da conta. Seu histórico continua guardado para o próximo acesso.",
      );
      await this.loadCatalog(true);
      this.focusMain();
    } catch (err) {
      if (transition !== this.identityTransition) {
        await this.refreshIdentity(false);
        return;
      }
      const message = this.message(err);
      await this.reconcileSession(transition);
      if (transition === this.identityTransition && !this.bootError()) {
        if (this.session().mode === "account") this.error.set(message);
        else
          this.accountNotice.set(
            "Você saiu da conta. Seu histórico continua guardado para o próximo acesso.",
          );
      }
    } finally {
      if (transition === this.identityTransition) this.authBusy.set(false);
    }
  }
  private async reconcileSession(transition: number) {
    const previous = this.session();
    try {
      const session = await this.api<SessionStatus>("session", {
        method: "POST",
      });
      if (transition !== this.identityTransition) return;
      this.session.set(session);
      if (
        previous.mode !== session.mode ||
        (previous.mode === "account" &&
          session.mode === "account" &&
          previous.email !== session.email)
      ) {
        // Only an auth operation's reconciliation can broadcast a newly discovered change.
        // refreshIdentity never rebroadcasts, so receiving tabs cannot form a loop.
        this.identityChannel?.postMessage({ type: "identity-changed" });
      }
      if (session.mode === "account") {
        this.accountView.set(null);
        this.authError.set("");
      }
      if (!this.accountView()) await this.loadCatalog(true);
    } catch {
      if (transition !== this.identityTransition) return;
      this.session.set({ mode: "guest" });
      this.bootError.set(
        "Não foi possível confirmar sua sessão. Tente abrir o caderno novamente.",
      );
    }
  }
  correctText() {
    const q = this.question();
    return (
      q?.options.find((o) => o.id === q.answer?.correctOptionId)?.text || ""
    );
  }
  private message(err: unknown) {
    return err instanceof Error
      ? err.message
      : "Falha de conexão. Tente novamente.";
  }
  private focusMain() {
    setTimeout(() => document.getElementById("content")?.focus(), 0);
  }
}
bootstrapApplication(App).catch(console.error);
