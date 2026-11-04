import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type ShellRequest = { method: string; path: string };
type ShellResponse = {
  setHeader(name: string, value: string): unknown;
  type(contentType: string): ShellResponse;
  send(body: string): unknown;
};

const NONCE_PLACEHOLDER = "__CSP_NONCE__";

/** Scripts ficam externos; apenas os estilos Angular recebem autorização por página. */
export function webContentPolicy(nonce?: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    `style-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""}`,
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** O mesmo nonce vai no cabeçalho e no ngCspNonce lido pelo Angular. */
export function webShell(root: string) {
  const template = readFileSync(join(root, "index.html"), "utf8");
  if (!template.includes(NONCE_PLACEHOLDER))
    throw new Error("WEB_DIST: index.html precisa do marcador ngCspNonce.");

  return (req: ShellRequest, res: ShellResponse, next: () => void): void => {
    if (!["GET", "HEAD"].includes(req.method)
      || req.path === "/api" || req.path.startsWith("/api/")
      || (req.path !== "/index.html" && /\.[a-z0-9]+$/i.test(req.path))) {
      next();
      return;
    }
    const nonce = randomBytes(16).toString("base64");
    res.setHeader("Content-Security-Policy", webContentPolicy(nonce));
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(template.replaceAll(NONCE_PLACEHOLDER, nonce));
  };
}
