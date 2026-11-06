export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfter: number | null = null) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function retryDelay(value: string | null): number | null {
  if (!value) return null;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 86400 ? seconds : null;
}

export function responseError(response: Response, data: unknown): ApiRequestError {
  const body = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const delay = retryDelay(response.headers.get("Retry-After"));
  let message = "Não foi possível concluir a operação. Tente novamente.";
  if (response.status === 429) {
    message = delay ? `Muitas solicitações em pouco tempo. Aguarde ${delay} segundos e tente novamente.` :
      "Muitas solicitações em pouco tempo. Aguarde um pouco e tente novamente.";
  } else if (response.status >= 500) {
    message = response.status === 503 && body.code === "SERVICE_MAINTENANCE" ?
      "O CadernoCC está em manutenção. Tente novamente mais tarde." :
      "O CadernoCC está temporariamente indisponível. Tente novamente em instantes.";
  } else if (typeof body.message === "string" && body.message.trim() && body.message.length <= 600 &&
      !["Unauthorized", "Forbidden", "Not Found", "Bad Request", "Payload Too Large"].includes(body.message)) {
    message = body.message;
  } else if (response.status === 401) {
    message = "Não foi possível confirmar sua sessão. Entre novamente para continuar.";
  } else if (response.status === 404) {
    message = "Este conteúdo não foi encontrado. Volte à lista e escolha outra opção.";
  } else if (response.status === 403) {
    message = "Sua conta não tem acesso a esta ação. Volte à página anterior ou fale com a administração.";
  } else if (response.status === 413) {
    message = "O envio ultrapassou o tamanho permitido. Reduza os arquivos e tente novamente.";
  }
  return new ApiRequestError(message, response.status, delay);
}

/** Sem repetição automática: uma escrita com resposta perdida pode ter sido salva. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    const writing = init?.method && !["GET", "HEAD"].includes(init.method.toUpperCase());
    throw new ApiRequestError(writing ?
      "Não foi possível confirmar a operação. Mantenha esta página aberta, verifique a conexão e tente novamente." :
      "Não foi possível conectar ao CadernoCC. Verifique a conexão e tente novamente.", 0);
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw responseError(response, data);
  if (data === null) throw new ApiRequestError("O serviço enviou uma resposta inesperada. Tente novamente em instantes.", response.status);
  return data as T;
}
