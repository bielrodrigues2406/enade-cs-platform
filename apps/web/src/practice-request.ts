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

export function areaSimulation(area: string, count: number): PracticeRequest {
  return { area, size: Math.min(count, AREA_SIMULATION_LIMIT), timed: true };
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
