import { requestJson } from "./api-request";
import type { ChoiceService } from "./choice-dialog";
import type { PracticeSource } from "./exam.types";

/**
 * Pedido de um novo treino (POST /api/practice). A página inicial, a revisão e
 * a tela de treino montam o mesmo corpo; o servidor confere tamanho e área.
 */
export type PracticeRequest =
  | { area: string | null; size: number; timed: boolean; source?: PracticeSource }
  | { area: null; focus: "ERRORS"; timed?: boolean }
  | { area: null; focus: "RETRY"; retryOf: string; timed?: boolean };

/** Maior simulado de uma área: 30 questões ou todas, se ela tiver menos. */
export const AREA_SIMULATION_LIMIT = 30;

/** Minutos por questão no simulado com cronômetro, como na prova. */
export const MINUTES_PER_QUESTION = 4;

export function areaSimulation(area: string, count: number, timed = true, source: PracticeSource = "OFFICIAL"): PracticeRequest {
  return { area, size: Math.min(count, AREA_SIMULATION_LIMIT), timed, ...(source === "OFFICIAL" ? {} : { source }) };
}

/** Rótulo curto da origem; vazio para as oficiais, que são o padrão. */
export function sourceLabel(source: PracticeSource | undefined) {
  return source === "GENERATED" ? "geradas por IA" : source === "MIXED" ? "oficiais + geradas por IA" : "";
}

/**
 * Pergunta se o simulado da área corre com cronômetro. Em aula, o professor
 * resolve as questões com a turma e o tempo atrapalha; sozinho, o tempo treina.
 * Devolve null se a pessoa desistir.
 */
export async function chooseAreaSimulation(
  choice: Pick<ChoiceService, "choose">,
  area: string,
  count: number,
  minutesPerQuestion = MINUTES_PER_QUESTION,
  source: PracticeSource = "OFFICIAL",
): Promise<PracticeRequest | null> {
  const size = Math.min(count, AREA_SIMULATION_LIMIT);
  const answer = await choice.choose({
    eyebrow: "Simulado por área",
    title: area,
    message: `${size} ${size === 1 ? "questão" : "questões"} só desta área${source === "OFFICIAL" ? "" : `, ${sourceLabel(source)}`}. Com cronômetro são ${size * minutesPerQuestion} minutos, com pausa. Sem cronômetro, bom para resolver junto com a turma.`,
    actions: [
      { value: "free", label: "Sem cronômetro", kind: "outline" },
      { value: "timed", label: `Com cronômetro (${size * minutesPerQuestion} min)` },
    ],
  });
  return answer ? areaSimulation(area, count, answer === "timed", source) : null;
}

/**
 * Questões publicadas de uma área que o treino aceita, como o servidor conta
 * (GET /api/practice). O tamanho "todas da área" precisa bater com este número.
 */
export async function availableInArea(area: string, source: PracticeSource = "OFFICIAL"): Promise<number> {
  type Row = { name: string; count: number };
  const data = await requestJson<{ areas: Row[] | null; generated?: { areas: Row[] | null } }>("/api/practice");
  const official = data.areas?.find((a) => a.name === area)?.count ?? 0;
  const generated = data.generated?.areas?.find((a) => a.name === area)?.count ?? 0;
  return source === "OFFICIAL" ? official : source === "GENERATED" ? generated : official + generated;
}

/** Rótulo de um treino na lista e no resultado. */
export function attemptLabel(attempt: { area: string | null; focus?: string | null; kind?: string; formatYear?: number | null; source?: PracticeSource }) {
  if (attempt.kind === "FORMAT") return `Formato ENADE ${attempt.formatYear ?? 2026}`;
  if (attempt.focus === "ERRORS") return "Revisão dos erros";
  if (attempt.focus === "RETRY") return "Refazer as erradas";
  const origin = sourceLabel(attempt.source);
  return (attempt.area || "Assuntos mistos") + (origin ? ` · ${origin}` : "");
}

/** Cria o treino e devolve o id; erros chegam com a mensagem do servidor. */
export async function requestPractice(request: PracticeRequest): Promise<{ id: string }> {
  return requestJson<{ id: string }>("/api/practice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, requestId: crypto.randomUUID() }),
  });
}
