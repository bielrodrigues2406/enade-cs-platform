import { expect, test, type Page } from "@playwright/test";

const unavailable = "O CadernoCC está temporariamente indisponível. Tente novamente em instantes.";
const maintenance = "O CadernoCC está em manutenção. Tente novamente mais tarde.";

async function catalog(page: Page) {
  await page.goto("/questoes");
  await expect(page.getByRole("heading", { name: "Banco de questões", exact: true })).toBeVisible();
}

async function loginForm(page: Page) {
  await catalog(page);
  await page.locator("header").getByRole("button", { name: "Entrar", exact: true }).click();
  const form = page.locator("app-account form");
  await expect(form).toBeVisible();
  await form.getByLabel("E-mail", { exact: true }).fill("service-test@example.invalid");
  await form.getByLabel("Senha", { exact: true }).fill("TEST ONLY senha 2026!");
  return form;
}

for (const scenario of [
  { label: "503 sem manutenção declarada", status: 503, body: { message: "Internal server error" }, expected: unavailable },
  { label: "503 de manutenção declarada", status: 503, body: { code: "SERVICE_MAINTENANCE", message: "Mensagem técnica TEST ONLY" }, expected: maintenance },
  { label: "502 com HTML do proxy", status: 502, body: "<html><body>Bad Gateway TEST ONLY</body></html>", expected: unavailable },
]) {
  test(`login mostra mensagem útil para ${scenario.label} e mantém o formulário`, async ({ page }) => {
    const form = await loginForm(page);
    let requests = 0;
    await page.route("**/api/auth/login", async (route) => {
      requests++;
      await route.fulfill({ status: scenario.status,
        contentType: typeof scenario.body === "string" ? "text/html" : "application/json",
        body: typeof scenario.body === "string" ? scenario.body : JSON.stringify(scenario.body) });
    });
    await form.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(form.getByRole("alert")).toHaveText(scenario.expected);
    await expect(form.getByLabel("E-mail", { exact: true })).toHaveValue("service-test@example.invalid");
    await expect(form.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
    await expect(form.getByRole("alert")).not.toContainText(/Internal server error|Bad Gateway|Mensagem técnica/);
    expect(requests).toBe(1);
    await expect(page.getByRole("complementary", { name: "Manutenção programada" })).toHaveCount(0);
  });
}

test("falha de rede no início oferece nova tentativa sem expor o erro do navegador", async ({ page }) => {
  await page.route("**/api/session", (route) => route.abort("failed"));
  await page.goto("/questoes");
  await expect(page.getByRole("heading", { name: "Não foi possível abrir o caderno" })).toBeVisible();
  const error = page.getByRole("alert");
  await expect(error).toContainText(/Não foi possível/);
  await expect(error).not.toContainText(/Failed to fetch|NetworkError|TypeError/);
  await page.unroute("**/api/session");
  await error.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Banco de questões", exact: true })).toBeVisible();
});

test("falha de rede no login mantém o e-mail e não repete a autenticação", async ({ page }) => {
  const form = await loginForm(page);
  let requests = 0;
  await page.route("**/api/auth/login", (route) => { requests++; return route.abort("failed"); });
  await form.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("Não foi possível confirmar a operação.");
  await expect(form.getByRole("alert")).not.toContainText(/Failed to fetch|NetworkError|TypeError/);
  await expect(form.getByLabel("E-mail", { exact: true })).toHaveValue("service-test@example.invalid");
  await expect(form.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
  expect(requests).toBe(1);
});

test("aviso programado informa horário sem modal, roubo de foco ou overflow", async ({ page }) => {
  const start = new Date(Date.now() + 3_600_000).toISOString();
  const end = new Date(Date.now() + 7_200_000).toISOString();
  await page.route("**/api/service-status", (route) => route.fulfill({
    json: { notice: { message: "Atualização TEST ONLY do CadernoCC.", startsAt: start, endsAt: end } },
  }));
  await catalog(page);
  const notice = page.getByRole("complementary", { name: "Manutenção programada", exact: true });
  await expect(notice).toContainText("Atualização TEST ONLY do CadernoCC.");
  const format = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  await expect(notice).toContainText(format.format(new Date(start)));
  await expect(notice).toContainText(format.format(new Date(end)));
  await expect(notice).toContainText("horário de Brasília");
  await expect(page.locator("app-service-notice [aria-live='polite']")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Buscar questão", { exact: true }).focus();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(notice).toBeVisible();
    await expect(page.getByLabel("Buscar questão", { exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `aviso em ${width}px`).toBe(true);
    await page.screenshot({ path: `test-results/service-notice-${width}.png`, fullPage: true });
  }
});

test("consulta do aviso com falha não inventa manutenção nem impede o estudo", async ({ page }) => {
  await page.route("**/api/service-status", (route) => route.fulfill({ status: 503, json: { message: "TEST ONLY indisponibilidade" } }));
  await catalog(page);
  await expect(page.getByRole("complementary", { name: "Manutenção programada" })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resolver: Quando uma transação falha", exact: true })).toBeEnabled();
});

test("Biblioteca mantém o índice e tenta abrir a mesma ficha após falha temporária", async ({ page }) => {
  await page.goto("/biblioteca");
  await expect(page.getByRole("heading", { name: "Biblioteca", exact: true })).toBeVisible();
  const sheets = page.getByRole("list", { name: "Fichas por assunto", exact: true });
  await expect(sheets.getByRole("listitem")).toHaveCount(12);
  let reads = 0;
  await page.route("**/api/sheets/modelagem-e-sql", async (route) => {
    reads++;
    if (reads === 1) await route.fulfill({ status: 503, json: { message: "TEST ONLY indisponibilidade" } });
    else await route.continue();
  });
  await sheets.getByRole("button", { name: /Modelagem, SQL e transações/ }).click();
  const error = page.locator("app-library").getByRole("alert");
  await expect(error).toContainText(unavailable);
  await expect(error).not.toContainText("Ficha não encontrada");
  await expect(sheets.getByRole("listitem")).toHaveCount(12);
  await error.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Modelagem, SQL e transações", exact: true })).toBeVisible();
  await expect(page.locator("app-library").getByRole("alert")).toHaveCount(0);
  expect(reads).toBe(2);
});

test("resposta objetiva permanece selecionada quando a confirmação perde a conexão", async ({ page }) => {
  await catalog(page);
  await page.getByRole("button", { name: "Resolver: Quando uma transação falha", exact: true }).click();
  const answer = page.getByRole("radio", { name: /Atomicidade/ });
  await answer.check();
  let writes = 0;
  await page.route("**/api/questions/demo-sql-v1/answer", async (route) => {
    writes++;
    if (writes === 1) await route.abort("failed");
    else await route.fulfill({ json: { optionId: "demo-sql-v1-1", revision: 1, correct: true,
      correctOptionId: "demo-sql-v1-1", explanation: "TEST ONLY explicação sintética.", explanationCredit: "TEST ONLY" } });
  });
  await page.getByRole("button", { name: "Confirmar resposta", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Não foi possível confirmar a operação.");
  await expect(answer).toBeChecked();
  await expect(page.getByText("RESPOSTA SALVA", { exact: true })).toHaveCount(0);
  expect(writes).toBe(1);
  await page.getByRole("button", { name: "Confirmar resposta", exact: true }).click();
  await expect(page.locator(".feedback")).toContainText("RESPOSTA SALVA");
  expect(writes).toBe(2);
});

test("rascunho discursivo permanece na tela após erro e só confirma após retry manual", async ({ page }) => {
  const id = "test-only-service-draft";
  const title = "TEST ONLY discursiva de conexão";
  const body = "TEST ONLY texto ainda não confirmado no servidor.";
  await page.route("**/api/discursive", (route) => route.fulfill({ json: [
    { id, title, area: "Banco de dados", subject: "TEST ONLY", status: "NEW", score: null },
  ] }));
  await page.route(`**/api/discursive/${id}`, (route) => route.fulfill({ json: {
    id, title, area: "Banco de dados", subject: "TEST ONLY", criteria: [{ label: "a", points: 10 }],
    examUrl: "https://example.invalid/test-only.pdf", standardUrl: null,
    promptImages: [], standardImages: [], response: null,
  } }));
  let writes = 0;
  await page.route(`**/api/discursive/${id}/response`, async (route) => {
    writes++;
    if (writes === 1) await route.fulfill({ status: 503, json: { message: "TEST ONLY indisponibilidade" } });
    else await route.fulfill({ json: { revision: 1 } });
  });
  await page.goto("/discursivas");
  await page.getByRole("button", { name: new RegExp(title) }).click();
  const draft = page.getByLabel(`Sua resposta para ${title}`, { exact: true });
  await draft.fill(body);
  await expect(page.locator("app-discursive").getByRole("alert")).toContainText(unavailable);
  await expect(draft).toHaveValue(body);
  await expect(page.getByText("Alterações não salvas", { exact: true })).toBeVisible();
  await expect(page.getByText("Rascunho salvo", { exact: true })).toHaveCount(0);
  expect(writes).toBe(1);
  await page.getByRole("button", { name: "Tentar salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible();
  await expect(draft).toHaveValue(body);
  expect(writes).toBe(2);
});
