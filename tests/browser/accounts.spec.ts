import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const password = "Caderno estudo 2026!"; // Synthetic credentials for isolated test accounts only.
const test = base.extend<{
  accountEmail: string;
  trackIdentity: (context: BrowserContext) => Promise<void>;
}>({
  accountEmail: async ({}, use) => {
    const email = `browser-${randomUUID()}@example.invalid`;
    try {
      await use(email);
    } finally {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const accounts = await client.query(
          "SELECT identity_id FROM account WHERE email=$1",
          [email],
        );
        for (const { identity_id } of accounts.rows) {
          await client.query("DELETE FROM answer WHERE owner_id=$1", [
            identity_id,
          ]);
          await client.query(
            "DELETE FROM browser_session WHERE identity_id=$1",
            [identity_id],
          );
          await client.query("DELETE FROM account WHERE identity_id=$1", [
            identity_id,
          ]);
          await client.query("DELETE FROM study_identity WHERE id=$1", [
            identity_id,
          ]);
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  },
  trackIdentity: async ({}, use) => {
    const identities = new Set<string>();
    await use(async (context) => {
      const cookie = (await context.cookies("http://localhost:4200/api")).find(
        (c) => c.name === "enade_session",
      );
      if (!cookie) return;
      const tokenHash = createHash("sha256").update(cookie.value).digest("hex");
      const row = (
        await pool.query(
          "SELECT identity_id FROM browser_session WHERE token_hash=$1",
          [tokenHash],
        )
      ).rows[0];
      if (row) identities.add(row.identity_id);
    });
    // Remove only anonymous identities observed in this test. Account cleanup is handled separately.
    for (const id of identities) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const identity = (
          await client.query(
            "SELECT id FROM study_identity WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (
          identity &&
          !(
            await client.query("SELECT 1 FROM account WHERE identity_id=$1", [
              id,
            ])
          ).rowCount
        ) {
          await client.query("DELETE FROM answer WHERE owner_id=$1", [id]);
          await client.query(
            "DELETE FROM browser_session WHERE identity_id=$1",
            [id],
          );
          await client.query("DELETE FROM study_identity WHERE id=$1", [id]);
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  },
});
test.afterAll(async () => {
  await pool.end();
});

async function enterForm(page: Page, mode: "Entrar" | "Criar conta") {
  await page
    .locator("header")
    .getByRole("button", { name: mode, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: mode, exact: true }),
  ).toBeVisible();
  return page.locator("app-account form");
}
async function answerSQL(page: Page) {
  await page
    .getByRole("button", { name: "Resolver: Quando uma transação falha" })
    .click();
  await page.getByRole("radio", { name: /Atomicidade/ }).check();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.getByRole("status")).toContainText("Você acertou.");
}

test("signup preserves guest answers; logout isolates; another browser resumes account without guest merge", async ({
  page,
  context,
  browser,
  accountEmail,
  trackIdentity,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Banco de questões" }),
  ).toBeVisible();
  await trackIdentity(context);
  await answerSQL(page);
  const form = await enterForm(page, "Criar conta");
  await expect(page.getByText(/não há recuperação de senha/)).toBeVisible();
  await form.getByLabel("E-mail", { exact: true }).fill(accountEmail);
  await form.getByLabel("Senha", { exact: true }).fill(password);
  const registration = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/register") &&
      response.request().method() === "POST",
    { timeout: 15000 },
  );
  await form.getByRole("button", { name: "Criar conta", exact: true }).click();
  expect((await registration).status()).toBe(201);
  await expect(
    page.getByRole("status").filter({ hasText: "Conta criada." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Revisar: Quando uma transação falha" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("header")).toContainText(accountEmail);
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Não foi possível sair agora." }),
    }),
  );
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível sair agora.",
  );
  await expect(page.locator("header")).toContainText(accountEmail);
  await page.unroute("**/api/auth/logout");
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Resolver: Quando uma transação falha" }),
  ).toBeVisible();
  await expect(page.locator("header")).not.toContainText(accountEmail);
  await trackIdentity(context);

  const otherContext = await browser.newContext({
    viewport: { width: 320, height: 900 },
  });
  try {
    const other = await otherContext.newPage();
    await other.goto("http://localhost:4200/");
    await expect(
      other.getByRole("heading", { name: "Banco de questões" }),
    ).toBeVisible();
    await trackIdentity(otherContext);
    await other
      .getByRole("button", { name: "Resolver: Entrega confiável de um fluxo" })
      .click();
    await other.getByRole("radio", { name: "TCP", exact: true }).check();
    await other.getByRole("button", { name: "Confirmar resposta" }).click();
    await expect(other.getByRole("status")).toContainText("Você acertou.");
    const login = await enterForm(other, "Entrar");
    await expect(
      other.getByText(/não são transferidas ao entrar/),
    ).toBeVisible();
    await login.getByLabel("E-mail", { exact: true }).fill(accountEmail);
    await login.getByLabel("Senha", { exact: true }).fill("Senha errada 2026!");
    const rejectedLogin = other.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/login") &&
        response.request().method() === "POST",
      { timeout: 15000 },
    );
    await login.getByRole("button", { name: "Entrar", exact: true }).click();
    expect((await rejectedLogin).status()).toBe(401);
    await expect(other.getByRole("alert")).toContainText(
      "E-mail ou senha incorretos.",
    );
    await expect(login.getByLabel("E-mail", { exact: true })).toHaveValue(
      accountEmail,
    );
    await expect(
      other.getByRole("button", { name: "Sair da conta" }),
    ).toHaveCount(0);
    await other.getByRole("button", { name: "Voltar ao estudo" }).click();
    await expect(
      other.getByRole("button", {
        name: "Revisar: Entrega confiável de um fluxo",
      }),
    ).toBeVisible();
    await enterForm(other, "Entrar");
    await login.getByLabel("E-mail", { exact: true }).fill(accountEmail);
    await login.getByLabel("Senha", { exact: true }).fill(password);
    await login.getByLabel("Senha", { exact: true }).focus();
    await other.keyboard.press("Tab");
    await expect(
      login.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeFocused();
    const acceptedLogin = other.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/login") &&
        response.request().method() === "POST",
      { timeout: 15000 },
    );
    await other.keyboard.press("Enter");
    expect((await acceptedLogin).status()).toBe(200);
    await expect(
      other.getByRole("button", {
        name: "Revisar: Quando uma transação falha",
      }),
    ).toBeVisible();
    await expect(
      other.getByRole("button", {
        name: "Resolver: Entrega confiável de um fluxo",
      }),
    ).toBeVisible();
    expect(
      await other.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await other
      .getByRole("button", { name: "Revisar: Quando uma transação falha" })
      .click();
    await expect(
      other.getByRole("radio", { name: /Atomicidade/ }),
    ).toBeChecked();
  } finally {
    await otherContext.close();
  }
});

test("account forms validate and reflow at 320/390/768/1440 CSS pixels", async ({
  page,
  context,
  trackIdentity,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Banco de questões" }),
  ).toBeVisible();
  await trackIdentity(context);
  const form = await enterForm(page, "Criar conta");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      form.getByRole("button", { name: "Criar conta", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/account-register-${width}.png`,
      fullPage: true,
    });
  }
  await form.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(
    page.getByText("Informe um e-mail válido.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("A senha deve ter de 12 a 128 caracteres.", { exact: true }),
  ).toBeVisible();
  await form.getByLabel("Senha", { exact: true }).fill(password);
  await page
    .locator(".account-switch")
    .getByRole("button", { name: "Entrar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Voltar ao estudo" }).click();
  await expect(
    page.getByRole("heading", { name: "Banco de questões" }),
  ).toBeVisible();
});

test("logout in another tab clears a pending save and rejects its late UI response", async ({
  page,
  context,
  accountEmail,
  trackIdentity,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Banco de questões" }),
  ).toBeVisible();
  await trackIdentity(context);
  const registered = await context.request.post("/api/auth/register", {
    data: { email: accountEmail, password },
  });
  expect(registered.status()).toBe(201);
  await page.reload();
  await expect(page.locator("header")).toContainText(accountEmail);
  const tab = await context.newPage();
  await tab.goto("/");
  await tab
    .getByRole("button", { name: "Resolver: Quando uma transação falha" })
    .click();
  await tab.getByRole("radio", { name: /Atomicidade/ }).check();
  let responseReady!: () => void;
  const responseCaptured = new Promise<void>((resolve) => {
    responseReady = resolve;
  });
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await tab.route("**/api/questions/demo-sql-v1/answer", async (route) => {
    const response = await route.fetch();
    responseReady();
    await responseGate;
    await route.fulfill({ response });
  });
  try {
    await tab.getByRole("button", { name: "Confirmar resposta" }).click();
    await responseCaptured;
    await page
      .getByRole("button", { name: "Sair da conta", exact: true })
      .click();
    await expect(
      tab.getByRole("heading", { name: "Banco de questões" }),
    ).toBeVisible();
    await expect(
      tab
        .locator("header")
        .getByRole("button", { name: "Entrar", exact: true }),
    ).toBeVisible();
    await trackIdentity(context);
    releaseResponse();
    await tab.unrouteAll({ behavior: "wait" });
    await expect(
      tab.getByRole("heading", {
        name: "Quando uma transação falha",
        exact: true,
        level: 1,
      }),
    ).toHaveCount(0);
    await expect(
      tab.getByRole("button", { name: "Resolver: Quando uma transação falha" }),
    ).toBeVisible();
    await expect(tab.getByText("RESPOSTA SALVA", { exact: true })).toHaveCount(
      0,
    );
  } finally {
    releaseResponse();
    await tab.close();
  }
});

test("a delayed logout blocks study actions until the guest catalog replaces account history", async ({
  page,
  context,
  accountEmail,
  trackIdentity,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Banco de questões" }),
  ).toBeVisible();
  await trackIdentity(context);
  const registered = await context.request.post("/api/auth/register", {
    data: { email: accountEmail, password },
  });
  expect(registered.status()).toBe(201);
  const saved = await context.request.put("/api/questions/demo-sql-v1/answer", {
    data: { optionId: "demo-sql-v1-1", baseRevision: 0 },
  });
  expect(saved.status()).toBe(200);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Revisar: Quando uma transação falha" }),
  ).toBeVisible();
  let requestArrived!: () => void;
  const requestCaptured = new Promise<void>((resolve) => {
    requestArrived = resolve;
  });
  let releaseLogout!: () => void;
  const logoutGate = new Promise<void>((resolve) => {
    releaseLogout = resolve;
  });
  await page.route("**/api/auth/logout", async (route) => {
    requestArrived();
    await logoutGate;
    await route.continue();
  });
  try {
    await page
      .getByRole("button", { name: "Sair da conta", exact: true })
      .click();
    await requestCaptured;
    await expect(page.getByRole("status")).toContainText(
      "Atualizando sua sessão",
    );
    // The controls from the old account cannot dispatch new filters or question reads.
    await expect(
      page.getByRole("button", { name: "Filtrar", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^(Resolver|Revisar):/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Banco de questões", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Banco de questões", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toContainText(
      "Atualizando sua sessão",
    );
    releaseLogout();
    await expect(
      page.getByRole("button", {
        name: "Resolver: Quando uma transação falha",
      }),
    ).toBeVisible();
    await expect(page.locator("header")).not.toContainText(accountEmail);
    await expect(
      page.getByRole("heading", {
        name: "Quando uma transação falha",
        exact: true,
        level: 1,
      }),
    ).toHaveCount(0);
    await trackIdentity(context);
    await page
      .getByRole("button", { name: "Resolver: Quando uma transação falha" })
      .click();
    await expect(
      page.getByRole("radio", { name: /Atomicidade/ }),
    ).not.toBeChecked();
    await expect(page.getByText("RESPOSTA SALVA", { exact: true })).toHaveCount(
      0,
    );
  } finally {
    releaseLogout();
    await page.unrouteAll({ behavior: "wait" });
  }
});
