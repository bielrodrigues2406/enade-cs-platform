import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { CoreArea } from "./core-concepts.js";

// Lições da Biblioteca (LIB-2, ver docs/LIBRARY-LESSONS.md): uma por conceito do
// núcleo, com explicação, exemplo resolvido e conferido, erro comum e
// perguntas para fixar. "Como cai no ENADE" não fica aqui: a tela usa as
// questões que o núcleo já liga ao conceito.

const ROOT = process.env.STUDY_CONTENT_DIR || path.resolve("data");
const PUBLIC = path.resolve("apps/web/public");
const FIGURE = /^\/(figures|illustrations)\/[A-Za-z0-9-]+\.(svg|webp)$/;

export type Figure = { src: string; alt: string };
export type Lesson = {
  concept: string;
  body: string[];
  figure: Figure | null;
  example: { title: string; code: string | null; steps: string[]; check: string };
  mistake: string;
  recall: { q: string; a: string }[];
};
export type AreaLessons = { slug: string; cover: string | null; lessons: Map<string, Lesson> };

const text = (value: unknown, where: string, min: number, max: number) => {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) throw new Error(`${where}: texto inválido.`);
  // Mesma regra de redação das questões geradas: sem travessão.
  if (value.includes("—")) throw new Error(`${where}: sem travessão.`);
  return value.trim();
};
const list = <T>(value: unknown, where: string, min: number, max: number, item: (v: any, w: string) => T): T[] => {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${where}: de ${min} a ${max} itens.`);
  return value.map((v, i) => item(v, `${where}[${i}]`));
};

/** A imagem precisa existir em apps/web/public, ou a tela mostraria um quadro vazio. */
function image(src: unknown, where: string) {
  if (typeof src !== "string" || !FIGURE.test(src)) throw new Error(`${where}: caminho de imagem inválido.`);
  if (!existsSync(path.join(PUBLIC, src))) throw new Error(`${where}: ${src} não encontrado.`);
  return src;
}

export function parseLessons(data: any, area: CoreArea, where: string): AreaLessons {
  if (data?.slug !== area.slug) throw new Error(`${where}: slug diferente do núcleo.`);
  const concepts = new Set(area.concepts.map((c) => c.id));
  const lessons = new Map<string, Lesson>();
  list(data.lessons, `${where}.lessons`, 1, 20, (l, w) => {
    if (!concepts.has(l?.concept)) throw new Error(`${w}: conceito inexistente no núcleo.`);
    if (lessons.has(l.concept)) throw new Error(`${w}: lição repetida.`);
    lessons.set(l.concept, {
      concept: l.concept,
      body: list(l.body, `${w}.body`, 4, 8, (p, pw) => text(p, pw, 40, 900)),
      figure: l.figure ? { src: image(l.figure.src, `${w}.figure`), alt: text(l.figure.alt, `${w}.figure.alt`, 20, 400) } : null,
      example: {
        title: text(l.example?.title, `${w}.example.title`, 5, 120),
        code: l.example?.code === undefined ? null : text(l.example.code, `${w}.example.code`, 5, 1200),
        steps: list(l.example?.steps, `${w}.example.steps`, 2, 6, (s, sw) => text(s, sw, 10, 400)),
        // O que foi executado para conferir o exemplo; aparece na tela.
        check: text(l.example?.check, `${w}.example.check`, 20, 300),
      },
      mistake: text(l.mistake, `${w}.mistake`, 40, 600),
      recall: list(l.recall, `${w}.recall`, 2, 3, (r, rw) => ({ q: text(r?.q, `${rw}.q`, 10, 200), a: text(r?.a, `${rw}.a`, 2, 300) })),
    });
  });
  return { slug: area.slug, cover: data.cover === undefined ? null : image(data.cover, `${where}.cover`), lessons };
}

let cache: Promise<Map<string, AreaLessons>> | null = null;

/** Lido uma vez, como o núcleo: o conteúdo só muda com novo deploy. */
export function loadLessons(areas: CoreArea[]): Promise<Map<string, AreaLessons>> {
  cache ??= buildLessons(areas).catch((error) => { cache = null; throw error; });
  return cache;
}

async function buildLessons(areas: CoreArea[]) {
  const dir = path.join(ROOT, "lessons");
  const names = existsSync(dir) ? (await readdir(dir)).filter((n) => n.endsWith(".json")).sort() : [];
  const bySlug = new Map<string, AreaLessons>();
  for (const name of names) {
    const data = JSON.parse(await readFile(path.join(dir, name), "utf8"));
    const area = areas.find((a) => a.slug === data?.slug);
    if (!area) throw new Error(`${name}: área inexistente no núcleo.`);
    bySlug.set(area.slug, parseLessons(data, area, name));
  }
  return bySlug;
}
