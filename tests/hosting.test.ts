import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, db } from "../apps/api/src/main.js";

// Cada arquivo de teste roda em processo próprio; as variáveis abaixo não
// afetam as demais suítes.
const web = mkdtempSync(join(tmpdir(), "enade-web-"));
writeFileSync(join(web, "index.html"), "<!doctype html><title>shell</title>");
writeFileSync(join(web, "main-ABCD1234.js"), "export {};");
let app: Awaited<ReturnType<typeof createApp>>, base: string;

before(async () => {
  process.env.WEB_DIST = web;
  process.env.TRUST_PROXY = "1";
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});
after(async () => {
  await app.close();
  await db.end();
  rmSync(web, { recursive: true, force: true });
});

test("web routes fall back to the shell with a strict policy and no cache", async () => {
  for (const path of ["/", "/questoes/qualquer"]) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<title>shell<\/title>/);
    const csp = res.headers.get("content-security-policy") ?? "";
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    assert.equal(res.headers.get("cache-control"), "no-cache");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("x-powered-by"), null);
  }
});

test("hashed assets are immutable and missing files are not masked by the shell", async () => {
  const asset = await fetch(base + "/main-ABCD1234.js");
  assert.equal(asset.status, 200);
  assert.equal(
    asset.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );
  const missing = await fetch(base + "/missing-ABCD1234.js");
  assert.equal(missing.status, 404);
  await missing.arrayBuffer();
});

test("API responses keep their own policy and are never cached or served the shell", async () => {
  const health = await fetch(base + "/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.equal(
    health.headers.get("content-security-policy"),
    "default-src 'none'; frame-ancestors 'none'",
  );
  await health.json();
  const unknown = await fetch(base + "/api/inexistente");
  assert.equal(unknown.status, 404);
  assert.doesNotMatch(await unknown.text(), /shell/);
});

test("a trusted proxy hop is applied and invalid hosting configuration fails fast", async () => {
  assert.equal(app.getHttpAdapter().getInstance().get("trust proxy"), 1);
  const saved = { ...process.env };
  try {
    process.env.TRUST_PROXY = "todos";
    await assert.rejects(createApp(), /TRUST_PROXY/);
    process.env.TRUST_PROXY = "";
    process.env.WEB_DIST = join(web, "nao-existe");
    await assert.rejects(createApp(), /WEB_DIST/);
    process.env.WEB_DIST = "";
    process.env.NODE_ENV = "production";
    process.env.APP_ORIGIN = "http://localhost:4200";
    await assert.rejects(createApp(), /APP_ORIGIN/);
  } finally {
    process.env = saved;
  }
});
