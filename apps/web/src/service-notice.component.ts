import { Component, OnDestroy, OnInit, signal } from "@angular/core";
import { requestJson } from "./api-request";

type Notice = { message: string; startsAt: string; endsAt: string };

@Component({
  selector: "app-service-notice",
  templateUrl: "./service-notice.component.html",
  styleUrl: "./service-notice.component.css",
})
export class ServiceNoticeComponent implements OnInit, OnDestroy {
  notice = signal<Notice | null>(null);
  private abort = new AbortController();
  private timer?: ReturnType<typeof setInterval>;
  private pending = false;

  ngOnInit() {
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), 60_000);
  }
  ngOnDestroy() { this.abort.abort(); clearInterval(this.timer); }

  async refresh() {
    const current = this.notice();
    if (current && Date.parse(current.endsAt) <= Date.now()) this.notice.set(null);
    if (this.pending || document.hidden) return;
    this.pending = true;
    try {
      const data = await requestJson<{ notice: Notice | null }>("/api/service-status", { signal: this.abort.signal });
      const item = data.notice;
      const valid = item && typeof item.message === "string" && item.message.length <= 300 &&
        Number.isFinite(Date.parse(item.startsAt)) && Number.isFinite(Date.parse(item.endsAt)) &&
        Date.parse(item.startsAt) < Date.parse(item.endsAt) && Date.parse(item.endsAt) > Date.now();
      if (!this.abort.signal.aborted) this.notice.set(valid ? item : null);
    } catch {
      // Falha na consulta não comprova manutenção. Os fluxos de estudo mostram seus próprios erros.
    } finally { this.pending = false; }
  }
  date(value: string) {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  }
}
