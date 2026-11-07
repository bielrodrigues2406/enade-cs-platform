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

  // A correção leva à lição do conceito cobrado (Biblioteca como centro do estudo).
  const concepts = page.getByRole("complementary", { name: "Conceito cobrado" });
  await expect(concepts).toContainText("Conceitos cobrados");
  const item = concepts.getByRole("listitem").filter({ hasText: "Região crítica e exclusão mútua" });
  await item.getByRole("button", { name: /Ler a lição/ }).click();
  await expect(page).toHaveURL(/\/biblioteca\/sistemas-operacionais\/so-regiao-critica$/);
  await expect(page.getByRole("heading", { name: "Região crítica e exclusão mútua", level: 1 })).toBeVisible();
});

test("the default question bank does not mix generated questions with the official ones", async ({ page }) => {
  await page.goto("/questoes");
  await expect(page.getByRole("combobox", { name: "Origem" })).toHaveValue("");
  await expect(page.getByRole("button", { name: /Contador compartilhado sem sincronização/ })).toHaveCount(0);
});

test("figures appear where the prompt marks them, with alt text and the AI caption only on illustrations", async ({ page }) => {
  await page.goto("/questoes?origin=generated&area=Algoritmos");
  await page.getByRole("button", { name: /Dijkstra num grafo pequeno/ }).click();
  const graph = page.getByRole("img", { name: /^Grafo dirigido com os vértices A, B, C, D e E/ });
  await expect(graph).toBeVisible();
  await expect.poll(() => graph.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  // O marcador [figura] põe o grafo entre a frase dos pesos e a pergunta.
  const blocks = await page.locator(".prompt, .prompt-figure").evaluateAll((nodes) =>
    nodes.map((node) => (node.tagName === "FIGURE" ? "[figura]" : node.textContent!.trim())),
  );
  expect(blocks).toHaveLength(3);
  expect(blocks[0]).toMatch(/como mostra a figura\.$/);
  expect(blocks[1]).toBe("[figura]");
  expect(blocks[2]).toMatch(/^O aplicativo roda o algoritmo de Dijkstra/);
  await expect(page.locator(".prompt-figure figcaption")).toHaveCount(0);

  await page.goto("/questoes?origin=generated&area=Forma%C3%A7%C3%A3o%20Geral");
  await page.getByRole("button", { name: /Vídeo manipulado às vésperas da eleição/ }).click();
  await expect(page.locator(".prompt-figure figcaption")).toHaveText("Ilustração gerada por IA");
});
