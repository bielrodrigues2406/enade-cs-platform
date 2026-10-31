import { ApplicationRef, Component, HostListener, inject, signal } from "@angular/core";
import { IMAGE_CONFIG } from "@angular/common";
import { bootstrapApplication } from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";
import { CurationComponent } from "./curation.component";
import { HomeComponent } from "./home.component";
import { LandingComponent } from "./landing.component";
import { AdminComponent } from "./admin.component";
import { LessonsComponent } from "./lessons.component";
import { DiscursiveComponent } from "./discursive.component";
import { QuestionContentComponent } from "./question-content.component";
import { ExamComponent } from "./exam.component";
import {
  ReviewComponent,
  type ReviewItem,
  type ReviewPosition,
} from "./review.component";
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
  demonstration: boolean;
  versionNumber: number;
  area?: string | null;
  year?: number | null;
  modality?: string | null;
  questionNumber?: number | null;
};
type CatalogFilters = { q: string; topic: string; area: string; year: string };
type Catalog = {
  items: Summary[];
  total: number;
  answeredTotal: number;
  offset: number;
  limit: number;
  facets: {
    areas: { name: string; count: number }[];
    unclassified: number;
    topics: string[];
    years: number[];
  };
};
const CATALOG_PAGE_SIZE = 20;
type PublicDocument = {
  id: string;
  title: string;
  officialUrl: string;
  sha256: string;
  year: number;
  area: string;
  modality: string;
  pageCount: number;
};
type Answer = {
  optionId: string;
  revision: number;
  correct: boolean;
  correctOptionId: string;
  explanation: string;
  explanationCredit?: string;
  reviewNote?: string | null;
  answerKey?: {
    id: string;
    title: string;
    officialUrl: string;
    sha256: string;
    page: number;
    // D10: só o gabarito publicado, sem se declarar definitivo.
    finality?: "DECLARED" | "ONLY_PUBLISHED" | null;
  };
};
type QuestionImage = { url: string; width: number; height: number; page: number };
type Question = Summary & {
  authorCredit: string;
  prompt: string;
  options: { id: string; text: string }[];
  answer: Answer | null;
  // IMAGE: o recorte da prova é a questão; o texto é transcrição de apoio.
  presentation?: "TEXT" | "IMAGE";
  images?: QuestionImage[];
  reviewOrigin?: "HUMAN" | "ASSISTED";
  provenance: {
    exam: PublicDocument;
    page: number;
    questionNumber: number;
  } | null;
};

@Component({
  selector: "app-root",
  // A página pública ocupa a largura toda, sem o índice lateral.
  host: {
    "[class.landing-mode]": "landingMode()",
    "[class.account-mode]": "!!accountView()",
  },
  imports: [
    FormsModule,
    AccountComponent,
    CurationComponent,
    HomeComponent,
    LandingComponent,
    AdminComponent,
    LessonsComponent,
    DiscursiveComponent,
    QuestionContentComponent,
    ExamComponent,
    ReviewComponent,
  ],
  templateUrl: "./app.component.html",
})
class App {
  rows = signal<Summary[]>([]);
  catalogTopics = signal<string[]>([]);
  catalogAreas = signal<{ name: string; count: number }[]>([]);
  catalogYears = signal<number[]>([]);
  catalogUnclassified = signal(0);
  catalogTotal = signal(0);
  catalogAnswered = signal(0);
  catalogOffset = signal(0);
  readonly catalogPageSize = CATALOG_PAGE_SIZE;
  private appliedFilters: CatalogFilters = { q: "", topic: "", area: "", year: "" };
  private currentAddress = location.pathname + location.search;
  private lastCatalogRequest: { filters: CatalogFilters; offset: number; navigation: "push" | "replace" | "none" } | null = null;
  question = signal<Question | null>(null);
  booting = signal(true);
  bootError = signal("");
  loading = signal(false);
  saving = signal(false);
  error = signal("");
  editing = signal(false);
  search = "";
  topic = "";
  area = "";
  year = "";
  selected = "";
  session = signal<SessionStatus>({ mode: "guest" });
  accountView = signal<AccountMode | null>(null);
  authBusy = signal(false);
  authError = signal("");
  accountNotice = signal("");
  canCurate = signal(false);
  // Papéis da conta (ROLE-1); o servidor confere de novo em cada rota.
  roles = signal<string[]>([]);
  adminView = signal(false);
  lessonsView = signal(false);
  discursiveView = signal(false);
  curationView = signal(false);
  curationBusy = signal(false);
  reviewView = signal(false);
  practiceView = signal(location.pathname === "/treino");
  practiceAttemptId = signal<string | null>(null);
  practiceItemPosition = signal(1);
  practiceBusy = signal(false);
  // A página inicial fica em "/" e o banco de questões em "/questoes".
  homeView = signal(location.pathname === "/");
  reviewReturn = signal(false);
  reviewCurrentVersion = signal<string | null>(null);
  reviewPosition: ReviewPosition = { topic: "", offset: 0 };
  private appRef = inject(ApplicationRef);
  private identityGeneration = 0;
  private identityTransition = 0;
  private requestNumber = 0;
  private identityChannel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel("enade-identity");
  constructor() {
    this.readCatalogAddress();
    this.readPracticeAddress();
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
      await this.loadCurationAccess(transition);
      if (transition !== this.identityTransition) return;
      await this.loadCatalog(true, this.catalogOffset(), "replace", this.appliedFilters);
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
  private async loadCurationAccess(transition: number) {
    if (this.session().mode !== "account") {
      this.canCurate.set(false);
      this.roles.set([]);
      return;
    }
    void this.api<{ roles: string[] }>("access").then(
      (access) => transition === this.identityTransition && this.roles.set(access.roles),
      () => transition === this.identityTransition && this.roles.set([]),
    );
    try {
      const access = await this.api<{ canCurate: boolean }>("curation/access");
      if (transition === this.identityTransition)
        this.canCurate.set(access.canCurate);
    } catch {
      if (transition === this.identityTransition) this.canCurate.set(false);
    }
  }
  openCuration() {
    if (
      !this.canCurate() ||
      this.saving() ||
      this.authBusy() ||
      this.curationBusy() || this.practiceBusy()
    )
      return;
    this.requestNumber++;
    this.homeView.set(false);
    this.reviewView.set(false);
    this.reviewReturn.set(false);
    this.loading.set(false);
    this.question.set(null);
    this.accountView.set(null);
    this.accountNotice.set("");
    this.error.set("");
    this.practiceView.set(false);
    this.adminView.set(false);
    this.lessonsView.set(false);
    this.discursiveView.set(false);
    this.curationView.set(true);
    this.leaveHomePath();
    this.focusMain();
  }
  openHome(event?: Event) {
    event?.preventDefault();
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) return;
    this.requestNumber++;
    this.swapView(() => {
      this.loading.set(false);
      this.question.set(null);
      this.accountView.set(null);
      this.curationView.set(false);
      this.reviewView.set(false);
      this.reviewReturn.set(false);
      this.reviewCurrentVersion.set(null);
      this.authError.set("");
      this.accountNotice.set("");
      this.error.set("");
      this.practiceView.set(false);
      this.homeView.set(true);
    });
    this.setPath("/");
    this.focusMain();
  }
  // Quem ainda não entrou vê a apresentação; quem tem conta, o painel.
  landingMode() {
    return this.homeView() && !this.accountView() && this.session().mode !== "account" && !this.booting();
  }
  browseYear(year: number) {
    history.pushState(null, "", `/questoes?year=${year}`);
    void this.restoreCatalogNavigation();
  }
  onHome() {
    return this.homeView() && !this.accountView();
  }
  openReview() {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) return;
    this.requestNumber++;
    this.swapView(() => {
      this.loading.set(false);
      this.question.set(null);
      this.accountView.set(null);
      this.curationView.set(false);
      this.homeView.set(false);
      this.reviewReturn.set(false);
      this.reviewCurrentVersion.set(null);
      this.accountNotice.set("");
      this.error.set("");
      this.practiceView.set(false);
      this.reviewView.set(true);
    });
    this.leaveHomePath();
    this.focusMain();
  }
  openPractice() {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) return;
    this.requestNumber++;
    this.loading.set(false);
    this.question.set(null);
    this.accountView.set(null);
    this.curationView.set(false);
    this.reviewView.set(false);
    this.reviewReturn.set(false);
    this.reviewCurrentVersion.set(null);
    this.homeView.set(false);
    this.error.set("");
    this.practiceAttemptId.set(null);
    this.practiceItemPosition.set(1);
    this.practiceView.set(true);
    this.writePracticeAddress("push");
    this.focusMain();
  }
  practiceLocationChanged(location_: { attemptId: string | null; position: number }) {
    if (!this.practiceView() || this.authBusy() || location.pathname !== "/treino") return;
    this.practiceAttemptId.set(location_.attemptId);
    this.practiceItemPosition.set(location_.position);
    this.writePracticeAddress("replace");
  }
  private readPracticeAddress() {
    const params = new URLSearchParams(location.search);
    const id = params.getAll("attempt").length === 1 ? params.get("attempt") : null;
    const valid = location.pathname === "/treino" && id && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
    this.practiceAttemptId.set(valid ? id.toLowerCase() : null);
    const position = params.getAll("item").length === 1 ? params.get("item") ?? "1" : "1";
    this.practiceItemPosition.set(valid && /^([1-9]|[1-5][0-9]|60)$/.test(position) ? Number(position) : 1);
  }
  private writePracticeAddress(mode: "push" | "replace") {
    const params = new URLSearchParams();
    if (this.practiceAttemptId()) {
      params.set("attempt", this.practiceAttemptId()!);
      if (this.practiceItemPosition() > 1) params.set("item", String(this.practiceItemPosition()));
    }
    const address = "/treino" + (params.size ? "?" + params.toString() : "");
    if (location.pathname + location.search !== address) {
      if (mode === "push") history.pushState(null, "", address);
      else history.replaceState(null, "", address);
    }
    this.currentAddress = address;
  }
  async openReviewQuestion(item: ReviewItem) {
    if (this.loading() || this.authBusy()) return;
    this.reviewReturn.set(true);
    this.reviewCurrentVersion.set(item.currentVersionId);
    await this.open(item.id, true);
  }
  async loadCatalog(
    duringTransition = false,
    offset = 0,
    navigation: "push" | "replace" | "none" = "push",
    filters: CatalogFilters = this.filterValues(),
  ): Promise<Catalog | null> {
    if (this.authBusy() && !duringTransition) return null;
    const request = ++this.requestNumber;
    this.lastCatalogRequest = { filters: { ...filters }, offset, navigation };
    this.loading.set(true);
    this.error.set("");
    try {
      const catalog = await this.api<Catalog>(
        "catalog?" + new URLSearchParams({ ...filters, limit: String(CATALOG_PAGE_SIZE), offset: String(offset) }),
      );
      if (request !== this.requestNumber) return null;
      this.applyCatalog(catalog, filters, navigation);
      return catalog;
    } catch (err) {
      if (request === this.requestNumber) this.error.set(this.message(err));
      return null;
    } finally {
      if (request === this.requestNumber) this.loading.set(false);
    }
  }
  private applyCatalog(catalog: Catalog, filters: CatalogFilters, navigation: "push" | "replace" | "none") {
    this.rows.set(catalog.items);
    this.catalogTopics.set(catalog.facets.topics);
    this.catalogAreas.set(catalog.facets.areas);
    this.catalogYears.set(catalog.facets.years);
    this.catalogUnclassified.set(catalog.facets.unclassified);
    this.catalogTotal.set(catalog.total);
    this.catalogAnswered.set(catalog.answeredTotal);
    this.catalogOffset.set(catalog.offset);
    this.appliedFilters = { ...filters };
    if (location.pathname === "/questoes") this.writeCatalogAddress(navigation);
  }
  private filterValues(): CatalogFilters {
    return { q: this.search, topic: this.topic, area: this.area, year: this.year };
  }
  async retryCatalog() {
    const pending = this.lastCatalogRequest;
    if (await this.loadCatalog(false, pending?.offset ?? this.catalogOffset(), pending?.navigation ?? "replace", pending?.filters ?? this.appliedFilters)) {
      this.restoreFilterFields();
    }
  }
  hasCatalogArea(area: string) {
    return this.catalogAreas().some((entry) => entry.name === area);
  }
  hasCatalogYear(year: string) {
    return this.catalogYears().includes(Number(year));
  }
  catalogPage() {
    return Math.floor(this.catalogOffset() / CATALOG_PAGE_SIZE) + 1;
  }
  catalogPages() {
    return Math.max(1, Math.ceil(this.catalogTotal() / CATALOG_PAGE_SIZE));
  }
  async changeCatalogPage(direction: number) {
    if (this.loading() || this.authBusy()) return;
    const offset = Math.max(0, this.catalogOffset() + direction * CATALOG_PAGE_SIZE);
    if (await this.loadCatalog(false, offset, "push", this.appliedFilters)) {
      this.restoreFilterFields();
      setTimeout(() => document.getElementById("catalog-results")?.focus(), 0);
    }
  }
  async openNext() {
    if (this.loading() || this.saving() || this.authBusy()) return;
    const next = this.nextQuestion();
    if (!next) return;
    if (next.id) { await this.open(next.id); return; }
    const request = ++this.requestNumber;
    const filters = { ...this.appliedFilters };
    const offset = this.catalogOffset() + CATALOG_PAGE_SIZE;
    this.loading.set(true);
    this.error.set("");
    try {
      const catalog = await this.api<Catalog>("catalog?" + new URLSearchParams({ ...filters, limit: String(CATALOG_PAGE_SIZE), offset: String(offset) }));
      if (request !== this.requestNumber) return;
      if (!catalog.items[0] || catalog.offset < offset) {
        this.error.set("Esta seleção foi atualizada. Volte ao banco para conferir as questões disponíveis.");
        return;
      }
      const question = await this.api<Question>("questions/" + encodeURIComponent(catalog.items[0].id));
      if (request !== this.requestNumber) return;
      // Commit the new page only after its question is available. A network
      // failure keeps the answered question and its original position intact.
      this.applyCatalog(catalog, filters, "push");
      this.showQuestion(question, false, request);
    } catch (err) {
      if (request === this.requestNumber) this.error.set(this.message(err));
    } finally {
      if (request === this.requestNumber) this.loading.set(false);
    }
  }
  private showQuestion(q: Question, retry: boolean, request: number) {
    this.swapView(() => {
      this.reviewView.set(false);
      this.homeView.set(false);
      this.practiceView.set(false);
      this.question.set(q);
      this.selected = retry ? "" : q.answer?.optionId || "";
      this.editing.set(retry);
    }, () => request === this.requestNumber);
    this.leaveHomePath();
    this.focusMain();
  }
  async open(id: string, retry = false) {
    if (this.authBusy()) return;
    const request = ++this.requestNumber;
    this.loading.set(true);
    this.error.set("");
    try {
      const q = await this.api<Question>("questions/" + encodeURIComponent(id));
      if (request !== this.requestNumber) return;
      this.showQuestion(q, retry, request);
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
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) return;
    this.swapView(() => {
      this.homeView.set(false);
      this.practiceView.set(false);
      this.curationView.set(false);
      this.reviewView.set(false);
      this.reviewReturn.set(false);
      this.reviewCurrentVersion.set(null);
      this.accountView.set(null);
      this.authError.set("");
      this.accountNotice.set("");
      this.question.set(null);
      this.error.set("");
    });
    this.restoreFilterFields();
    this.setPath("/questoes");
    this.writeCatalogAddress("replace");
    void this.loadCatalog(false, this.catalogOffset(), "replace", this.appliedFilters);
    this.focusMain();
  }
  // As outras telas continuam sobre o endereço da seleção do banco.
  // O endereço contém filtros e página, nunca respostas ou dados da conta.
  private setPath(path: string) {
    if (location.pathname !== path) history.replaceState(null, "", path);
    this.currentAddress = location.pathname + location.search;
  }
  private leaveHomePath() {
    if (location.pathname === "/" || location.pathname === "/treino") {
      this.setPath("/questoes");
      this.writeCatalogAddress("replace");
    }
  }
  private restoreFilterFields() {
    this.search = this.appliedFilters.q;
    this.topic = this.appliedFilters.topic;
    this.area = this.appliedFilters.area;
    this.year = this.appliedFilters.year;
  }
  private readCatalogAddress() {
    const params = new URLSearchParams(location.search);
    const value = (key: string, max: number) => {
      const entry = params.get(key) ?? "";
      return params.getAll(key).length === 1 && entry.length <= max ? entry : "";
    };
    const year = value("year", 4);
    this.appliedFilters = location.pathname === "/questoes"
      ? { q: value("q", 120), topic: value("topic", 80), area: value("area", 80), year: /^(20[0-9]{2}|2100)$/.test(year) ? year : "" }
      : { q: "", topic: "", area: "", year: "" };
    this.restoreFilterFields();
    const page = value("page", 6);
    const number = /^[1-9][0-9]{0,5}$/.test(page) ? Number(page) : 1;
    this.catalogOffset.set(number <= 50001 ? (number - 1) * CATALOG_PAGE_SIZE : 0);
  }
  private writeCatalogAddress(mode: "push" | "replace" | "none") {
    if (mode === "none") return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(this.appliedFilters)) if (value) params.set(key, value);
    if (this.catalogPage() > 1) params.set("page", String(this.catalogPage()));
    const address = "/questoes" + (params.size ? "?" + params.toString() : "");
    if (location.pathname + location.search !== address) {
      if (mode === "push") history.pushState(null, "", address);
      else history.replaceState(null, "", address);
    }
    this.currentAddress = address;
  }
  @HostListener("window:popstate")
  async restoreCatalogNavigation() {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) {
      history.pushState(null, "", this.currentAddress);
      return;
    }
    this.adminView.set(false);
    this.lessonsView.set(false);
    this.discursiveView.set(false);
    this.question.set(null);
    this.selected = "";
    this.editing.set(false);
    this.reviewView.set(false);
    this.reviewReturn.set(false);
    this.reviewCurrentVersion.set(null);
    this.curationView.set(false);
    this.accountView.set(null);
    this.homeView.set(location.pathname === "/");
    this.practiceView.set(location.pathname === "/treino");
    if (this.practiceView()) {
      this.requestNumber++;
      this.loading.set(false);
      this.error.set("");
      this.readPracticeAddress();
      this.currentAddress = location.pathname + location.search;
      this.focusMain();
      return;
    }
    this.readCatalogAddress();
    this.currentAddress = location.pathname + location.search;
    await this.loadCatalog(false, this.catalogOffset(), "replace", this.appliedFilters);
    this.focusMain();
  }
  clearFilters() {
    if (this.authBusy()) return;
    this.search = "";
    this.topic = "";
    this.area = "";
    this.year = "";
    void this.loadCatalog();
  }
  accountEmail() {
    const session = this.session();
    return session.mode === "account" ? session.email : "";
  }
  openAccount(mode: AccountMode) {
    if (this.saving() || this.authBusy() || this.practiceBusy() || this.session().mode === "account")
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
    if (!this.question() && !this.reviewView() && !this.practiceView()) void this.loadCatalog(false, this.catalogOffset(), "replace", this.appliedFilters);
    this.focusMain();
  }
  openAdmin() {
    if (!this.roles().includes("ADMIN") || this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy())
      return;
    this.swapView(() => {
      this.question.set(null);
      this.accountView.set(null);
      this.curationView.set(false);
      this.reviewView.set(false);
      this.reviewReturn.set(false);
      this.adminView.set(true);
    });
    this.leaveHomePath();
    this.focusMain();
  }
  isStaff() {
    return this.roles().includes("PROFESSOR") || this.roles().includes("ADMIN");
  }
  openLessons() {
    if (this.session().mode !== "account" || this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy())
      return;
    this.swapView(() => {
      this.question.set(null);
      this.accountView.set(null);
      this.curationView.set(false);
      this.reviewView.set(false);
      this.reviewReturn.set(false);
      this.lessonsView.set(true);
    });
    this.leaveHomePath();
    this.focusMain();
  }
  openDiscursive() {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) return;
    this.swapView(() => {
      this.question.set(null);
      this.accountView.set(null);
      this.curationView.set(false);
      this.reviewView.set(false);
      this.reviewReturn.set(false);
      this.discursiveView.set(true);
    });
    this.leaveHomePath();
    this.focusMain();
  }
  private clearStudyState() {
    this.adminView.set(false);
    this.lessonsView.set(false);
    this.discursiveView.set(false);
    if (this.identityGeneration > 0 && this.practiceView()) {
      this.practiceAttemptId.set(null);
      this.practiceItemPosition.set(1);
      this.writePracticeAddress("replace");
    }
    this.practiceBusy.set(false);
    this.reviewView.set(false);
    this.reviewReturn.set(false);
    this.reviewCurrentVersion.set(null);
    this.reviewPosition = { topic: "", offset: 0 };
    this.curationView.set(false);
    this.canCurate.set(false);
    this.curationBusy.set(false);
    this.identityGeneration++;
    this.requestNumber++;
    this.rows.set([]);
    this.catalogTopics.set([]);
    this.catalogAreas.set([]);
    this.catalogYears.set([]);
    this.catalogUnclassified.set(0);
    this.catalogTotal.set(0);
    this.catalogAnswered.set(0);
    this.lastCatalogRequest = null;
    this.question.set(null);
    this.selected = "";
    this.restoreFilterFields();
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
      await this.loadCurationAccess(transition);
      if (transition !== this.identityTransition) return;
      this.accountView.set(null);
      this.accountNotice.set(
        mode === "register"
          ? "Conta criada. Suas respostas confirmadas foram mantidas."
          : "Você entrou na sua conta. Seu histórico está disponível.",
      );
      await this.loadCatalog(true, this.catalogOffset(), "replace", this.appliedFilters);
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
    if (this.authBusy() || this.saving() || this.curationBusy() || this.practiceBusy()) return;
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
      await this.loadCurationAccess(transition);
      if (transition !== this.identityTransition) return;
      this.accountView.set(null);
      this.accountNotice.set(
        "Você saiu da conta. Seu histórico continua guardado para o próximo acesso.",
      );
      await this.loadCatalog(true, this.catalogOffset(), "replace", this.appliedFilters);
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
      await this.loadCurationAccess(transition);
      if (transition !== this.identityTransition) return;
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
      if (!this.accountView()) await this.loadCatalog(true, this.catalogOffset(), "replace", this.appliedFilters);
    } catch {
      if (transition !== this.identityTransition) return;
      this.session.set({ mode: "guest" });
      this.bootError.set(
        "Não foi possível confirmar sua sessão. Tente abrir o caderno novamente.",
      );
    }
  }
  originLabel(origin: string, demonstration = false) {
    return origin === "OFFICIAL"
      ? "Oficial · Inep"
      : demonstration
        ? "Autoral demonstrativa"
        : "Autoral";
  }
  modalityLabel(modality: string) {
    return (
      (
        {
          BACHARELADO: "Bacharelado",
          LICENCIATURA: "Licenciatura",
          CST: "Curso superior de tecnologia",
          COMUM: "Caderno compartilhado",
        } as Record<string, string>
      )[modality] || modality
    );
  }
  correctText() {
    const q = this.question();
    if (this.isImage()) return q?.answer?.correctOptionId ?? "";
    return (
      q?.options.find((o) => o.id === q.answer?.correctOptionId)?.text || ""
    );
  }
  isImage() {
    const q = this.question();
    return q?.presentation === "IMAGE" && !!q.images?.length;
  }
  // Posição só faz sentido quando a questão veio do catálogo atual.
  position() {
    const q = this.question();
    if (!q || this.reviewReturn()) return null;
    const index = this.rows().findIndex((row) => row.id === q.id);
    return index < 0 ? null : { index: this.catalogOffset() + index, total: this.catalogTotal() };
  }
  nextQuestion() {
    const q = this.question();
    if (!q || this.reviewReturn()) return null;
    const index = this.rows().findIndex((row) => row.id === q.id);
    if (index < 0) return null;
    return this.rows()[index + 1] ?? (this.catalogOffset() + index + 1 < this.catalogTotal() ? { id: "", title: "da próxima página" } : null);
  }
  optionOutcome(optionId: string): "correct" | "wrong" | null {
    const answer = this.question()?.answer;
    if (!answer || this.editing()) return null;
    if (optionId === answer.correctOptionId) return "correct";
    return optionId === answer.optionId ? "wrong" : null;
  }
  private message(err: unknown) {
    return err instanceof Error
      ? err.message
      : "Falha de conexão. Tente novamente.";
  }
  // Troca de tela com View Transition quando disponível. O estado muda dentro
  // do callback e é renderizado na hora, para o navegador capturar o "depois".
  // O callback roda um quadro depois: se a identidade ou a requisição mudaram
  // nesse intervalo, o estado antigo não é aplicado.
  private swapView(update: () => void, stillCurrent = () => true) {
    const generation = this.identityGeneration;
    const apply = () => {
      if (generation !== this.identityGeneration || !stillCurrent()) return;
      this.adminView.set(false);
    this.lessonsView.set(false);
    this.discursiveView.set(false);
      update();
    };
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => unknown;
    };
    if (
      !doc.startViewTransition ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      apply();
      return;
    }
    doc.startViewTransition(() => {
      apply();
      this.appRef.tick();
    });
  }
  private focusMain() {
    setTimeout(() => document.getElementById("content")?.focus(), 0);
  }
  skipToContent(event: Event) {
    event.preventDefault();
    this.focusMain();
  }
}
bootstrapApplication(App, {
  // Os recortes das questões vêm em 200 dpi de propósito: a mesma imagem
  // serve à leitura e à ampliação. O aviso de imagem maior que a exibida
  // não se aplica a eles.
  providers: [
    { provide: IMAGE_CONFIG, useValue: { disableImageSizeWarning: true } },
  ],
}).catch(console.error);
