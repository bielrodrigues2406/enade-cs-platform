import { readFile } from "node:fs/promises";
import path from "node:path";
import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";

// Novidades (NEWS-1, ver docs/NEWS.md): o texto fica em data/news/news.json e
// o que cada identidade já viu, em news_seen (migration 033). O aviso abre
// sozinho só para quem já estudou; quem acabou de chegar vê a marca "Novo".

const ROOT = process.env.STUDY_CONTENT_DIR || path.resolve("data");
const ID = /^[a-z0-9-]{3,80}$/;
/** Destinos que a tela sabe abrir; "geradas" é o banco filtrado pelas questões geradas. */
export const NEWS_DESTINATIONS = ["inicio", "questoes", "geradas", "biblioteca", "flashcards", "conquistas", "provas", "treino"] as const;
export type NewsItem = {
  id: string; date: string; title: string; summary: string;
  action: { label: string; destination: (typeof NEWS_DESTINATIONS)[number] } | null;
};

const text = (value: unknown, where: string, max: number) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${where}: texto inválido.`);
  return value.trim();
};

/** Mais recentes primeiro; ids únicos e datas válidas. */
export function parseNews(data: any): NewsItem[] {
  if (!Array.isArray(data?.news) || data.news.length > 50) throw new Error("news.json: lista inválida.");
  const seen = new Set<string>();
  const items = data.news.map((n: any, i: number): NewsItem => {
    const where = `news.json[${i}]`;
    if (!ID.test(n?.id) || seen.has(n.id)) throw new Error(`${where}: id inválido ou repetido.`);
    seen.add(n.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.date) || Number.isNaN(Date.parse(n.date))) throw new Error(`${where}: data inválida.`);
    if (n.action != null && !NEWS_DESTINATIONS.includes(n.action.destination)) throw new Error(`${where}: destino desconhecido.`);
    const action = n.action == null ? null : { label: text(n.action.label, `${where}.action.label`, 40), destination: n.action.destination };
    return { id: n.id, date: n.date, title: text(n.title, `${where}.title`, 80), summary: text(n.summary, `${where}.summary`, 400), action };
  });
  return items.sort((a: NewsItem, b: NewsItem) => b.date.localeCompare(a.date));
}

let cache: Promise<NewsItem[]> | null = null;
export function loadNews() {
  cache ??= readFile(path.join(ROOT, "news", "news.json"), "utf8").then((raw) => parseNews(JSON.parse(raw)))
    .catch((error) => { cache = null; throw error; });
  return cache;
}

async function view(owner: string) {
  const [news, seenRows, studied] = await Promise.all([
    loadNews(),
    db.query<{ news_id: string }>("SELECT news_id FROM news_seen WHERE identity_id=$1", [owner]),
    db.query("SELECT 1 FROM answer WHERE owner_id=$1 LIMIT 1", [owner]),
  ]);
  const seen = new Set(seenRows.rows.map((r) => r.news_id));
  const items = news.map((n) => ({ ...n, seen: seen.has(n.id) }));
  const unseen = items.filter((n) => !n.seen).length;
  return { items, unseen, autoOpen: unseen > 0 && Boolean(studied.rowCount) };
}

@Controller("api/news")
export class NewsController {
  @Get() async list(@Req() req: any) {
    const user = await requireIdentity(req);
    return view(user.id);
  }

  /** Marca como vistas; ids desconhecidos são recusados. Repetir não muda nada. */
  @Post("seen") @HttpCode(200) async seen(@Req() req: any, @Body() body: any) {
    const user = await requireIdentity(req);
    const ids = body?.ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 50) fail("Informe as novidades vistas.", 400);
    const known = new Set((await loadNews()).map((n) => n.id));
    if (!ids.every((id: unknown) => typeof id === "string" && known.has(id))) fail("Novidade desconhecida.", 400);
    await db.query(
      `INSERT INTO news_seen(identity_id,news_id) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`, [user.id, [...new Set(ids)]],
    );
    return view(user.id);
  }
}
