import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";

// Questões geradas por IA (GEN-1): do núcleo ao banco filtrado, com rótulo,
// código em bloco no enunciado e explicação após responder.

test.beforeAll(() => {
  // No CI o banco começa vazio; publicar de novo não cria versões repetidas.
  execFileSync("npx", ["tsx", "scripts/publish-generated.ts"], { stdio: "pipe", env: process.env });
});

test("the core links to generated practice, which opens labelled questions with code and explanations", async ({ page }) => {
  await page.goto("/biblioteca");
  await page.getByRole("button", { name: /^Sistemas operacionais: / }).click();
  await page.getByRole("button", { name: /^Praticar questões geradas \(\d+\)$/ }).click();

  await expect(page).toHaveURL(/\/questoes\?/);
  const params = new URL(page.url()).searchParams;
  expect([params.get("origin"), params.get("area")]).toEqual(["generated", "Sistemas operacionais"]);
  await expect(page.getByText("Questões geradas por IA para treinar cada área")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Origem" })).toHaveValue("generated");

  await page.getByRole("button", { name: /Contador compartilhado sem sincronização/ }).click();
  await expect(page.getByText("Gerada por IA", { exact: false }).first()).toBeVisible();
  await expect(page.locator("pre.prompt-code")).toContainText("contador++");

  await page.getByRole("radio").nth(3).check();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.getByText(/Resposta: D\./)).toBeVisible();
  await expect(page.getByText(/^E\) Variáveis locais ficam na pilha/m)).toBeVisible();
});

test("the default question bank does not mix generated questions with the official ones", async ({ page }) => {
  await page.goto("/questoes");
  await expect(page.getByRole("combobox", { name: "Origem" })).toHaveValue("");
  await expect(page.getByRole("button", { name: /Contador compartilhado sem sincronização/ })).toHaveCount(0);
});
