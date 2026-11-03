import { test, expect } from "@playwright/test";
import { navigateTo } from "./navigation-helpers";

for (const width of [320, 390, 768, 1440]) {
  test(`section URLs preserve reload and browser history at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/questoes?q=transa%C3%A7%C3%A3o&topic=Banco+de+dados");
    await expect(page.getByRole("heading", { name: "Banco de questões", exact: true })).toBeVisible();
    const selection = page.url();
    await navigateTo(page, "Biblioteca");
    await expect(page).toHaveURL(/\/biblioteca$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Biblioteca", exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(selection);
    await expect(page.getByLabel("Buscar questão")).toHaveValue("transação");
    await expect(page.getByLabel("Assunto", { exact: true })).toHaveValue("Banco de dados");
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Biblioteca", exact: true })).toBeVisible();
    await navigateTo(page, "Caderno de erros");
    await expect(page).toHaveURL(/\/caderno$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Caderno de erros", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("mobile menu returns focus on Escape and keyboard selection opens the content", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/questoes");
  const trigger = page.getByRole("button", { name: "Menu", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Seu caderno", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Banco de questões", exact: true })).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("link", { name: "Flashcards", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/flashcards$/);
  await expect(page.getByRole("heading", { name: "Flashcards", exact: true })).toBeVisible();
  await expect(page.locator("main")).toBeFocused();
});

test("a direct protected section asks for sign-in without rendering administration", async ({ page }) => {
  await page.goto("/administracao");
  await expect(page.locator("app-account")).toBeVisible();
  await expect(page.locator("app-admin")).toHaveCount(0);
});


test("a delayed question never replaces a section chosen while it was loading", async ({ page }) => {
  await page.goto("/questoes");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requested!: () => void;
  const started = new Promise<void>((resolve) => { requested = resolve; });
  await page.route("**/api/questions/demo-sql-v1", async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Resolver: Quando uma transação falha", exact: true }).click();
    await started;
    await navigateTo(page, "Biblioteca");
    await expect(page.getByRole("heading", { name: "Biblioteca", exact: true })).toBeVisible();
    const arrived = page.waitForResponse((response) => response.url().endsWith("/api/questions/demo-sql-v1"));
    release();
    await arrived;
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/biblioteca$/);
    await expect(page.getByRole("heading", { name: "Biblioteca", exact: true })).toBeVisible();
  } finally { release(); }
});


test("browser Back invalidates an earlier queued view transition", async ({ page }) => {
  await page.goto("/questoes");
  await expect(page.getByRole("heading", { name: "Banco de questões", exact: true })).toBeVisible();
  await page.evaluate(() => {
    const callbacks: (() => void)[] = [];
    const bridge = window as Window & { completeSectionTransition?: () => void };
    bridge.completeSectionTransition = () => callbacks.shift()?.();
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: (callback: () => void) => { callbacks.push(callback); } });
  });
  await navigateTo(page, "Biblioteca");
  await expect(page).toHaveURL(/\/biblioteca$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/questoes$/);
  await page.evaluate(() => (window as Window & { completeSectionTransition?: () => void }).completeSectionTransition?.());
  await expect(page.getByRole("heading", { name: "Banco de questões", exact: true })).toBeVisible();
  await expect(page.locator("app-library")).toHaveCount(0);
});
