import { test } from "node:test";
import assert from "node:assert/strict";
import { requestJson, responseError, ApiRequestError } from "../apps/web/src/api-request.js";
import { readServiceNotice, serviceNoticeRoute } from "../apps/api/src/service-notice.js";

test("5xx não expõe detalhes internos nem confunde sobrecarga com manutenção", () => {
  const unavailable = responseError(new Response(null, { status: 503 }), { message: "password worker busy" });
  assert.match(unavailable.message, /temporariamente indisponível/);
  assert.doesNotMatch(unavailable.message, /manutenção|password/);
  assert.match(responseError(new Response(null, { status: 503 }), { code: "SERVICE_MAINTENANCE" }).message, /manutenção/);
  assert.doesNotMatch(responseError(new Response(null, { status: 500 }), { message: "SQL password=secret" }).message, /SQL|secret/);
  assert.equal(responseError(new Response(null, { status: 409 }), { message: "A resposta mudou em outra aba." }).message, "A resposta mudou em outra aba.");
});

test("429 usa espera válida e ignora cabeçalho de espera inválido", () => {
  const limited = responseError(new Response(null, { status: 429, headers: { "Retry-After": "30" } }), null);
  assert.equal(limited.retryAfter, 30);
  assert.match(limited.message, /30 segundos/);
  for (const value of ["<script>", "-1", "99999999999"]) {
    assert.equal(responseError(new Response(null, { status: 429, headers: { "Retry-After": value } }), null).retryAfter, null);
  }
});

test("erro de rede em escrita é incerto, não promete salvamento nem repete chamada", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new TypeError("Failed to fetch"); });
  await assert.rejects(requestJson("/api/test", { method: "POST", body: "{}" }), (error: unknown) => {
    assert.ok(error instanceof ApiRequestError);
    assert.equal(error.status, 0);
    assert.match(error.message, /confirmar a operação/);
    assert.doesNotMatch(error.message, /Failed to fetch|dados estão salvos/);
    return true;
  });
  assert.equal(calls, 1);
});

test("aborto de navegação é preservado e resposta HTML não vira mensagem técnica", async (t) => {
  const aborted = new DOMException("cancelado", "AbortError");
  const mocked = t.mock.method(globalThis, "fetch", async () => { throw aborted; });
  await assert.rejects(requestJson("/api/test"), (error) => error === aborted);
  const bodyAborted = new Response("{}");
  t.mock.method(bodyAborted, "json", async () => { throw aborted; });
  mocked.mock.mockImplementation(async () => bodyAborted);
  await assert.rejects(requestJson("/api/test"), (error) => error === aborted);
  mocked.mock.mockImplementation(async () => new Response("<html>proxy failure</html>", { status: 502 }));
  await assert.rejects(requestJson("/api/test"), /temporariamente indisponível/);
  mocked.mock.mockImplementation(async () => new Response("not json"));
  await assert.rejects(requestJson("/api/test"), /resposta inesperada/);
});

test("configuração do aviso exige janela com fuso e não aceita configuração incompleta", () => {
  assert.equal(readServiceNotice({}), null);
  assert.throws(() => readServiceNotice({ SERVICE_NOTICE_MESSAGE: "Aviso" }));
  assert.throws(() => readServiceNotice({ SERVICE_NOTICE_MESSAGE: "Aviso", SERVICE_NOTICE_START: "2026-11-06T10:00:00", SERVICE_NOTICE_END: "2026-11-06T11:00:00" }));
  const result = readServiceNotice({ SERVICE_NOTICE_MESSAGE: " Atualização ", SERVICE_NOTICE_START: "2026-11-06T10:00:00-03:00", SERVICE_NOTICE_END: "2026-11-06T11:00:00-03:00" });
  assert.deepEqual(result, { message: "Atualização", startsAt: "2026-11-06T13:00:00.000Z", endsAt: "2026-11-06T14:00:00.000Z" });
});

test("rota pública do aviso expira sem banco e não intercepta outras rotas/métodos", () => {
  const route = serviceNoticeRoute({ message: "Aviso", startsAt: "2000-01-01T00:00:00Z", endsAt: "2000-01-02T00:00:00Z" });
  const headers: Record<string, string> = {};
  let body: unknown;
  const response = { setHeader: (k: string, v: string) => { headers[k] = v; }, json: (value: unknown) => { body = value; } };
  route({ path: "/api/service-status", method: "GET" }, response, () => assert.fail("não deveria encaminhar"));
  assert.deepEqual(body, { notice: null });
  assert.equal(headers["Cache-Control"], "no-store");
  let passed = 0;
  route({ path: "/api/health", method: "GET" }, response, () => passed++);
  route({ path: "/api/service-status", method: "POST" }, response, () => passed++);
  assert.equal(passed, 2);
});
