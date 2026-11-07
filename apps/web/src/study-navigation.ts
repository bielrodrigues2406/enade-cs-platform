export type Destination = "inicio" | "questoes" | "caderno" | "treino" | "provas" | "discursivas" | "flashcards" | "biblioteca" | "conquistas" | "aulas" | "perfil" | "curadoria" | "administracao";
export const SECTION_PATHS: Record<Destination, string> = {
  inicio: "/", questoes: "/questoes", caderno: "/caderno", treino: "/treino", provas: "/provas",
  discursivas: "/discursivas", flashcards: "/flashcards", biblioteca: "/biblioteca", conquistas: "/conquistas",
  aulas: "/aulas", perfil: "/perfil", curadoria: "/curadoria", administracao: "/administracao",
};
export function destinationFromPath(path: string): Destination {
  const section = sectionPathOf(path);
  return (Object.keys(SECTION_PATHS) as Destination[]).find((key) => SECTION_PATHS[key] === section) ?? "questoes";
}

/**
 * Endereços dentro da Biblioteca (revisão do Codex, R9): a área do núcleo, a
 * lição aberta e a ficha ficam no caminho, para recarregar e usar Voltar/Avançar.
 *   /biblioteca                      mapa e fichas
 *   /biblioteca/<área>               núcleo de uma área
 *   /biblioteca/<área>/<conceito>    lição de um conceito
 *   /biblioteca/fichas/<ficha>       ficha de uma página
 */
export type LibraryAddress = { area: string | null; lesson: string | null; sheet: string | null };
const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
const LIBRARY_PATH = new RegExp(`^/biblioteca(?:/(${SLUG})(?:/(${SLUG}))?)?/?$`);
export function parseLibraryPath(path: string): LibraryAddress | null {
  const match = path.length <= 200 ? LIBRARY_PATH.exec(path) : null;
  if (!match) return null;
  const [, first = null, second = null] = match;
  if (first === "fichas") return second ? { area: null, lesson: null, sheet: second } : null;
  return { area: first, lesson: second, sheet: null };
}
export function libraryPath(address: LibraryAddress): string {
  if (address.sheet) return `/biblioteca/fichas/${address.sheet}`;
  if (!address.area) return "/biblioteca";
  return `/biblioteca/${address.area}` + (address.lesson ? `/${address.lesson}` : "");
}
/** Caminho da seção a que o endereço pertence; subcaminhos da Biblioteca contam como ela. */
export function sectionPathOf(path: string): string {
  return path !== "/biblioteca" && parseLibraryPath(path) ? "/biblioteca" : path;
}
export const STUDY_GROUPS: { name: string; items: { id: Destination; label: string }[] }[] = [
  { name: "Questões", items: [{ id: "questoes", label: "Banco de questões" }, { id: "discursivas", label: "Discursivas" }] },
  { name: "Treinar", items: [{ id: "treino", label: "Treino parcial" }, { id: "provas", label: "Provas completas" }] },
  { name: "Revisar", items: [{ id: "caderno", label: "Caderno de erros" }, { id: "flashcards", label: "Flashcards" }] },
  { name: "Apoio", items: [{ id: "biblioteca", label: "Biblioteca" }, { id: "conquistas", label: "Conquistas" }, { id: "aulas", label: "Aulas" }] },
];
