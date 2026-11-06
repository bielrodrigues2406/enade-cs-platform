// Rótulo da origem de uma questão, igual em todas as telas.
export function originLabel(origin: string, demonstration = false) {
  if (origin === "OFFICIAL") return "Oficial · Inep";
  if (origin === "AI_GENERATED") return "Gerada por IA";
  return demonstration ? "Autoral demonstrativa" : "Autoral";
}
