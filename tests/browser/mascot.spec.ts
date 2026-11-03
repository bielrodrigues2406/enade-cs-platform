import { openProfile } from "./navigation-helpers";
import { test, expect } from "@playwright/test";
import { signUp } from "./session-helpers";

test("a visitor can hide Dudu and the preference survives a reload", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Ocultar Dudu", exact: true });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".lp-duck")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Mostrar Dudu", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Mostrar Dudu", exact: true }).click();
  await expect(page.locator(".lp-duck")).toBeVisible();
});

test("the account preference is acknowledged by the server and restored", async ({ page, context }) => {
  await signUp(context);
  await page.goto("/");
  await openProfile(page);
  const toggle = page.getByRole("checkbox", { name: "Mostrar o mascote Dudu" });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(toggle).toBeEnabled();
  expect((await (await context.request.get("/api/me/preferences")).json()).mascotEnabled).toBe(false);
  await page.reload();
  await openProfile(page);
  await expect(page.getByRole("checkbox", { name: "Mostrar o mascote Dudu" })).not.toBeChecked();
});

test("a wrong answer keeps a personal reflection, protects its draft and shows it in the notebook", async ({ page }) => {
  await page.goto("/questoes");
  await page.getByRole("button", { name: "Resolver: Quando uma transação falha" }).click();
  await page.getByRole("radio", { name: /Isolamento/ }).check();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  const text = page.getByRole("textbox", { name: "Seu raciocínio" });
  await expect(text).toBeEnabled();
  await text.fill("Confundi isolamento com desfazer uma transação incompleta.");
  await page.getByRole("button", { name: "Alterar resposta", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sair sem guardar a reflexão?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Continuar escrevendo" }).click();
  await expect(text).toHaveValue("Confundi isolamento com desfazer uma transação incompleta.");
  let first = true;
  await page.route("**/api/review/*/reflection", async route => {
    if (route.request().method() !== "PUT" || !first) return route.continue();
    first = false;
    await route.fulfill({ status: 503, json: { message: "Conexão interrompida. Tente novamente." } });
  });
  await page.getByRole("button", { name: "Guardar reflexão" }).click();
  await expect(page.getByRole("alert")).toContainText("Conexão interrompida");
  await expect(text).toHaveValue("Confundi isolamento com desfazer uma transação incompleta.");
  await page.getByRole("button", { name: "Guardar reflexão" }).click();
  await expect(page.getByText("Reflexão guardada no caderno de erros.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revisar o que errei", exact: true }).first().click();
  await expect(page.locator(".review-reflection")).toContainText("Confundi isolamento com desfazer uma transação incompleta.");
});

for (const width of [320, 390, 768, 1440]) {
  test(`Dudu's achievement is readable and dismissible at ${width}px with reduced motion`, async ({ page, context }) => {
    await signUp(context);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/questoes");
    await page.getByRole("button", { name: "Resolver: Quando uma transação falha" }).click();
    await page.getByRole("radio", { name: /Atomicidade/ }).check();
    await page.getByRole("button", { name: "Confirmar resposta" }).click();
    const toast = page.locator(".toast");
    await expect(toast).toContainText("Primeiro passo");
    await expect(toast.locator("app-mascot img")).toBeVisible();
    expect(await toast.locator("app-mascot img").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/mascot-achievement-${width}.png` });
    const close = toast.getByRole("button", { name: "Fechar aviso" });
    await close.focus();
    await page.keyboard.press("Enter");
    await expect(toast).toHaveCount(0);
  });
}
