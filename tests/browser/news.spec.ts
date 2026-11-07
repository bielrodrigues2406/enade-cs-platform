import { test, expect } from "@playwright/test";

// Novidades (NEWS-1): marca "Novo" no topo, diálogo com o Dudu, marcar como
// visto no servidor e aviso automático só para quem já estudou.

test("a newcomer sees the New mark but no popup, reads the news and the mark goes away for good", async ({ page }) => {
  await page.goto("/questoes");
  const trigger = page.getByRole("button", { name: /^Novidades, \d+ novas?$/ });
  await expect(trigger).toBeVisible();
  await expect(page.getByRole("heading", { name: "Novidades", level: 2 })).toBeHidden();

  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Novidades" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".news-list li.is-new")).not.toHaveCount(0);
  await expect(dialog.getByRole("heading", { name: "Lições na Biblioteca", level: 3 })).toBeVisible();
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/news/seen") && r.status() === 200);
  await dialog.getByRole("button", { name: "Entendi" }).click();
  await saved;
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Novidades", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Novidades", exact: true })).toBeVisible();
  await expect(page.locator("header .news-badge")).toHaveCount(0);
});

test("after studying, the news open once by themselves and lead to the section", async ({ page }) => {
  await page.goto("/questoes");
  await page.getByRole("button", { name: /^Resolver: / }).first().click();
  await page.getByRole("radio").first().check();
  const answered = page.waitForResponse((r) => /\/api\/questions\/[^/]+\/answer$/.test(r.url()) && r.ok());
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await answered;

  await page.goto("/questoes");
  const dialog = page.getByRole("dialog", { name: "Novidades" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^Abrir a Biblioteca/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/biblioteca$/);

  await page.goto("/questoes");
  await expect(page.getByRole("button", { name: "Novidades", exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
});
