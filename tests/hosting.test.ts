import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, db } from "../apps/api/src/main.js";

// Cada arquivo de teste roda em processo próprio; as variáveis abaixo não
// afetam as demais suítes.
const web = mkdtempSync(join(tmpdir(), "enade-web-"));
copyFileSync("tests/fixtures/test-only-shell.html", join(web, "index.html"));
writeFileSync(join(web, "main-ABCD1234.js"), "export {};");
writeFileSync(join(web, "chunk-Dtcii2KJ.js"), "export {};");
writeFileSync(join(web, "styles-aB_1-z29.css"), "body {color: black}");
writeFileSync(join(web, "manifest.webmanifest"), "{}");
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
  const nonces = new Set<string>();
  for (const path of ["/", "/index.html", "/questoes/qualquer", "/treino?attempt=00000000-0000-4000-8000-000000000001&item=2"]) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<title>shell<\/title>/);
    const csp = res.headers.get("content-security-policy") ?? "";
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    const nonce = /style-src 'self' 'nonce-([A-Za-z0-9+/=]+)'/.exec(csp)?.[1];
    assert.ok(nonce);
    assert.equal(Buffer.from(nonce, "base64").length, 16);
    assert.ok(html.includes(`ngCspNonce="${nonce}"`));
    assert.ok(!html.includes("__CSP_NONCE__"));
    assert.ok(!nonces.has(nonce));
    nonces.add(nonce);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("x-powered-by"), null);
  }
  const head = await fetch(base + "/index.html", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.match(head.headers.get("content-security-policy") ?? "", /style-src 'self' 'nonce-/);
  assert.equal(head.headers.get("cache-control"), "no-store");
  assert.equal(await head.text(), "");
});

test("hashed assets are immutable and missing files are not masked by the shell", async () => {
  for (const path of ["/main-ABCD1234.js", "/chunk-Dtcii2KJ.js", "/styles-aB_1-z29.css"]) {
    const asset = await fetch(base + path);
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");
    await asset.arrayBuffer();
  }
  const manifest = await fetch(base + "/manifest.webmanifest");
  assert.equal(manifest.headers.get("cache-control"), "no-cache");
  await manifest.arrayBuffer();
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
