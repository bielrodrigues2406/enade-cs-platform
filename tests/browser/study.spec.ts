import { test, expect } from "@playwright/test";
test("filter, keyboard response, persistence, failure and retry", async ({
  page,
}) => {
  await page.goto("/questoes");
  await expect(
    page.getByRole("heading", { name: "Banco de questões" }),
  ).toBeVisible();
  await page.getByLabel("Buscar no caderno").fill("inexistente");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nenhuma questão nesta seleção" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page
    .getByRole("button", { name: "Resolver: Quando uma transação falha" })
    .click();
  const correct = page.getByRole("radio", { name: /Atomicidade/ });
  await correct.focus();
  await page.keyboard.press("Space");
  await expect(correct).toBeChecked();
  await page.route("**/api/questions/*/answer", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Falha temporária de conexão." }),
    }),
  );
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.getByRole("alert")).toContainText("Falha temporária");
  await expect(correct).toBeChecked();
  await expect(page.getByText("RESPOSTA SALVA", { exact: true })).toHaveCount(
    0,
  );
  await page.unroute("**/api/questions/*/answer");
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.getByRole("status")).toContainText("Você acertou.");
  await page.reload();
  await page
    .getByRole("button", { name: "Revisar: Quando uma transação falha" })
    .click();
  await expect(page.getByRole("radio", { name: /Atomicidade/ })).toBeChecked();
  await expect(page.getByRole("status")).toContainText("RESPOSTA SALVA");
  await page.getByRole("button", { name: "Alterar resposta" }).click();
  await page.getByRole("radio", { name: /Isolamento/ }).check();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Vamos entender este conceito.",
  );
});
for (const width of [320, 390, 768, 1440]) {
  test(`catalog and resolution reflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/questoes");
    await expect(
      page.getByRole("button", {
        name: "Resolver: Entrega confiável de um fluxo",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/catalog-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Resolver: Entrega confiável de um fluxo" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Entrega confiável de um fluxo" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "TCP", exact: true }).check();
    await page.getByRole("button", { name: "Confirmar resposta" }).click();
    await expect(page.getByRole("status")).toContainText("Você acertou.");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/resolution-${width}.png`,
      fullPage: true,
    });
  });
}

test("feedback leads to the next question of the current selection", async ({
  page,
}) => {
  await page.goto("/questoes");
  const titles = await page.locator(".question-list h3").allTextContents();
  expect(titles.length).toBeGreaterThan(1);
  const [first, second] = titles.map((title) => title.trim());
  await page
    .getByRole("button", { name: `Resolver: ${first}`, exact: true })
    .click();
  await expect(
    page.getByText(`Questão 1 de ${titles.length} nesta seleção`),
  ).toBeVisible();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.locator(".feedback")).toContainText("RESPOSTA SALVA");
  await page
    .getByRole("button", { name: `Próxima questão: ${second}`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: second, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`Questão 2 de ${titles.length} nesta seleção`),
  ).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
});
