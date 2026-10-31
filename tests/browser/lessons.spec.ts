import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { test, expect } from "@playwright/test";
import { signUp } from "./session-helpers";

// Turma e pessoas TEST ONLY; removidas ao final.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const className = `TEST ONLY turma ${randomUUID().slice(0, 8)}`;
const anaEnrollment = `PE3${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;

test.afterAll(async () => {
  await pool.query("DELETE FROM study_class WHERE name=$1", [className]);
  await pool.end();
});

test("a professor creates a class, pastes the roster, schedules a lesson, takes the roll and reads the dashboard", async ({ page, context, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(context);
  const email = (await (await context.request.get("/api/auth/me")).json()).email;
  await pool.query("INSERT INTO account_role(identity_id,role) SELECT identity_id,'PROFESSOR' FROM account WHERE email=$1", [email]);
  await page.goto("/questoes");
  await page.getByRole("button", { name: "Aulas" }).first().click();
  await page.getByLabel("Nome").fill(className);
  await page.getByRole("button", { name: "Criar turma" }).click();
  await expect(page.getByRole("heading", { name: className, level: 1 })).toBeVisible();

  await page.getByLabel(/Copie as colunas/).fill(`Nome\tProntuário\nAna TEST ONLY\t${anaEnrollment}\nBruno TEST ONLY\tPE3000002`);
  await page.getByRole("button", { name: "Adicionar à turma" }).click();
  await expect(page.getByRole("status")).toContainText("2 adicionadas");

  await page.getByLabel("Data").fill("2026-11-10");
  await page.getByLabel("Matéria").fill("Redes");
  await page.getByLabel("Sala").fill("Lab 3");
  await page.getByRole("button", { name: "Marcar aula" }).click();
  await page.getByRole("button", { name: "Chamada" }).click();
  await expect(page.getByRole("heading", { name: "Chamada" })).toBeVisible();
  await page.getByRole("radio", { name: "Falta: Bruno TEST ONLY" }).click();
  await page.getByRole("button", { name: "Marcar não lançados como presentes" }).click();
  await expect(page.getByText("1 de 2 presentes")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Presente: Ana TEST ONLY" })).toHaveAttribute("aria-checked", "true");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `largura ${width}`).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/lessons-roll-${width}.png` });
  }

  await page.getByRole("button", { name: new RegExp(`← ${className}`) }).click();
  // Ana cria conta com o prontuário da lista e erra uma questão.
  const ana = await browser.newContext();
  await signUp(ana, { enrollment: anaEnrollment });
  expect((await ana.request.put("/api/questions/demo-sql-v1/answer", { data: { optionId: "demo-sql-v1-0", baseRevision: 0 } })).ok()).toBe(true);
  await ana.close();

  await page.getByRole("tab", { name: "Desempenho" }).click();
  const summary = page.locator(".dash-summary");
  await expect(summary).toContainText("1 de 2");
  await expect(page.locator(".dash-areas")).toContainText("Banco de dados");
  await expect(page.locator(".dash-areas")).toContainText("amostra pequena");
  await expect(summary).toContainText("Abaixo de 75%1 aluno");
  await expect(page.getByRole("row", { name: /Bruno TEST ONLY/ })).toContainText("Sem conta com este prontuário");
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `largura ${width}`).toBe(true);
    await page.screenshot({ path: `test-results/class-dashboard-${width}.png`, fullPage: true });
  }
  await page.getByRole("tab", { name: "Aulas e lista" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar presença (planilha)" }).click();
  const csv = await (await download).createReadStream();
  let text = "";
  for await (const chunk of csv) text += chunk;
  expect(text).toContain(`Ana TEST ONLY;${anaEnrollment};P;1;100`);
  expect(text).toContain("Bruno TEST ONLY;PE3000002;F;0;0");
});
