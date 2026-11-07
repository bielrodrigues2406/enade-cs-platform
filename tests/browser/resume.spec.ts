import { test, expect, type Page } from "@playwright/test";
import { signUp } from "./session-helpers";

// Continuar de onde parou (PR G): a última questão aberta e a última lição
// lida aparecem no início e levam de volta ao mesmo lugar.

const goHome = (page: Page) => page.getByRole("link", { name: "Preparação ENADE, início" }).click();

test.beforeEach(async ({ context }) => {
  await signUp(context);
});

test("home offers to continue the last question and the last lesson", async ({ page }) => {
  await page.goto("/questoes");
  const first = page.getByRole("button", { name: /^Resolver: / }).first();
  const title = (await first.getAttribute("aria-label"))!.replace(/^Resolver: /, "");
  await first.click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();

  await goHome(page);
  const card = page.locator(".todo-group").filter({ has: page.getByRole("heading", { name: "Continuar de onde parou" }) });
  await expect(card).toContainText(title);
  await card.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();

  await page.goto("/biblioteca");
  await page.getByRole("button", { name: /^Sistemas operacionais: / }).click();
  await page.getByRole("button", { name: "Ler a lição: Deadlock" }).click();
  await expect(page.getByRole("heading", { name: "Deadlock", level: 1 })).toBeFocused();

  await goHome(page);
  await expect(card).toContainText("Lição · Sistemas operacionais");
  await expect(card).toContainText("Deadlock");
  await card.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Deadlock", level: 1 })).toBeVisible();
  await expect(page.getByText("Lição 7 de 10")).toBeVisible();
});
