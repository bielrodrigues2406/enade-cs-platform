import { test, expect } from "@playwright/test";

// Tema (PR G): "Sistema" segue o aparelho; "Claro" e "Escuro" ficam gravados
// neste navegador e mudam só os tokens de cor.

const background = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("the footer switches the theme, it survives a reload and System follows the device", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/questoes");
  const group = page.getByRole("group", { name: "Tema da tela" });
  await expect(group.getByRole("button", { name: "Sistema" })).toHaveAttribute("aria-pressed", "true");
  const light = await background(page);

  await group.getByRole("button", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).not.toBe(light);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(group.getByRole("button", { name: "Escuro" })).toHaveAttribute("aria-pressed", "true");

  await group.getByRole("button", { name: "Sistema" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
  expect(await background(page)).toBe(light);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background(page)).not.toBe(light);

  await group.getByRole("button", { name: "Claro" }).click();
  expect(await background(page)).toBe(light);
});
