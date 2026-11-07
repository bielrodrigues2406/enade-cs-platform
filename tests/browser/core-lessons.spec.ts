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
  for (const title of ["Exemplo resolvido", "Armadilhas", "Como cai no ENADE", "Para fixar"])
    await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
  const figure = page.getByRole("img", { name: /^Quatro carros ocupam um cruzamento/ });
  await expect(figure).toBeVisible();
  await expect(page.locator(".lesson-figure figcaption")).toHaveText("Ilustração gerada por IA");
  await expect(page.locator(".lesson-example .lesson-check")).toContainText("Conferido: Executado em Python 3");
  // Caiu em 2017; não pode aparecer como "ainda não caiu", publicada ou não neste banco.
  await expect(page.locator(".lesson-questions").first()).toContainText("2017 Deadlock e ordem de aquisição de semáforos");
  await expect(page.getByText("Sem questão ligada neste recorte")).toHaveCount(0);

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

// Revisão do Codex (R9): a lição e a área ficam no endereço; recarregar e
// Voltar/Avançar não perdem o lugar, e um endereço sem lição volta para a área.
test("the open lesson lives in the address: reload, Back and Forward keep the place", async ({ page }) => {
  await page.goto("/biblioteca");
  await page.getByRole("button", { name: /^Sistemas operacionais: / }).click();
  await expect(page).toHaveURL(/\/biblioteca\/sistemas-operacionais$/);
  await page.getByRole("button", { name: "Ler a lição: Deadlock" }).click();
  await expect(page.getByRole("heading", { name: "Deadlock", level: 1 })).toBeFocused();
  await expect(page).toHaveURL(/\/biblioteca\/sistemas-operacionais\/so-deadlock$/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Deadlock", level: 1 })).toBeVisible();
  await expect(page.getByText("Lição 7 de 10")).toBeVisible();

  await page.getByRole("button", { name: /Paginação, segmentação e fragmentação/ }).click();
  await expect(page.getByRole("heading", { name: "Paginação, segmentação e fragmentação", level: 1 })).toBeFocused();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Deadlock", level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/biblioteca\/sistemas-operacionais$/);
  await expect(page.getByRole("heading", { name: "Sistemas operacionais", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deadlock", level: 1 })).toHaveCount(0);
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Deadlock", level: 1 })).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/biblioteca$/);
  await expect(page.getByRole("heading", { name: "Biblioteca", exact: true, level: 1 })).toBeVisible();
});

test("an address with a concept that has no lesson falls back to the area", async ({ page }) => {
  await page.goto("/biblioteca/sistemas-operacionais/nao-existe");
  await expect(page.getByRole("heading", { name: "Sistemas operacionais", level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/biblioteca\/sistemas-operacionais$/);
});

test("a one-page sheet also lives in the address and Back returns to the list", async ({ page }) => {
  await page.goto("/biblioteca");
  await page.getByRole("button", { name: /Grafos e seus algoritmos/ }).click();
  await expect(page.getByRole("heading", { name: "Grafos e seus algoritmos", level: 1 })).toBeFocused();
  await expect(page).toHaveURL(/\/biblioteca\/fichas\/grafos$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Grafos e seus algoritmos", level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/biblioteca$/);
  await expect(page.getByRole("heading", { name: "Biblioteca", exact: true, level: 1 })).toBeVisible();
});

// Modelo novo de lição (revisão do Codex, §4) nas três lições piloto.
test("a pilot lesson shows objective, prerequisites, counterexample, transfer and an honest source note", async ({ page }) => {
  await page.goto("/biblioteca/sistemas-operacionais/so-deadlock");
  await expect(page.getByRole("heading", { name: "Deadlock", level: 1 })).toBeVisible();
  await expect(page.locator(".lesson-goal")).toContainText("Ao terminar, você consegue");
  await expect(page.getByRole("heading", { name: "Armadilhas", level: 2 })).toBeVisible();
  await expect(page.locator(".lesson-claim")).toContainText("Parece certo, mas não é");
  await expect(page.locator(".lesson-claim")).toContainText("Todo ciclo no grafo de alocação");
  // Contraexemplo e erro comum na mesma seção, sem repetir o ciclo no grafo.
  await expect(page.locator(".lesson-mistake-text")).not.toContainText("ciclo");

  const transfer = page.locator(".lesson-transfer details");
  await expect(transfer.getByText("A correção quebra a espera circular.")).toBeHidden();
  await transfer.locator("summary").click();
  await expect(transfer.getByText(/A correção quebra a espera circular\./)).toBeVisible();
  await expect(transfer.locator(".lesson-check")).toContainText("busca exaustiva");

  const provenance = page.locator(".lesson-provenance");
  await expect(provenance.getByRole("link", { name: /Operating Systems: Three Easy Pieces/ })).toHaveAttribute("href", /threads-bugs\.pdf$/);
  await expect(provenance).toContainText("seção 32.3");
  await expect(provenance).toContainText("Sem revisão humana.");
  await expect(page.getByRole("heading", { name: "Fonte e conferência" })).toHaveCount(0);

  await page.locator(".lesson-prereq").getByRole("button", { name: "Semáforos, mutex e monitores" }).click();
  await expect(page).toHaveURL(/\/biblioteca\/sistemas-operacionais\/so-semaforos$/);
  await expect(page.locator(".lesson-counter")).toHaveCount(0);
  // Lição ainda no modelo antigo: a tela não finge que houve consulta.
  await expect(page.locator(".lesson-provenance")).toContainText("nenhuma consultada para esta lição");
  await expect(page.locator(".lesson-provenance")).toContainText("recomendação, não consulta");
});

test("a pilot lesson fits a 320 px screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/biblioteca/algoritmos/alg-ordenacao");
  await expect(page.getByRole("heading", { name: "Agora sozinho", level: 2 })).toBeVisible();
  await page.locator(".lesson-transfer summary").click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

// Revisão EST-EXP1 do Codex: os atalhos da Biblioteca levam a área junto.
test("library shortcuts keep the area: sheet training and area flashcards", async ({ page }) => {
  await page.goto("/biblioteca/fichas/grafos");
  await page.getByRole("button", { name: "Treinar Algoritmos" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Simulado por área");
  await expect(dialog.getByRole("heading", { name: "Algoritmos" })).toBeVisible();
  await dialog.getByRole("button", { name: "Sem cronômetro" }).click();
  await expect(page).toHaveURL(/\/treino/);
  await expect(page.getByText("Algoritmos").first()).toBeVisible();

  await page.goto("/biblioteca/sistemas-operacionais");
  await page.getByRole("button", { name: "Flashcards da área" }).click();
  await expect(page).toHaveURL(/\/flashcards$/);
  await expect(page.locator("#flash-session-title")).toContainText("Sistemas operacionais");
});

// Uma resposta lenta não pode trocar o conteúdo da lição que o histórico reabriu.
test("a delayed lesson cannot overwrite the lesson restored by Back", async ({ page }) => {
  await page.goto("/biblioteca/sistemas-operacionais/so-semaforos");
  const example = page.locator(".lesson-example h3");
  await expect(example).toHaveText("Semáforo de sinalização e semáforo de recurso");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let arrived!: () => void;
  const pending = new Promise<void>((resolve) => { arrived = resolve; });
  await page.route("**/api/core/sistemas-operacionais/lessons/so-produtor-consumidor", async (route) => {
    const response = await route.fetch();
    arrived();
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: /^Produtor-consumidor/ }).click();
  await pending;
  await page.goBack();
  await expect(example).toHaveText("Semáforo de sinalização e semáforo de recurso");
  const delivered = page.waitForEvent("requestfinished", (request) => request.url().endsWith("/lessons/so-produtor-consumidor"));
  release();
  await delivered;
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole("heading", { name: "Semáforos, mutex e monitores", level: 1 })).toBeVisible();
  await expect(example).toHaveText("Semáforo de sinalização e semáforo de recurso");
});
