/**
 * Pedido de um novo treino (POST /api/practice). A página inicial, a revisão e
 * a tela de treino montam o mesmo corpo; o servidor confere tamanho e área.
 */
export type PracticeRequest =
  | { area: string | null; size: number; timed: boolean }
  | { area: null; focus: "ERRORS"; timed?: boolean }
  | { area: null; focus: "RETRY"; retryOf: string; timed?: boolean };

/** Maior simulado de uma área: 30 questões ou todas, se ela tiver menos. */
export const AREA_SIMULATION_LIMIT = 30;

/** Minutos por questão no simulado com cronômetro, como na prova. */
export const MINUTES_PER_QUESTION = 4;

export function areaSimulation(area: string, count: number, timed = true): PracticeRequest {
  return { area, size: Math.min(count, AREA_SIMULATION_LIMIT), timed };
}

/**
 * Pergunta se o simulado da área corre com cronômetro. Em aula, o professor
 * resolve as questões com a turma e o tempo atrapalha; sozinho, o tempo treina.
 * Devolve null se a pessoa desistir.
 */
export async function chooseAreaSimulation(
  choice: { choose<T extends string>(request: { eyebrow?: string; title: string; message: string; cancel?: string; actions: { value: T; label: string; kind?: "primary" | "outline" | "danger" }[] }): Promise<T | null> },
  area: string,
  count: number,
  minutesPerQuestion = MINUTES_PER_QUESTION,
): Promise<PracticeRequest | null> {
  const size = Math.min(count, AREA_SIMULATION_LIMIT);
  const answer = await choice.choose({
    eyebrow: "Simulado por área",
    title: area,
    message: `${size} ${size === 1 ? "questão" : "questões"} só desta área. Com cronômetro são ${size * minutesPerQuestion} minutos, com pausa. Sem cronômetro, bom para resolver junto com a turma.`,
    actions: [
      { value: "free", label: "Sem cronômetro", kind: "outline" },
      { value: "timed", label: `Com cronômetro (${size * minutesPerQuestion} min)` },
    ],
  });
  return answer ? areaSimulation(area, count, answer === "timed") : null;
}

/** Rótulo de um treino na lista e no resultado. */
export function attemptLabel(attempt: { area: string | null; focus?: string | null }) {
  if (attempt.focus === "ERRORS") return "Revisão dos erros";
  if (attempt.focus === "RETRY") return "Refazer as erradas";
  return attempt.area || "Assuntos mistos";
}

/** Cria o treino e devolve o id; erros chegam com a mensagem do servidor. */
export async function requestPractice(request: PracticeRequest): Promise<{ id: string }> {
  const response = await fetch("/api/practice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, requestId: crypto.randomUUID() }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "Não foi possível começar o treino. Verifique a conexão e tente novamente.");
  return body;
}
