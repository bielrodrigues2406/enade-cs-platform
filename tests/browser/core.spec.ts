import { test, expect } from "@playwright/test";

// Núcleo por área (NUC-1): mapa de confiança na Biblioteca, página da área,
// autoavaliação que muda a confiança e volta da ficha para a área.

test("the library shows the confidence map and an area page updates confidence on self-assessment", async ({ page }) => {
  await page.goto("/biblioteca");
  const map = page.getByRole("region", { name: "O que você precisa saber, área por área" });
  await expect(map).toBeVisible();
  const rows = map.getByRole("list", { name: /Áreas do componente específico/ }).getByRole("button");
  await expect(rows).toHaveCount(16);
  await expect(rows.first()).toHaveAccessibleName(/^Algoritmos, comece por aqui: 15,1% das questões específicas, em 6 de 6 provas; confiança 0 de 100$/);
  await expect(map.getByRole("button", { name: /^Formação Geral, confiança 0 de 100$/ })).toBeVisible();

  await map.getByRole("button", { name: /^Sistemas operacionais/ }).click();
  await expect(page.getByRole("heading", { name: "Sistemas operacionais", level: 1 })).toBeFocused();
  const confidence = page.getByRole("group", { name: "Sua confiança nesta área" });
  await expect(confidence).toContainText("0/10 marcados");

  const deadlock = page.getByRole("radiogroup", { name: "Quanto você sabe de Deadlock" });
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/core/concepts/so-deadlock") && r.request().method() === "PUT");
  await deadlock.getByRole("radio", { name: "Sei explicar" }).click();
  expect((await saved).status()).toBe(200);
  await expect(deadlock.getByRole("radio", { name: "Sei explicar" })).toHaveAttribute("aria-checked", "true");
  await expect(confidence).toContainText("10% (1/10 marcados)");

  for (const title of ["Fatos que cortam alternativas", "Pares que confundem", "Pistas do enunciado", "Pegadinhas da área"])
    await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
  await expect(page.getByText("Núcleo escrito por IA (Claude)")).toBeVisible();

  // A ficha aberta a partir da área volta para a área.
  await page.getByRole("button", { name: "Ficha de uma página" }).click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Sistemas operacionais");
  await page.locator(".sheet-bar").getByRole("button", { name: "Biblioteca" }).click();
  await expect(page.getByRole("heading", { name: "Sistemas operacionais", level: 1 })).toBeVisible();
  await expect(deadlock.getByRole("radio", { name: "Sei explicar" })).toHaveAttribute("aria-checked", "true");

  await page.locator("app-core-area").getByRole("button", { name: "Biblioteca" }).click();
  await expect(map.getByRole("button", { name: /^Sistemas operacionais.*confiança [1-9]\d? de 100$/ })).toBeVisible();
});

test("an area page reflows on a small phone without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/biblioteca");
  await page.getByRole("button", { name: /^Teoria da computação: / }).click();
  await expect(page.getByRole("heading", { name: "Teoria da computação", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
