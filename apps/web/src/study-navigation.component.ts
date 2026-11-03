import { Component, ElementRef, HostListener, ViewChild, input, output, signal } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { Destination, SECTION_PATHS, STUDY_GROUPS } from "./study-navigation";

@Component({
  selector: "app-study-navigation",
  imports: [NgTemplateOutlet],
  templateUrl: "./study-navigation.component.html",
  styleUrl: "./study-navigation.component.css",
})
export class StudyNavigationComponent {
  readonly active = input<Destination>("inicio");
  readonly disabled = input(false);
  readonly account = input(false);
  readonly curator = input(false);
  readonly admin = input(false);
  readonly navigate = output<Destination>();
  readonly mobile = signal(innerWidth <= 860);
  readonly groups = STUDY_GROUPS;
  readonly paths = SECTION_PATHS;
  readonly supportOpen = signal(false);
  @ViewChild("drawer") private drawer?: ElementRef<HTMLDialogElement>;

  @HostListener("window:resize") onResize() {
    const mobile = innerWidth <= 860;
    if (mobile !== this.mobile()) {
      this.close();
      this.mobile.set(mobile);
    }
  }
  open() { this.drawer?.nativeElement.showModal(); }
  close() { this.drawer?.nativeElement.close(); }
  supportToggled(event: Event) { this.supportOpen.set((event.target as HTMLDetailsElement).open); }
  select(event: MouseEvent, destination: Destination) {
    if (this.disabled()) { event.preventDefault(); return; }
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.close();
    this.navigate.emit(destination);
  }
  supportActive() { return ["biblioteca", "conquistas", "aulas"].includes(this.active()); }
}
