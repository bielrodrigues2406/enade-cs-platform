import { StudyNavigationComponent } from "./study-navigation.component";
import { destinationFromPath, libraryPath, sectionPathOf, SECTION_PATHS, type Destination } from "./study-navigation";
import { MascotService } from "./mascot.service";
import { AnswerReflectionComponent } from "./answer-reflection.component";
import { MascotComponent } from "./mascot.component";
import { ApplicationRef, Component, ElementRef, HostListener, ViewChild, effect, inject, signal } from "@angular/core";
import { IMAGE_CONFIG } from "@angular/common";
import { bootstrapApplication } from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";
import { CurationComponent } from "./curation.component";
import { HomeComponent, forgetHomeSnapshot } from "./home.component";
import { LandingComponent } from "./landing.component";
import { AdminComponent } from "./admin.component";
import { LessonsComponent } from "./lessons.component";
import { DiscursiveComponent } from "./discursive.component";
import { QuestionContentComponent } from "./question-content.component";
import { ExamComponent } from "./exam.component";
import { ProfileComponent } from "./profile.component";
import { firstName, initials } from "./initials";
import { EngagementService } from "./engagement.service";
import { NewsService, type NewsDestination } from "./news.service";
import { ResumeService } from "./resume.service";
import { NewsDialogComponent } from "./news-dialog.component";
import { requestJson } from "./api-request";
import { ServiceNoticeComponent } from "./service-notice.component";
import { GoalRingComponent } from "./goal-ring.component";
import { AchievementToastComponent } from "./achievement-toast.component";
import { ProgressComponent } from "./progress.component";
import { LibraryComponent } from "./library.component";
import { QuestionConceptsComponent } from "./question-concepts.component";
import { FlashcardsComponent } from "./flashcards.component";
import { ChoiceDialogComponent, ChoiceService } from "./choice-dialog";
import { requestPractice, type PracticeRequest } from "./practice-request";
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
import { originLabel } from "./origin-label";
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
/** origin: vazio = provas e autorais; "generated" = só as geradas por IA. */
type CatalogFilters = { q: string; topic: string; area: string; year: string; origin: string };
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
    ServiceNoticeComponent,
    StudyNavigationComponent,
    AnswerReflectionComponent,
    MascotComponent,
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
    ProfileComponent,
    ChoiceDialogComponent,
    ReviewComponent,
    GoalRingComponent,
    AchievementToastComponent,
    NewsDialogComponent,
    ProgressComponent,
    LibraryComponent,
    QuestionConceptsComponent,
    FlashcardsComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app-shell.css",
})
class App {
  readonly mascot = inject(MascotService);
  readonly destination = signal<Destination>(destinationFromPath(location.pathname));
  @ViewChild(StudyNavigationComponent) private navigation?: StudyNavigationComponent;
  @ViewChild("accountPopover") private accountPopover?: ElementRef<HTMLElement>;
  readonly extraFilters = signal(false);
  upcomingExamFooter() { return Date.now() <= new Date(2026, 10, 29, 23, 59, 59, 999).getTime(); }
  navigationBusy() { return this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy(); }
  openNavigation() { this.navigation?.open(); }
  navigate(destination: Destination) {
    this.accountPopover?.nativeElement.hidePopover();
    switch (destination) {
      case "inicio": this.openHome(); break;
      case "questoes": this.back(); break;
      case "caderno": this.openReview(); break;
      case "treino": case "provas": this.openPractice(destination); break;
      case "discursivas": this.openDiscursive(); break;
      case "biblioteca": case "flashcards": case "conquistas": this.openStudy(destination); break;
      case "aulas": this.openLessons(); break;
      case "perfil": this.openProfile(); break;
      case "curadoria": this.openCuration(); break;
      case "administracao": this.openAdmin(); break;
    }
  }
  accountAction(action: "profile" | "logout" | "progress") {
    this.accountPopover?.nativeElement.hidePopover();
    if (action === "profile") this.openProfile();
    else if (action === "logout") void this.logout();
    else this.openStudy("conquistas");
  }
  advancedFiltersActive() { return Number(!!this.topic) + Number(!!this.year); }
  filtersToggled(event: Event) { this.extraFilters.set((event.target as HTMLDetailsElement).open); }

  readonly reflectionState = signal({ dirty: false, saving: false });
  readonly discursiveState = signal({ dirty: false, saving: false });

  private leavePersonalDraft(then: () => void) {
    const reflection = this.reflectionState(), discursive = this.discursiveState();
    if (reflection.saving || discursive.saving) return false;
    if (!reflection.dirty && !discursive.dirty) return true;
    void this.choice.confirm({
      title: discursive.dirty ? "Sair sem guardar o rascunho?" : "Sair sem guardar a reflexão?",
      message: discursive.dirty ? "O texto da discursiva ainda não foi confirmado no servidor." : "O texto que você escreveu ainda não foi guardado no caderno.",
      cancel: "Continuar escrevendo", confirm: "Descartar e sair",
    }).then(ok => {
      if (!ok) return;
      this.reflectionState.set({ dirty: false, saving: false });
      this.discursiveState.set({ dirty: false, saving: false });
      then();
    });
    return false;
  }

  editAnswer() {
    if (this.leavePersonalDraft(() => this.editAnswer())) this.editing.set(true);
  }
  rows = signal<Summary[]>([]);
  catalogTopics = signal<string[]>([]);
  catalogAreas = signal<{ name: string; count: number }[]>([]);
  catalogYears = signal<number[]>([]);
  catalogUnclassified = signal(0);
  catalogTotal = signal(0);
  catalogAnswered = signal(0);
  catalogOffset = signal(0);
  readonly catalogPageSize = CATALOG_PAGE_SIZE;
  private appliedFilters: CatalogFilters = { q: "", topic: "", area: "", year: "", origin: "" };
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
  origin = "";
  selected = "";
  session = signal<SessionStatus>({ mode: "guest" });
  accountView = signal<AccountMode | null>(null);
  authBusy = signal(false);
  authError = signal("");
  accountNotice = signal("");
  sessionError = signal("");
  canCurate = signal(false);
  // Papéis da conta (ROLE-1); o servidor confere de novo em cada rota.
  roles = signal<string[]>([]);
  adminView = signal(false);
  lessonsView = signal(false);
  discursiveView = signal(false);
  /** Seções de estudo complementar: conquistas, biblioteca e flashcards. */
  studyView = signal<StudyView | null>(null);
  /** Caminho dentro da Biblioteca (área, lição ou ficha); a Biblioteca só o lê (R9). */
  libraryAddress = signal(location.pathname);
  profileView = signal(false);
  curationView = signal(false);
  curationBusy = signal(false);
  reviewView = signal(false);
  practiceView = signal(isPracticePath(location.pathname));
  /** Treino parcial (/treino) ou provas completas (/provas): o mesmo componente, seleções diferentes. */
  practiceSection = signal<PracticeSection>(location.pathname === "/provas" ? "provas" : "treino");
  practiceAttemptId = signal<string | null>(null);
  practiceItemPosition = signal(1);
  practiceBusy = signal(false);
  /** Prova completa com o cronômetro correndo: sair pede confirmação e pausa. */
  examRunning = signal(false);
  // A página inicial fica em "/" e o banco de questões em "/questoes".
  homeView = signal(location.pathname === "/");
  reviewReturn = signal(false);
  reviewCurrentVersion = signal<string | null>(null);
  reviewPosition: ReviewPosition = { topic: "", offset: 0 };
  private appRef = inject(ApplicationRef);
  private choice = inject(ChoiceService);
  readonly engagement = inject(EngagementService);
  readonly news = inject(NewsService);
  readonly resume = inject(ResumeService);
  /** "Continuar de onde parou" acompanha quem está na sessão: conta ou visitante deste navegador. */
  private readonly resumeOwner = effect(() => {
    const session = this.session();
    this.resume.scope(session.mode === "account" ? `account:${session.email}` : "guest");
  });
  private identityGeneration = 0;
  private identityTransition = 0;
  private requestNumber = 0;
  private sectionGeneration = 0;
  private identityChannel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel("enade-identity");
  private lastSection = "";
  constructor() {
    // Trocou de seção, começa do topo. Voltar da questão para a lista mantém
    // a posição, para a pessoa continuar de onde estava.
    effect(() => {
      const section = this.sectionLabel();
      const backToList = this.lastSection === "Resolução" && section === "Banco de questões";
      if (this.lastSection && section !== this.lastSection && !backToList)
        window.scrollTo({ top: 0, behavior: "instant" });
      this.lastSection = section;
    });
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
    return requestJson<T>("/api/" + path, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
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
      void this.mascot.sync(session.mode);
      void this.engagement.refresh();
      // O aviso de novidades abre sozinho uma vez, para quem já estudou, fora de questão, treino ou prova.
      void this.news.refresh().then(() => { if (transition === this.identityTransition && this.calmMoment()) this.news.offerOnce(); });
      await this.loadCurationAccess(transition);
      if (transition !== this.identityTransition) return;
      if (fromOtherTab) this.setPath("/questoes", "replace");
      this.readSectionAddress();
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
    const [roles, curation] = await Promise.allSettled([
      this.api<{ roles: string[] }>("access"),
      this.api<{ canCurate: boolean }>("curation/access"),
    ]);
    if (transition !== this.identityTransition) return;
    this.roles.set(roles.status === "fulfilled" ? roles.value.roles : []);
    this.canCurate.set(curation.status === "fulfilled" && curation.value.canCurate);
  }

  openCuration() {
    if (
      !this.canCurate() ||
      this.saving() ||
      this.authBusy() ||
      this.curationBusy() || this.practiceBusy() || !this.leaveExam(() => this.openCuration())
    )
      return;
    this.beginSectionChange();
    this.homeView.set(false);
    this.reviewView.set(false);
    this.reviewReturn.set(false);
    this.question.set(null);
    this.accountView.set(null);
    this.accountNotice.set("");
    this.error.set("");
    this.practiceView.set(false);
    this.adminView.set(false);
    this.lessonsView.set(false);
    this.discursiveView.set(false);    this.studyView.set(null);
    this.profileView.set(false);
    this.curationView.set(true);
    this.setPath("/curadoria");
    this.focusMain();
  }
  openHome(event?: Event) {
    event?.preventDefault();
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy() || !this.leaveExam(() => this.openHome())) return;
    this.beginSectionChange();
    this.swapView(() => {
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
  /** Momento em que um aviso não atrapalha: nem apresentação, nem questão, treino, prova ou áreas de gestão. */
  private calmMoment() {
    return !this.landingMode() && !this.accountView() && !this.adminView() && !this.curationView() && !this.lessonsView()
      && !this.question() && !this.practiceAttemptId() && !this.examRunning()
      // No boot, a questão do endereço pode ainda não ter carregado.
      && !/^\/questoes\/./.test(location.pathname);
  }
  /** "Continuar de onde parou" numa lição: a Biblioteca abre a área e a lição. */
  continueLesson(target: { slug: string; concept: string }) {
    this.openStudy("biblioteca", libraryPath({ area: target.slug, lesson: target.concept, sheet: null }));
  }
  /** A correção de uma questão leva à lição (ou área) do conceito cobrado. */
  openLibraryPath(path: string) {
    if (sectionPathOf(path) === "/biblioteca") this.openStudy("biblioteca", path);
  }
  /** A Biblioteca pede outro ponto dela: vira uma entrada no histórico do navegador. */
  libraryNavigate(target: { path: string; replace?: boolean }) {
    if (this.studyView() !== "biblioteca" || sectionPathOf(target.path) !== "/biblioteca") return;
    this.setPath(target.path, target.replace ? "replace" : "push");
  }
  /** Ação de uma novidade: abre a seção; "geradas" é o banco filtrado pelas questões geradas. */
  followNews(destination: NewsDestination) {
    if (destination !== "geradas") return this.navigate(destination);
    if (this.navigationBusy()) return;
    this.studyView.set(null);
    history.pushState(null, "", "/questoes?origin=generated");
    void this.restoreCatalogNavigation();
  }
  /** Banco filtrado nas questões geradas por IA de uma área (a partir do núcleo). */
  browseGenerated(area: string) {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) return;
    this.studyView.set(null);
    history.pushState(null, "", `/questoes?${new URLSearchParams({ origin: "generated", area })}`);
    void this.restoreCatalogNavigation();
  }
  /** Nome da seção atual (o banco de questões usa para saber se está ativo). */
  sectionLabel() {
    if (this.accountView()) return "Conta";
    if (this.profileView()) return "Meu perfil";
    if (this.adminView()) return "Administração";
    if (this.lessonsView()) return "Aulas";
    if (this.discursiveView()) return "Discursivas";
    if (this.studyView()) return STUDY_LABELS[this.studyView()!];
    if (this.curationView()) return "Curadoria";
    if (this.practiceView()) return this.practiceSection() === "provas" ? "Provas completas" : "Treino parcial";
    if (this.reviewView()) return "Caderno de erros";
    if (this.homeView()) return "Início";
    return this.question() ? "Resolução" : "Banco de questões";
  }
  /** O banco de questões (lista ou resolução) é a seção atual. */
  onCatalog() {
    const label = this.sectionLabel();
    return (label === "Banco de questões" || label === "Resolução") && !this.reviewReturn();
  }
  onHome() {
    return this.sectionLabel() === "Início";
  }
  openReview() {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy() || !this.leaveExam(() => this.openReview())) return;
    this.beginSectionChange();
    this.swapView(() => {
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
    this.setPath("/caderno");
    this.focusMain();
  }
  /**
   * Sair de uma prova em andamento pede confirmação; a prova fica pausada (o
   * componente do treino pausa ao sair) e as respostas já estão salvas.
   */
  leaveExam(then: () => void) {
    if (!this.leavePersonalDraft(then)) return false;
    if (!this.examRunning()) return true;
    // Pergunta no modal; se a pessoa confirmar, refaz a navegação pedida.
    void this.choice.confirm({
      eyebrow: "Cronômetro correndo",
      title: "Sair agora?",
      message: "O cronômetro fica pausado e suas respostas estão salvas. Você continua depois em Treino parcial.",
      cancel: "Continuar respondendo",
      confirm: "Pausar e sair",
    }).then((ok) => {
      if (!ok) return;
      this.examRunning.set(false);
      then();
    });
    return false;
  }
  openPractice(section: PracticeSection = "treino") {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy() || !this.leaveExam(() => this.openPractice(section))) return;
    this.practiceSection.set(section);
    this.beginSectionChange();
    this.question.set(null);
    this.accountView.set(null);
    this.curationView.set(false);
    this.reviewView.set(false);
    this.reviewReturn.set(false);
    this.reviewCurrentVersion.set(null);
    this.homeView.set(false);
    this.adminView.set(false);
    this.lessonsView.set(false);
    this.discursiveView.set(false);    this.studyView.set(null);
    this.profileView.set(false);
    this.error.set("");
    this.practiceAttemptId.set(null);
    this.practiceItemPosition.set(1);
    this.practiceView.set(true);
    this.writePracticeAddress("push");
    this.focusMain();
  }
  /** Cria um treino (área, erros) e abre-o direto na primeira questão. */
  async startPractice(request: PracticeRequest) {
    if (this.saving() || this.authBusy() || this.practiceBusy()) return;
    this.practiceBusy.set(true);
    this.error.set("");
    let attemptId: string | null = null;
    try {
      attemptId = (await requestPractice(request)).id;
    } catch (err) {
      this.error.set(this.message(err));
    } finally {
      this.practiceBusy.set(false);
    }
    if (attemptId) this.openPracticeAttempt(attemptId);
  }
  /** Abre um treino existente (por exemplo, o em andamento da página inicial). */
  openPracticeAttempt(attemptId: string) {
    this.openPractice(this.practiceSection());
    if (!this.practiceView()) return;
    this.practiceAttemptId.set(attemptId);
    this.writePracticeAddress("replace");
  }
  practiceLocationChanged(location_: { attemptId: string | null; position: number }) {
    if (!this.practiceView() || this.authBusy() || !isPracticePath(location.pathname)) return;
    this.practiceAttemptId.set(location_.attemptId);
    this.practiceItemPosition.set(location_.position);
    this.writePracticeAddress("replace");
  }
  private readPracticeAddress() {
    const params = new URLSearchParams(location.search);
    const id = params.getAll("attempt").length === 1 ? params.get("attempt") : null;
    const valid = isPracticePath(location.pathname) && id && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
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
    this.destination.set(this.practiceSection());
    const address = "/" + this.practiceSection() + (params.size ? "?" + params.toString() : "");
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
    return { q: this.search, topic: this.topic, area: this.area, year: this.year, origin: this.origin };
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
    if (!this.leavePersonalDraft(() => void this.openNext())) return;
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
      this.studyView.set(null);
      this.question.set(q);
      this.selected = retry ? "" : q.answer?.optionId || "";
      this.editing.set(retry);
    }, () => request === this.requestNumber);
    this.leaveHomePath();
    this.focusMain();
  }
  async open(id: string, retry = false) {
    if (!this.leavePersonalDraft(() => void this.open(id, retry))) return;
    if (this.authBusy()) return;
    const request = ++this.requestNumber;
    this.loading.set(true);
    this.error.set("");
    try {
      const q = await this.api<Question>("questions/" + encodeURIComponent(id));
      if (request !== this.requestNumber) return;
      this.showQuestion(q, retry, request);
      this.resume.record({ kind: "question", id: q.id, title: q.title });
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
        // Meta, sequência e conquistas mudam a cada resposta.
        void this.engagement.refresh();
      }
    } catch (err) {
      if (identity === this.identityGeneration)
        this.error.set(this.message(err));
    } finally {
      if (identity === this.identityGeneration) this.saving.set(false);
    }
  }
  back() {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy() || !this.leaveExam(() => this.back())) return;
    this.beginSectionChange();
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
  private setPath(path: string, mode: "push" | "replace" = "push") {
    if (location.pathname !== path) {
      if (mode === "push") history.pushState(null, "", path);
      else history.replaceState(null, "", path);
    }
    this.destination.set(destinationFromPath(path));
    this.libraryAddress.set(location.pathname);
    this.currentAddress = location.pathname + location.search;
  }
  private leaveHomePath() {
    if (location.pathname !== "/questoes" && !this.reviewReturn()) {
      this.setPath("/questoes");
      this.writeCatalogAddress("replace");
    }
  }
  /** O endereço é revalidado após obter a sessão e os papéis do servidor. */
  private readSectionAddress() {
    if (!Object.values(SECTION_PATHS).includes(sectionPathOf(location.pathname))) this.setPath("/questoes", "replace");
    this.libraryAddress.set(location.pathname);
    let destination = destinationFromPath(location.pathname);
    const accountRequired = ["perfil", "aulas", "curadoria", "administracao"].includes(destination);
    const denied = (destination === "administracao" && !this.roles().includes("ADMIN")) ||
      (destination === "curadoria" && !this.canCurate());
    this.accountView.set(null);
    if (accountRequired && this.session().mode !== "account") {
      this.accountView.set("login");
    } else if (denied) {
      this.accountNotice.set("Esta seção não está disponível para sua conta.");
      this.setPath("/questoes", "replace");
      destination = "questoes";
    }
    this.destination.set(destination);
    this.homeView.set(destination === "inicio");
    this.practiceView.set(destination === "treino" || destination === "provas");
    this.reviewView.set(destination === "caderno");
    this.adminView.set(destination === "administracao" && !this.accountView());
    this.lessonsView.set(destination === "aulas" && !this.accountView());
    this.curationView.set(destination === "curadoria" && !this.accountView());
    this.profileView.set(destination === "perfil" && !this.accountView());
    this.discursiveView.set(destination === "discursivas");
    this.studyView.set(destination === "biblioteca" || destination === "flashcards" || destination === "conquistas" ? destination : null);
    if (this.practiceView()) {
      this.practiceSection.set(destination === "provas" ? "provas" : "treino");
      this.readPracticeAddress();
    }
    this.currentAddress = location.pathname + location.search;
  }
  private restoreFilterFields() {
    this.search = this.appliedFilters.q;
    this.topic = this.appliedFilters.topic;
    this.area = this.appliedFilters.area;
    this.year = this.appliedFilters.year;
    this.origin = this.appliedFilters.origin;
  }
  private readCatalogAddress() {
    const params = new URLSearchParams(location.search);
    const value = (key: string, max: number) => {
      const entry = params.get(key) ?? "";
      return params.getAll(key).length === 1 && entry.length <= max ? entry : "";
    };
    const year = value("year", 4);
    this.appliedFilters = location.pathname === "/questoes"
      ? { q: value("q", 120), topic: value("topic", 80), area: value("area", 80), year: /^(20[0-9]{2}|2100)$/.test(year) ? year : "",
          origin: value("origin", 12) === "generated" ? "generated" : "" }
      : { q: "", topic: "", area: "", year: "", origin: "" };
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
    const target = location.pathname + location.search;
    const resume = () => {
      history.replaceState(null, "", target);
      void this.restoreCatalogNavigation();
    };
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy() || !this.leaveExam(resume)) {
      history.pushState(null, "", this.currentAddress);
      return;
    }
    this.beginSectionChange();
    this.error.set("");
    this.question.set(null);
    this.selected = "";
    this.editing.set(false);
    this.reviewReturn.set(false);
    this.reviewCurrentVersion.set(null);
    this.readSectionAddress();
    if (this.destination() === "questoes") {
      this.readCatalogAddress();
      await this.loadCatalog(false, this.catalogOffset(), "replace", this.appliedFilters);
    }
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
  /** Nome no topo; contas antigas sem nome mostram o e-mail. */
  accountName() {
    const session = this.session();
    return session.mode === "account" ? firstName(session.name) || session.email : "";
  }
  accountLabel() {
    const session = this.session();
    return session.mode === "account" ? session.name || session.email : "";
  }
  accountInitials() {
    const session = this.session();
    return session.mode === "account" ? initials(session.name, session.email) : "";
  }
  openAccount(mode: AccountMode) {
    if (this.saving() || this.authBusy() || this.practiceBusy() || this.session().mode === "account" || !this.leaveExam(() => this.openAccount(mode)))
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
    if (["perfil", "aulas", "curadoria", "administracao"].includes(this.destination()) && this.session().mode !== "account") {
      this.setPath("/questoes", "replace");
      this.readSectionAddress();
    }
    this.accountView.set(null);
    this.authError.set("");
    if (!this.question() && !this.reviewView() && !this.practiceView()) void this.loadCatalog(false, this.catalogOffset(), "replace", this.appliedFilters);
    this.focusMain();
  }
  openAdmin() {
    if (!this.roles().includes("ADMIN") || this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy() || !this.leaveExam(() => this.openAdmin()))
      return;
    this.beginSectionChange();
    this.swapView(() => {
      this.question.set(null);
      this.accountView.set(null);
      this.curationView.set(false);
      this.reviewView.set(false);
      this.reviewReturn.set(false);
      this.practiceView.set(false);
      this.adminView.set(true);
    });
    this.setPath("/administracao");
    this.focusMain();
  }
  isStaff() {
    return this.roles().includes("PROFESSOR") || this.roles().includes("ADMIN");
  }
  openLessons() {
    if (this.session().mode !== "account" || this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy() || !this.leaveExam(() => this.openLessons()))
      return;
    this.beginSectionChange();
    this.swapView(() => {
      this.question.set(null);
      this.accountView.set(null);
      this.curationView.set(false);
      this.reviewView.set(false);
      this.reviewReturn.set(false);
      this.practiceView.set(false);
      this.lessonsView.set(true);
    });
    this.setPath("/aulas");
    this.focusMain();
  }
  openDiscursive() {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy() || !this.leaveExam(() => this.openDiscursive())) return;
    this.beginSectionChange();
    this.swapView(() => {
      this.question.set(null);
      this.accountView.set(null);
      this.curationView.set(false);
      this.reviewView.set(false);
      this.reviewReturn.set(false);
      this.practiceView.set(false);
      this.discursiveView.set(true);
    });
    this.setPath("/discursivas");
    this.focusMain();
  }
  /** Área cujo baralho os flashcards abrem direto; só vale para a abertura vinda da Biblioteca. */
  flashcardsArea = signal<string | null>(null);
  openFlashcards(area: string | null) {
    this.openStudy("flashcards");
    // openStudy pode esperar uma confirmação (prova em andamento); só marca a área se a troca aconteceu.
    if (location.pathname === SECTION_PATHS.flashcards) this.flashcardsArea.set(area);
  }
  /** Conquistas, biblioteca e flashcards: mesmo fluxo das discursivas. */
  openStudy(view: StudyView, path: string = SECTION_PATHS[view]) {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy() || !this.leaveExam(() => this.openStudy(view, path))) return;
    this.flashcardsArea.set(null);
    this.beginSectionChange();
    this.swapView(() => {
      this.question.set(null);
      this.accountView.set(null);
      this.curationView.set(false);
      this.reviewView.set(false);
      this.reviewReturn.set(false);
      this.practiceView.set(false);
      this.studyView.set(view);
    });
    this.setPath(path);
    this.focusMain();
  }
  /** Questão oficial aberta a partir do núcleo por área: sai da Biblioteca para o banco. */
  openQuestionFromStudy(id: string) {
    if (this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy()) return;
    void this.open(id);
  }
  /** Meu perfil: dados e senha da própria conta. */
  openProfile() {
    if (this.session().mode !== "account" || this.saving() || this.authBusy() || this.curationBusy() || this.practiceBusy() || !this.leaveExam(() => this.openProfile()))
      return;
    this.beginSectionChange();
    this.swapView(() => {
      this.question.set(null);
      this.accountView.set(null);
      this.curationView.set(false);
      this.reviewView.set(false);
      this.reviewReturn.set(false);
      this.practiceView.set(false);
      this.homeView.set(false);
      this.profileView.set(true);
    });
    this.setPath("/perfil");
    this.focusMain();
  }
  profileAccountChanged(account: { email: string; name: string | null }) {
    this.session.set({ mode: "account", ...account });
  }
  private clearStudyState() {
    this.sessionError.set("");
    this.reflectionState.set({ dirty: false, saving: false });
    this.discursiveState.set({ dirty: false, saving: false });
    forgetHomeSnapshot();
    this.engagement.clear();
    this.adminView.set(false);
    this.profileView.set(false);
    this.lessonsView.set(false);
    this.discursiveView.set(false);    this.studyView.set(null);
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
      void this.mascot.sync(session.mode);
      void this.engagement.refresh();
      await this.loadCurationAccess(transition);
      if (transition !== this.identityTransition) return;
      this.readSectionAddress();
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
    if (this.authBusy() || this.saving() || this.curationBusy() || this.practiceBusy() || !this.leaveExam(() => void this.logout())) return;
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
      void this.mascot.sync(session.mode);
      void this.engagement.refresh();
      await this.loadCurationAccess(transition);
      if (transition !== this.identityTransition) return;
      this.setPath(isPracticePath(location.pathname) ? location.pathname : "/questoes", "replace");
      this.readSectionAddress();
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
        if (this.session().mode === "account") this.sessionError.set(message);
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
      void this.mascot.sync(session.mode);
      void this.engagement.refresh();
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
        this.readSectionAddress();
        this.authError.set("");
      } else if (!this.accountView()) {
        this.setPath(isPracticePath(location.pathname) ? location.pathname : "/questoes", "replace");
        this.readSectionAddress();
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
    return originLabel(origin, demonstration);
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
  private beginSectionChange() {
    this.sessionError.set("");
    this.requestNumber++;
    this.sectionGeneration++;
    this.loading.set(false);
  }
  private swapView(update: () => void, stillCurrent = () => true) {
    const generation = this.identityGeneration;
    const section = this.sectionGeneration;
    const apply = () => {
      if (generation !== this.identityGeneration || section !== this.sectionGeneration || !stillCurrent()) return;
      this.adminView.set(false);
      this.lessonsView.set(false);
      this.discursiveView.set(false);      this.studyView.set(null);
      this.profileView.set(false);
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
  /** Nova seção começa do topo: o foco sozinho não rola se o rodapé já estava à vista. */
  private focusMain() {
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      document.getElementById("content")?.focus({ preventScroll: true });
    }, 0);
  }
  skipToContent(event: Event) {
    event.preventDefault();
    this.focusMain();
  }
}
type PracticeSection = "treino" | "provas";
type StudyView = "conquistas" | "biblioteca" | "flashcards";
const STUDY_LABELS: Record<StudyView, string> = { conquistas: "Conquistas", biblioteca: "Biblioteca", flashcards: "Flashcards" };
function isPracticePath(path: string) {
  return path === "/treino" || path === "/provas";
}

bootstrapApplication(App, {
  // Os recortes das questões vêm em 200 dpi de propósito: a mesma imagem
  // serve à leitura e à ampliação. O aviso de imagem maior que a exibida
  // não se aplica a eles.
  providers: [
    { provide: IMAGE_CONFIG, useValue: { disableImageSizeWarning: true } },
  ],
}).catch(console.error);
