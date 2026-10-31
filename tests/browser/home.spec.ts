import { test, expect, type Page } from "@playwright/test";
import { signUp } from "./session-helpers";

const noHorizontalScroll = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
const goHome = (page: Page) =>
  page.getByRole("link", { name: "Preparação ENADE, início" }).click();

test.beforeEach(async ({ context }) => {
  await signUp(context);
});

test("home shows the study board and leads to study and back", async ({
  page,
}) => {
  // Data fixa: a contagem e as semanas até a prova dependem do dia.
  await page.clock.setFixedTime(new Date(2026, 9, 28, 20, 0));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Boa noite. Faltam 32 dias para o ENADE.",
  );
  for (const name of [
    "Para você estudar",
    "A prova de 2026",
    "De onde vêm as questões",
    "Como o caderno funciona",
    "Em construção",
  ])
    await expect(page.getByRole("heading", { name })).toBeVisible();
  const weeks = page.getByRole("list", { name: "Semanas até a prova" });
  await expect(weeks.getByRole("listitem")).toHaveCount(5);
  await expect(weeks).toContainText("HOJE · QUA 28");
  await expect(weeks).toContainText("DOM 29 · PROVA");
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

  await goHome(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ENADE");
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

test("home is reachable by keyboard and shows saved progress", async ({
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

  await goHome(page);
  await expect(
    page.getByRole("region", { name: "Seu andamento" }),
  ).toContainText(/1 de \d+/);
  await expect(page.locator(".cover-summary")).toContainText(
    /Você respondeu 1 de \d+/,
  );
  await expect(
    page.getByRole("button", { name: /^Continuar com: / }),
  ).toBeVisible();
});

test("a wrong answer appears first on the home page and can be retried", async ({
  page,
}) => {
  await page.goto("/questoes");
  await page
    .getByRole("button", { name: "Resolver: Entrega confiável de um fluxo" })
    .click();
  await page.getByRole("radio", { name: "UDP", exact: true }).check();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.locator(".feedback")).toBeVisible();

  await goHome(page);
  await expect(
    page.getByRole("heading", { name: "Para retomar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Seu andamento" }),
  ).toContainText("espera no caderno de erros");
  await page
    .getByRole("button", {
      name: "Tentar novamente: Entrega confiável de um fluxo",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Entrega confiável de um fluxo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "UDP", exact: true }),
  ).not.toBeChecked();
});

test("home shows everything at once with reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await signUp(context);
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
