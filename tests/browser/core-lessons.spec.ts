import { test, expect } from "@playwright/test";

// Lições da Biblioteca (LIB-2): abrir pela área, ler as seções, passar para a
// próxima e voltar ao cartão do conceito; sem rolagem lateral a 320 px.

test("a lesson opens from its concept, shows every section and leads to the next one", async ({ page }) => {
  await page.goto("/biblioteca");
  await page.getByRole("button", { name: /^Sistemas operacionais: / }).click();
  await expect(page.getByRole("heading", { name: "Sistemas operacionais", level: 1 })).toBeFocused();
  await expect(page.locator(".core-cover figcaption")).toHaveText("Ilustração gerada por IA");

  await page.getByRole("button", { name: "Ler a lição: Deadlock" }).click();
  await expect(page.getByRole("heading", { name: "Deadlock", level: 1 })).toBeFocused();
  await expect(page.getByText("Lição 7 de 10")).toBeVisible();
  await expect(page.getByText("Texto gerado por IA, sem revisão humana")).toBeVisible();
  for (const title of ["Exemplo resolvido", "Erro comum", "Como cai no ENADE", "Para fixar"])
    await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
  const figure = page.getByRole("img", { name: /^Quatro carros ocupam um cruzamento/ });
  await expect(figure).toBeVisible();
  await expect(page.locator(".lesson-figure figcaption")).toHaveText("Ilustração gerada por IA");
  await expect(page.locator(".lesson-check")).toContainText("Conferido: Executado em Python 3");
  // Caiu em 2017; não pode aparecer como "ainda não caiu", publicada ou não neste banco.
  await expect(page.locator(".lesson-questions").first()).toContainText("2017 Deadlock e ordem de aquisição de semáforos");
  await expect(page.getByText("Ainda não caiu nas provas")).toHaveCount(0);

  const recall = page.locator(".lesson-recall details").first();
  await recall.locator("summary").click();
  await expect(recall).toHaveAttribute("open", "");
  await expect(recall.getByText("A espera circular.")).toBeVisible();

  await page.getByRole("button", { name: /Paginação, segmentação e fragmentação/ }).click();
  await expect(page.getByRole("heading", { name: "Paginação, segmentação e fragmentação", level: 1 })).toBeFocused();
  await expect(page.getByText("Lição 8 de 10")).toBeVisible();

  await page.getByRole("button", { name: /^← Sistemas operacionais$|^Sistemas operacionais$/ }).first().click();
  await expect(page.getByRole("button", { name: "Ler a lição: Paginação, segmentação e fragmentação" })).toBeFocused();
});

test("a lesson fits a 320 px screen without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/biblioteca");
  await page.getByRole("button", { name: /^Algoritmos, comece por aqui/ }).click();
  await page.getByRole("button", { name: /^Ler as 13 lições$/ }).click();
  await expect(page.getByRole("heading", { name: "Complexidade assintótica", level: 1 })).toBeFocused();
  await expect(page.locator("pre.prompt-code")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
