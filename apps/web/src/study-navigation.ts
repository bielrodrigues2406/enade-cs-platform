export type Destination = "inicio" | "questoes" | "caderno" | "treino" | "provas" | "discursivas" | "flashcards" | "biblioteca" | "conquistas" | "aulas" | "perfil" | "curadoria" | "administracao";
export const SECTION_PATHS: Record<Destination, string> = {
  inicio: "/", questoes: "/questoes", caderno: "/caderno", treino: "/treino", provas: "/provas",
  discursivas: "/discursivas", flashcards: "/flashcards", biblioteca: "/biblioteca", conquistas: "/conquistas",
  aulas: "/aulas", perfil: "/perfil", curadoria: "/curadoria", administracao: "/administracao",
};
export function destinationFromPath(path: string): Destination {
  return (Object.keys(SECTION_PATHS) as Destination[]).find((key) => SECTION_PATHS[key] === path) ?? "questoes";
}
export const STUDY_GROUPS: { name: string; items: { id: Destination; label: string }[] }[] = [
  { name: "Questões", items: [{ id: "questoes", label: "Banco de questões" }, { id: "discursivas", label: "Discursivas" }] },
  { name: "Treinar", items: [{ id: "treino", label: "Treino parcial" }, { id: "provas", label: "Provas completas" }] },
  { name: "Revisar", items: [{ id: "caderno", label: "Caderno de erros" }, { id: "flashcards", label: "Flashcards" }] },
  { name: "Apoio", items: [{ id: "biblioteca", label: "Biblioteca" }, { id: "conquistas", label: "Conquistas" }, { id: "aulas", label: "Aulas" }] },
];
