import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let owners: Set<string>, questions: Set<string>;
test.beforeEach(() => {
  owners = new Set();
  questions = new Set();
});
test.afterEach(async () => {
  for (const id of owners)
    await pool.query("DELETE FROM answer WHERE owner_id=$1", [id]);
  for (const id of questions)
    await pool.query("DELETE FROM editorial_question WHERE id=$1", [id]);
  for (const id of owners) {
    await pool.query("DELETE FROM browser_session WHERE identity_id=$1", [id]);
    await pool.query("DELETE FROM account WHERE identity_id=$1", [id]);
    await pool.query("DELETE FROM study_identity WHERE id=$1", [id]);
  }
});
test.afterAll(async () => {
  await pool.end();
});
async function track(context: BrowserContext) {
  const cookie = (await context.cookies("http://localhost:4200/api")).find(
    (c) => c.name === "enade_session",
  )!;
  const hash = createHash("sha256").update(cookie.value).digest("hex");
  const id = (
    await pool.query(
      "SELECT identity_id FROM browser_session WHERE token_hash=$1",
      [hash],
    )
  ).rows[0].identity_id;
  owners.add(id);
  return id;
}
async function review(page: Page) {
  await page
    .getByRole("button", { name: "Caderno de erros", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Caderno de erros", exact: true }),
  ).toBeVisible();
}

test("the error notebook supports retry, confirmed correction, filters, reload and mobile keyboard navigation", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Banco de questões", exact: true }),
  ).toBeVisible();
  await track(context);
  await review(page);
  await expect(
    page.getByRole("heading", { name: "Ainda não há respostas salvas" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ir ao banco de questões", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Resolver: Quando uma transação falha",
      exact: true,
    })
    .click();
  await page.getByRole("radio", { name: /Isolamento/ }).check();
  await page
    .getByRole("button", { name: "Confirmar resposta", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Vamos entender este conceito.",
  );
  // A correct answer in another topic makes the filtered empty state meaningful.
  expect(
    (
      await context.request.put("/api/questions/demo-search-v1/answer", {
        data: { optionId: "demo-search-v1-2", baseRevision: 0 },
      })
    ).status(),
  ).toBe(200);
  await review(page);
  await expect(
    page.getByRole("region", { name: "Resumo das respostas salvas" }),
  ).toContainText("de 2 questões distintas");
  await page.getByLabel("Assunto para retomar").selectOption("Algoritmos");
  await page
    .getByRole("button", { name: "Filtrar erros", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Nenhuma questão a retomar neste assunto",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver todos os assuntos", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Tentar novamente: Quando uma transação falha",
      exact: true,
    }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/review-${width}.png`,
      fullPage: true,
    });
  }
  // A failed refresh must not masquerade as an empty notebook.
  await page.route("**/api/review?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Falha temporária do caderno." }),
    }),
  );
  await page
    .getByRole("button", { name: "Atualizar caderno", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Falha temporária");
  await expect(
    page.getByRole("heading", { name: "Ainda não há respostas salvas" }),
  ).toHaveCount(0);
  await page.unroute("**/api/review?**");
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  const retry = page.getByRole("button", {
    name: "Tentar novamente: Quando uma transação falha",
    exact: true,
  });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(page.getByText("RESPOSTA SALVA", { exact: true })).toHaveCount(
    0,
  );
  const correct = page.getByRole("radio", { name: /Atomicidade/ });
  await correct.focus();
  await page.keyboard.press("Space");
  await page.route("**/api/questions/demo-sql-v1/answer", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Falha temporária ao salvar." }),
    }),
  );
  await page
    .getByRole("button", { name: "Confirmar resposta", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Falha temporária ao salvar.",
  );
  await expect(correct).toBeChecked();
  expect((await (await context.request.get("/api/review")).json()).total).toBe(
    1,
  );
  await page.unroute("**/api/questions/demo-sql-v1/answer");
  await page
    .getByRole("button", { name: "Confirmar resposta", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Você acertou.");
  await page
    .getByRole("button", { name: "Voltar ao caderno de erros" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nenhum erro na última resposta salva" }),
  ).toBeVisible();
  await page.reload();
  await review(page);
  await expect(
    page.getByRole("heading", { name: "Nenhum erro na última resposta salva" }),
  ).toBeVisible();
});

test("a shrinking last page returns to an existing page after a confirmed correction", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Banco de questões", exact: true }),
  ).toBeVisible();
  const owner = await track(context),
    client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < 21; i++) {
      const id = `notebook-browser-${randomUUID()}`;
      questions.add(id);
      await client.query(
        "INSERT INTO editorial_question(id,origin) VALUES($1,'AUTHOR_CREATED')",
        [id],
      );
      await client.query(
        "INSERT INTO question_version(id,question_id,title,topic,prompt,origin,editorial_status,explanation,correct_option_id,demonstration,author_credit) VALUES($1,$1,$2,'Paginação sintética','Fixture de teste, sem conteúdo oficial.','AUTHOR_CREATED','DRAFT','Explicação sintética de teste.','a',true,'Fixture de teste')",
        [id, `Fixture caderno ${i + 1}`],
      );
      await client.query(
        "INSERT INTO question_option(question_id,id,text,position) VALUES($1,'a','Correta da fixture',0),($1,'b','Incorreta da fixture',1)",
        [id],
      );
      await client.query(
        "UPDATE question_version SET editorial_status='PUBLISHED' WHERE id=$1",
        [id],
      );
      await client.query(
        "UPDATE editorial_question SET current_version_id=$1 WHERE id=$1",
        [id],
      );
      await client.query(
        "INSERT INTO answer(owner_id,question_id,option_id,revision,updated_at) VALUES($1,$2,'b',1,'2026-01-01'::timestamptz + $3 * interval '1 second')",
        [owner, id, i],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  await review(page);
  await page
    .getByLabel("Assunto para retomar")
    .selectOption("Paginação sintética");
  await page
    .getByRole("button", { name: "Filtrar erros", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Paginação do caderno de erros" }),
  ).toContainText("Página 1 de 2");
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Tentar novamente: Fixture caderno 21",
      exact: true,
    })
    .click();
  await page
    .getByRole("radio", { name: "Correta da fixture", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Confirmar resposta", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Você acertou.");
  await page
    .getByRole("button", { name: "Voltar ao caderno de erros" })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Paginação do caderno de erros" }),
  ).toContainText("Página 1 de 1");
  await expect(page.getByLabel("Assunto para retomar")).toHaveValue(
    "Paginação sintética",
  );
  await expect(
    page.getByRole("button", {
      name: "Tentar novamente: Fixture caderno 21",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("a late review response cannot reveal account history after logout in another tab", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Banco de questões", exact: true }),
  ).toBeVisible();
  await track(context);
  expect(
    (
      await context.request.post("/api/auth/register", {
        data: {
          email: `notebook-${randomUUID()}@example.invalid`,
          password: `test-only-${randomUUID()}`,
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await context.request.put("/api/questions/demo-sql-v1/answer", {
        data: { optionId: "demo-sql-v1-0", baseRevision: 0 },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  const tab = await context.newPage();
  await tab.goto("/");
  let entered!: () => void, release!: () => void;
  const captured = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await tab.route("**/api/review?**", async (route) => {
    const response = await route.fetch();
    entered();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await review(tab);
    await captured;
    await page
      .getByRole("button", { name: "Sair da conta", exact: true })
      .click();
    await expect(
      tab.getByRole("heading", { name: "Banco de questões", exact: true }),
    ).toBeVisible();
    await track(context);
    release();
    await tab.unrouteAll({ behavior: "wait" });
    await expect(
      tab.getByRole("heading", { name: "Caderno de erros", exact: true }),
    ).toHaveCount(0);
    await review(tab);
    await expect(
      tab.getByRole("heading", { name: "Ainda não há respostas salvas" }),
    ).toBeVisible();
    await expect(
      tab.getByRole("button", {
        name: "Tentar novamente: Quando uma transação falha",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    release();
    await tab.close();
  }
});

test("the topic table filters the notebook to one topic with honest counts", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Banco de questões", exact: true }),
  ).toBeVisible();
  await track(context);
  for (const [question, option] of [
    ["demo-network-v1", "demo-network-v1-1"],
    ["demo-search-v1", "demo-search-v1-1"],
  ])
    expect(
      (
        await context.request.put(`/api/questions/${question}/answer`, {
          data: { optionId: option, baseRevision: 0 },
        })
      ).status(),
    ).toBe(200);
  await review(page);
  const table = page.getByRole("table", { name: /por assunto/ });
  await expect(table.getByRole("row", { name: /Redes/ })).toContainText("1");
  await table
    .getByRole("button", { name: "Retomar assunto: Redes", exact: true })
    .click();
  await expect(page.getByLabel("Assunto para retomar")).toHaveValue("Redes");
  await expect(page.locator(".review-list > li")).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Tentar novamente: Entrega confiável de um fluxo",
      exact: true,
    }),
  ).toBeVisible();
});
