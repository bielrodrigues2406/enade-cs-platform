import { test, expect, type Page } from "@playwright/test";

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("visitors see the public page with real numbers and reach the bank", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 28, 20, 0));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Preparação ENADE");
  await expect(page.getByText("ENADE 2026 · 29 de novembro · faltam 32 dias")).toBeVisible();
  const stats = page.getByRole("definition");
  await expect(stats.last()).toHaveText("32");
  for (const name of [
    "Provas anteriores, questão por questão.",
    "Uma questão de cada vez, como no papel.",
    "Tudo o que a preparação pede, num lugar só.",
  ])
    await expect(page.getByRole("heading", { name })).toBeVisible();
  // A página pública não mostra o índice lateral nem o painel de estudo.
  await expect(page.getByRole("complementary", { name: "Sobre este caderno" })).toBeHidden();
  await page.getByRole("button", { name: "Começar a estudar" }).first().click();
  await expect(page.getByRole("heading", { name: "Banco de questões" })).toBeVisible();
  await expect(page).toHaveURL(/\/questoes/);
});

test("the public page opens the account forms and shows everything with reduced motion", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByText("Resposta correta.")).toBeVisible();
  for (const item of await page.locator("app-landing [data-reveal]").all())
    await expect(item).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Criar conta" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/conta/i);
  await context.close();
});

test("the public page reflows without horizontal scrolling", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await noHorizontalScroll(page), `largura ${width}`).toBe(true);
  }
});

test("the hero never animates empty sheets while the exam pages are still loading", async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  // Segura a busca do acervo como numa primeira visita lenta.
  await page.route("**/api/catalog?limit=12", async (route) => { await held; await route.continue(); });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Preparação ENADE");
  await page.waitForTimeout(600);
  await expect(page.locator(".lp-sheet")).toHaveCount(0);
  release();
  await expect(page.locator(".lp-sheet").first()).toBeVisible();
  // Folhas reais chegam com a imagem decodificada; em branco só se não houver página, e sem animação.
  for (const image of await page.locator("figure.lp-sheet img").all())
    expect(await image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  for (const blank of await page.locator(".lp-sheet-blank").all())
    expect(await blank.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});
