import { test, expect } from "@playwright/test";
import { signUp } from "./session-helpers";

// Meta diária, conquistas, flashcards e biblioteca (ENG-1, FLASH-1, LIB-1).

test("answering fills today's goal, unlocks a medal and shows it in Conquistas", async ({ page, context }) => {
  await signUp(context);
  await page.goto("/questoes");
  await page.getByRole("button", { name: /^Resolver:/ }).first().click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.getByRole("button", { name: /^Meta do dia: 1 de 5 questões/ })).toBeVisible();
  await expect(page.getByText("Conquista desbloqueada")).toBeVisible();
  await expect(page.getByText("Primeiro passo").first()).toBeVisible();

  await page.getByRole("button", { name: /^Meta do dia/ }).click();
  await expect(page.getByRole("heading", { name: "Conquistas", level: 1 })).toBeVisible();
  const medals = page.getByRole("region", { name: /Medalhas/ });
  await expect(medals).toContainText("1 de 14");
  await expect(medals.getByRole("listitem").first()).toContainText("Primeiro passo");
  // Meta menor: a de hoje fica batida na hora.
  await page.getByRole("radiogroup", { name: "Meta de questões por dia" }).getByText("3", { exact: true }).click();
  await page.getByRole("radiogroup", { name: "Meta de questões por dia" }).getByText("3", { exact: true }).click();
  await expect(page.getByText(/Faltam 2 questões/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Ranking de constância" })).toContainText("você");
});

test("a flashcard session flips cards, schedules them and ends with a summary", async ({ page, context }) => {
  await signUp(context);
  await page.goto("/");
  await page.getByRole("button", { name: "Flashcards" }).first().click();
  await expect(page.getByRole("heading", { name: "Flashcards", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /Compiladores/ }).click();
  await expect(page.getByText(/faltam 8/)).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Space");
    await expect(page.getByRole("group", { name: "Como foi lembrar?" })).toBeVisible();
    // Espera a nota ser salva: durante o salvamento o cartão não vira.
    const saved = page.waitForResponse((r) => /\/api\/flashcards\/.+\/review$/.test(r.url()));
    await page.keyboard.press(i === 0 ? "1" : "3");
    await saved;
    await expect(page.getByRole("group", { name: "Como foi lembrar?" })).toBeHidden();
  }
  // O cartão errado volta no fim da mesma sessão.
  await expect(page.getByText(/faltam 1/)).toBeVisible();
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  await page.getByRole("button", { name: /^Fácil/ }).click();
  await expect(page.getByRole("heading", { name: "9 revisões" })).toBeVisible();
  await page.getByRole("button", { name: "Ver baralhos" }).click();
  await expect(page.getByRole("button", { name: /Compiladores/ })).toContainText("0 novos");
});

test("the library opens a one-page sheet and announces what is coming", async ({ page, context }) => {
  await signUp(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Biblioteca" }).first().click();
  await expect(page.getByRole("heading", { name: "Biblioteca", level: 1 })).toBeVisible();
  await expect(page.getByText("Plano até a prova")).toBeVisible();
  await page.getByRole("button", { name: /Grafos e seus algoritmos/ }).click();
  await expect(page.getByRole("heading", { name: "Grafos e seus algoritmos", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Pegadinhas comuns" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Biblioteca" }).first().click();
});
