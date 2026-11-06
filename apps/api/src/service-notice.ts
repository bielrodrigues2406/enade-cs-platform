export class ServiceNoticeConfigError extends Error {}
export type ServiceNotice = { message: string; startsAt: string; endsAt: string };
type ServiceRequest = { path: string; method: string };
type ServiceResponse = { setHeader(name: string, value: string): unknown; json(body: unknown): unknown };

/** Aviso informativo: não interrompe provas nem altera o estado das escritas. */
export function readServiceNotice(env: NodeJS.ProcessEnv): ServiceNotice | null {
  const message = env.SERVICE_NOTICE_MESSAGE?.trim() ?? "";
  const startsAt = env.SERVICE_NOTICE_START?.trim() ?? "";
  const endsAt = env.SERVICE_NOTICE_END?.trim() ?? "";
  if (!message && !startsAt && !endsAt) return null;
  const instant = (value: string) => /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
  if (!message || message.length > 300 || /[\r\n\x00-\x1f]/.test(message) ||
      !instant(startsAt) || !instant(endsAt) || Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new ServiceNoticeConfigError("Defina SERVICE_NOTICE_MESSAGE (até 300 caracteres), START e END com datas ISO e fuso; o fim deve ser posterior ao início.");
  }
  return { message, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() };
}

export function serviceNoticeRoute(notice: ServiceNotice | null) {
  return (req: ServiceRequest, res: ServiceResponse, next: () => void) => {
    if (req.path !== "/api/service-status" || !["GET", "HEAD"].includes(req.method)) return next();
    res.setHeader("Cache-Control", "no-store");
    res.json({ notice: notice && Date.parse(notice.endsAt) > Date.now() ? notice : null });
  };
}
