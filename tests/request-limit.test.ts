import { test } from "node:test";
import assert from "node:assert/strict";
import { requestLimitPerMinute, requestLimiter } from "../apps/api/src/request-limit.js";

// Middleware isolado: não abre servidor nem banco (o registro do bloqueio é
// assíncrono e tolera falha).
function call(limiter: ReturnType<typeof requestLimiter>, ip: string, path = "/api/catalog") {
  let passed = false, status = 200;
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (name: string, value: string) => { headers[name] = value; },
    status: (code: number) => { status = code; return { json: () => undefined }; },
  };
  limiter({ path, ip }, res, () => { passed = true; });
  return { passed, status, headers };
}

test("the API limit blocks one address past the limit and leaves others and the web alone", () => {
  const limiter = requestLimiter(60);
  for (let i = 0; i < 60; i++) assert.equal(call(limiter, "203.0.113.1").passed, true);
  const blocked = call(limiter, "203.0.113.1");
  assert.equal(blocked.passed, false);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers["Retry-After"]) > 0);
  assert.equal(call(limiter, "203.0.113.2").passed, true, "outro IP segue");
  assert.equal(call(limiter, "203.0.113.1", "/index.html").passed, true, "páginas fora da API não contam");
  assert.equal(call(limiter, "203.0.113.1", "/api/health").passed, true, "verificação de saúde não conta");
});

test("the limit defaults to 1200 per minute in production and is off in development unless configured", () => {
  assert.equal(requestLimitPerMinute(undefined, true), 1200);
  assert.equal(requestLimitPerMinute(undefined, false), null);
  assert.equal(requestLimitPerMinute("300", false), 300);
  assert.equal(requestLimitPerMinute("5", true), 1200, "valor fora da faixa volta ao padrão");
});
