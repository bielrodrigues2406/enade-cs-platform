import { Component, ElementRef, EventEmitter, Output, ViewChild, effect, inject } from "@angular/core";
import { MascotComponent } from "./mascot.component";
import { NewsService, type NewsDestination, type NewsItem } from "./news.service";

// Diálogo de novidades (NEWS-1), com o Dudu mostrando o caderno. Abre pelo
// botão do topo, pelo cartão do início ou sozinho, uma vez, para quem já estudou.

@Component({
  selector: "app-news-dialog",
  imports: [MascotComponent],
  templateUrl: "./news-dialog.component.html",
  styleUrl: "./news-dialog.component.css",
})
export class NewsDialogComponent {
  readonly news = inject(NewsService);
  @Output() go = new EventEmitter<NewsDestination>();
  @ViewChild("dialog", { static: true }) dialog!: ElementRef<HTMLDialogElement>;
  private readonly dates = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });

  constructor() {
    effect(() => {
      const element = this.dialog?.nativeElement;
      if (!element) return;
      if (this.news.open() && !element.open) element.showModal();
      if (!this.news.open() && element.open) element.close();
    });
  }

  date(item: NewsItem) { return this.dates.format(new Date(`${item.date}T12:00:00Z`)); }
  /** Esc, o X ou o botão fecham e marcam as novas como vistas. */
  closed() { if (this.news.open()) void this.news.close(); }
  follow(item: NewsItem) {
    void this.news.close();
    if (item.action) this.go.emit(item.action.destination);
  }
}
