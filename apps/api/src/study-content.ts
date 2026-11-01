import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Conteúdo de estudo versionado no repositório (FLASH-1, LIB-1): baralhos de
// flashcards em data/flashcards e fichas de uma página em data/study-sheets.
// Lido uma vez e validado; um arquivo fora do formato derruba a carga, para
// não publicar conteúdo pela metade.

const ROOT = process.env.STUDY_CONTENT_DIR || path.resolve("data");
const SLUG = /^[a-z0-9-]{3,80}$/;

export type Flashcard = { id: string; front: string; back: string };
export type Deck = { deck: string; area: string; title: string; description: string; cards: Flashcard[] };
export type Sheet = {
  slug: string; area: string; title: string; summary: string;
  sections: { title: string; points: string[] }[];
  pitfalls: string[]; references: string[];
};

const text = (value: unknown, where: string, max: number) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${where}: texto inválido.`);
  return value.trim();
};
const list = (value: unknown, where: string, max: number, itemMax: number) => {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${where}: lista inválida.`);
  return value.map((item, i) => text(item, `${where}[${i}]`, itemMax));
};

async function jsonFiles(folder: string) {
  const dir = path.join(ROOT, folder);
  const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith(".json")).sort();
  return Promise.all(names.map(async (name) => ({ name, data: JSON.parse(await readFile(path.join(dir, name), "utf8")) })));
}

export function parseDeck(data: any, where: string): Deck {
  if (!SLUG.test(data?.deck)) throw new Error(`${where}: identificador do baralho inválido.`);
  if (!Array.isArray(data.cards) || !data.cards.length || data.cards.length > 400) throw new Error(`${where}: cartões ausentes.`);
  return {
    deck: data.deck, area: text(data.area, `${where}.area`, 60), title: text(data.title, `${where}.title`, 80),
    description: text(data.description, `${where}.description`, 300),
    cards: data.cards.map((card: any, i: number) => {
      if (!SLUG.test(card?.id)) throw new Error(`${where}.cards[${i}]: id inválido.`);
      return { id: card.id, front: text(card.front, `${where}.cards[${i}].front`, 600), back: text(card.back, `${where}.cards[${i}].back`, 1200) };
    }),
  };
}

export function parseSheet(data: any, where: string): Sheet {
  if (!SLUG.test(data?.slug)) throw new Error(`${where}: slug inválido.`);
  if (!Array.isArray(data.sections) || !data.sections.length || data.sections.length > 8) throw new Error(`${where}: seções inválidas.`);
  return {
    slug: data.slug, area: text(data.area, `${where}.area`, 60), title: text(data.title, `${where}.title`, 80),
    summary: text(data.summary, `${where}.summary`, 400),
    sections: data.sections.map((s: any, i: number) => ({
      title: text(s?.title, `${where}.sections[${i}].title`, 80), points: list(s?.points, `${where}.sections[${i}].points`, 10, 400),
    })),
    pitfalls: list(data.pitfalls ?? [], `${where}.pitfalls`, 8, 300),
    references: list(data.references ?? [], `${where}.references`, 6, 300),
  };
}

let decks: Promise<Deck[]> | null = null;
let sheets: Promise<Sheet[]> | null = null;

export function loadDecks() {
  decks ??= jsonFiles("flashcards").then((files) => {
    const parsed = files.map(({ name, data }) => parseDeck(data, `flashcards/${name}`));
    const ids = parsed.flatMap((d) => d.cards.map((c) => c.id));
    if (new Set(ids).size !== ids.length) throw new Error("Há id de cartão repetido entre os baralhos.");
    return parsed;
  });
  return decks;
}

export function loadSheets() {
  sheets ??= jsonFiles("study-sheets").then((files) => files.map(({ name, data }) => parseSheet(data, `study-sheets/${name}`)));
  return sheets;
}
