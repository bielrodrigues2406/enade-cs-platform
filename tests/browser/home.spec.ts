import { test, expect, type Page } from "@playwright/test";

const noHorizontalScroll = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );

test("home explains the notebook and leads to study and back", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /Estude para o ENADE/ }),
  ).toBeVisible();
  for (const name of [
    "A prova de 2026",
    "Como o caderno funciona",
    "De onde vêm as questões",
    "Em construção",
  ])
    await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Mapa da prova: 15 questões/ }),
  ).toBeVisible();
  await expect(page.getByText("Autoral demonstrativa").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Início" }).first(),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: /^Começar por: / }).click();
  await expect(page.locator(".prompt")).toBeVisible();
  await expect(page).toHaveURL(/\/questoes$/);

  await page
    .getByRole("link", { name: "Caderno de Computação, início" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Estude para o ENADE",
  );
  await expect(page).toHaveURL(/\/$/);

  await page
    .getByRole("button", { name: "Abrir o banco de questões" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Banco de questões" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/questoes$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Banco de questões" }),
  ).toBeVisible();
});

test("home is reachable by keyboard and shows progress to a returning student", async ({
  page,
}) => {
  await page.goto("/");
  const start = page.getByRole("button", { name: /^Começar por: / });
  await expect(start).toBeVisible();
  let reached = false;
  for (let i = 0; i < 20 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await start.evaluate((el) => el === document.activeElement);
  }
  expect(reached).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.locator(".prompt")).toBeVisible();

  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.locator(".feedback")).toBeVisible();

  await page
    .getByRole("link", { name: "Caderno de Computação, início" })
    .click();
  const progress = page.getByRole("region", { name: "Seu estudo até agora" });
  await expect(progress).toContainText("1 questão respondida");
  await expect(
    page.getByRole("button", { name: /^Continuar com: / }),
  ).toBeVisible();
});

test("home shows everything at once with reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  // Sem animação: a demonstração já mostra a correção e nada fica escondido.
  await expect(page.getByText("Resposta correta.")).toBeVisible();
  await page
    .getByRole("heading", { name: "Em construção" })
    .scrollIntoViewIfNeeded();
  for (const item of await page.locator("app-home [data-reveal]").all())
    await expect(item).toHaveCSS("opacity", "1");
  await context.close();
});

test("home reflows without horizontal scrolling", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await noHorizontalScroll(page), `largura ${width}`).toBe(true);
  }
});
