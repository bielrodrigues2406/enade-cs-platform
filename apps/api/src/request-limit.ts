import { logActivity, requestIp } from "./activity.js";
import { digest } from "./session.js";

// Limite geral de requisições à API por IP, contra um cliente que dispara em
// excesso (robô, laço com defeito, ataque simples de negação de serviço). Um
// laboratório inteiro sai por um IP só, então o padrão é generoso: 1200 por
// minuto (≈ 40 pessoas ativas). Ataques distribuídos precisam de proteção na
// borda (proxy do provedor ou CDN); ver DEPLOY §5.2.

const WINDOW_MS = 60_000;
const MAX_TRACKED_IPS = 50_000;

/**
 * Limite por minuto: `API_RATE_LIMIT` quando definido; senão 1200 em produção
 * e nenhum em desenvolvimento e testes (que disparam muitas requisições do
 * mesmo endereço local).
 */
export function requestLimitPerMinute(value = process.env.API_RATE_LIMIT, production = process.env.NODE_ENV === "production") {
  if (value === undefined || value === "") return production ? 1200 : null;
  const limit = Number(value);
  return Number.isInteger(limit) && limit >= 60 && limit <= 100_000 ? limit : 1200;
}

type Window = { count: number; end: number; logged: boolean };

export function requestLimiter(limit = requestLimitPerMinute()) {
  if (limit === null) return (_req: any, _res: any, next: () => void) => next();
  const windows = new Map<string, Window>();
  let nextSweep = 0;
  return (req: any, res: any, next: () => void) => {
    if (!(req.path === "/api" || req.path.startsWith("/api/")) || req.path === "/api/health") return next();
    const now = Date.now();
    if (now >= nextSweep || windows.size > MAX_TRACKED_IPS) {
      for (const [key, value] of windows) if (value.end <= now) windows.delete(key);
      // Ainda cheio: muitos IPs ao mesmo tempo; recomeça a contagem em vez de crescer sem fim.
      if (windows.size > MAX_TRACKED_IPS) windows.clear();
      nextSweep = now + WINDOW_MS;
    }
    const ip = requestIp(req) ?? "unknown";
    const key = digest(ip);
    const current = windows.get(key) ?? { count: 0, end: now + WINDOW_MS, logged: false };
    current.count++;
    windows.set(key, current);
    if (current.count <= limit) return next();
    if (!current.logged) {
      current.logged = true;
      logActivity({ category: "SECURITY", action: "RATE_LIMITED", detail: `Mais de ${limit} requisições em 1 minuto`, ip });
    }
    res.setHeader("Retry-After", String(Math.ceil((current.end - now) / 1000)));
    res.status(429).json({ message: "Muitas requisições a partir desta rede. Aguarde um minuto e tente novamente." });
  };
}
