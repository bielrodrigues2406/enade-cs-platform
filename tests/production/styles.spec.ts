import "dotenv/config";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { test, expect, type Page } from "@playwright/test";
import { formatFixture } from "../enade-format-fixture";
import { navigateTo } from "../browser/navigation-helpers";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let fixture: Awaited<ReturnType<typeof formatFixture>>;
const owners = new Set<string>();
async function captureResponsive(page: Page, screen: string) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/production-${screen}-${width}.png`, fullPage: true });
  }
}
test.beforeAll(async () => { fixture = await formatFixture(pool); });
test.afterEach(async ({ context }) => {
  const cookie = (await context.cookies()).find(row => row.name === "enade_session");
  if (!cookie) return;
  const hash = createHash("sha256").update(cookie.value).digest("hex");
  const row = (await pool.query("SELECT identity_id FROM browser_session WHERE token_hash=$1", [hash])).rows[0];
  if (row) owners.add(row.identity_id);
});
test.afterAll(async () => { try { await fixture?.cleanup([...owners]); } finally { await pool.end(); } });

test("the optimized build styles navigation, lazy exam and articulated Dudu under its real CSP", async ({ page }) => {
  test.setTimeout(60_000);
  const violations: string[] = [];
  page.on("console", message => { if (message.type() === "error" && /Content Security Policy/.test(message.text())) violations.push(message.text()); });
  const response = await page.goto("/questoes");
  const policy = response!.headers()["content-security-policy"];
  const nonce = /style-src 'self' 'nonce-([^']+)'/.exec(policy)?.[1];
  expect(nonce).toBeTruthy();
  expect(policy).not.toMatch(/unsafe-inline|unsafe-eval/);
  await expect(page.getByRole("heading", { name: "Banco de questões", exact: true })).toBeVisible();
  expect(await page.locator(".study-sidebar a").first().evaluate(el => getComputedStyle(el).display)).toBe("flex");
  await captureResponsive(page, "bank");
  await navigateTo(page, "Provas completas");
  await expect(page.locator(".edition-card").first()).toBeVisible();
  expect(await page.locator(".edition-grid").evaluate(el => getComputedStyle(el).display)).toBe("grid");
  expect(await page.locator(".format-structure").evaluate(el => getComputedStyle(el).display)).toBe("flex");
  await captureResponsive(page, "exams");

  await page.locator("header").getByRole("button", { name: "Entrar", exact: true }).click();
  const figure = page.locator("app-account app-dudu-figure");
  await expect(figure).toHaveClass(/ready/);
  expect(await figure.locator(".figure").evaluate(el => getComputedStyle(el).aspectRatio)).toBe("3 / 4");
  expect(await figure.locator(".wing-left").evaluate(el => getComputedStyle(el).position)).toBe("absolute");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    // Camadas cobrem o palco 3:4: com o CSS aplicado, o grupo do corpo tem o tamanho da figura, não o do arquivo (384 px).
    const stage = (await figure.locator(".figure").boundingBox())!, upper = (await figure.locator(".upper").boundingBox())!;
    expect(Math.abs(upper.width - stage.width)).toBeLessThan(1);
    expect(upper.width).toBeLessThan(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/production-login-${width}.png`, fullPage: true });
  }
  const styleNonces = await page.locator("style").evaluateAll(elements => elements.map(el => (el as HTMLStyleElement).nonce));
  expect(styleNonces.length).toBeGreaterThan(0);
  expect(styleNonces.every(value => value === nonce)).toBe(true);
  expect(violations).toEqual([]);
});

test("a direct index request gets a fresh nonce and arbitrary inline code stays blocked", async ({ page }) => {
  const response = await page.goto("/index.html");
  await expect(page.locator("app-root")).toHaveAttribute("ngCspNonce", /.+/);
  const first = response!.headers()["content-security-policy"];
  const reloaded = await page.reload();
  expect(reloaded!.headers()["content-security-policy"]).not.toBe(first);
  expect(reloaded!.headers()["cache-control"]).toBe("no-store");
  const result = await page.evaluate(async () => {
    const style = document.createElement("style");
    style.textContent = "body { --test-only-unauthorized: blocked; }";
    document.head.appendChild(style);
    const script = document.createElement("script");
    script.textContent = "window.testOnlyUnauthorized = true";
    document.head.appendChild(script);
    await new Promise(resolve => setTimeout(resolve, 0));
    return {
      css: getComputedStyle(document.body).getPropertyValue("--test-only-unauthorized"),
      script: (window as Window & { testOnlyUnauthorized?: boolean }).testOnlyUnauthorized,
    };
  });
  expect(result.css).toBe("");
  expect(result.script).toBeUndefined();
});
