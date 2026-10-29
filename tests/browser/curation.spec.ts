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
const password = "Curadoria teste 2026!";
type Fixtures = {
  provision: (context: BrowserContext, curator?: boolean) => Promise<string>;
  questions: Set<string>;
};
const test = base.extend<Fixtures>({
  questions: async ({}, use) => {
    const questions = new Set<string>();
    await use(questions);
  },
  provision: async ({ questions }, use) => {
    const identityIds = new Set<string>();
    await use(async (context, curator = true) => {
      const session = await context.request.post("/api/session", { data: {} });
      expect(session.status()).toBe(201);
      const email = `curation-${randomUUID()}@example.invalid`;
      const registered = await context.request.post("/api/auth/register", {
        data: { email, password },
      });
      expect(registered.status()).toBe(201);
      const cookie = (await context.cookies("http://localhost:4200/api")).find(
        (cookie) => cookie.name === "enade_session",
      )!;
      const tokenHash = createHash("sha256").update(cookie.value).digest("hex");
      const identityId = (
        await pool.query(
          "SELECT identity_id FROM browser_session WHERE token_hash=$1",
          [tokenHash],
        )
      ).rows[0].identity_id;
      identityIds.add(identityId);
      if (curator)
        await pool.query("INSERT INTO curator_role(identity_id) VALUES($1)", [
          identityId,
        ]);
      return identityId;
    });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const id of questions) {
        await client.query(
          "DELETE FROM answer WHERE question_id IN (SELECT id FROM question_version WHERE question_id=$1)",
          [id],
        );
        await client.query("DELETE FROM editorial_question WHERE id=$1", [id]);
      }
      for (const id of identityIds) {
        await client.query("DELETE FROM answer WHERE owner_id=$1", [id]);
        await client.query("DELETE FROM browser_session WHERE identity_id=$1", [
          id,
        ]);
        await client.query("DELETE FROM curator_role WHERE identity_id=$1", [
          id,
        ]);
        await client.query("DELETE FROM account WHERE identity_id=$1", [id]);
        await client.query("DELETE FROM study_identity WHERE id=$1", [id]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
});
test.afterAll(async () => {
  await pool.end();
});

const content = (title: string) => ({
  title,
  topic: "Matemática discreta",
  authorCredit: "Equipe de teste",
  prompt: "<script>window.editorialProbe = 1</script>\nQuanto é 2 + 2?",
  explanation:
    "A soma de duas unidades com duas unidades resulta em quatro unidades.",
  options: ["2", "3", "4", "5"].map((text, index) => ({
    id: `option-${"abcd"[index]}`,
    text,
  })),
  correctOptionId: "option-c",
});
async function openCuration(page: Page) {
  await page.getByRole("button", { name: "Curadoria", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Curadoria", level: 1 }),
  ).toBeVisible();
}
async function fillDraft(page: Page, values: ReturnType<typeof content>) {
  await page.getByLabel("Título", { exact: true }).fill(values.title);
  await page.getByLabel("Assunto", { exact: true }).fill(values.topic);
  await page
    .getByLabel("Crédito de autoria", { exact: true })
    .fill(values.authorCredit);
  await page.getByLabel("Enunciado", { exact: true }).fill(values.prompt);
  for (const [index, option] of values.options.entries())
    await page
      .getByLabel(`Alternativa ${"ABCD"[index]}`, { exact: true })
      .fill(option.text);
  await page
    .getByRole("radio", {
      name: "Definir alternativa C como correta",
      exact: true,
    })
    .check();
  await page
    .getByLabel("Explicação do gabarito", { exact: true })
    .fill(values.explanation);
}
async function saveDraft(page: Page) {
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/curation/questions"),
  );
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  const saved = await response;
  expect(saved.status()).toBe(201);
  const detail = await saved.json();
  await expect(page.getByRole("status")).toContainText("Rascunho salvo.");
  return detail;
}
async function hasUnloadGuard(page: Page) {
  return page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}
async function publish(page: Page) {
  await page
    .getByRole("checkbox", {
      name: "Conferi o enunciado e as alternativas.",
      exact: true,
    })
    .check();
  await expect(page.getByRole("button", { name: "Banco de questões", exact: true })).toBeDisabled();
  expect(await hasUnloadGuard(page)).toBe(true);
  await page
    .getByRole("checkbox", {
      name: "Conferi o gabarito e a explicação.",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Conferi o crédito de autoria.",
      exact: true,
    })
    .check();
  await page
    .getByLabel("Parecer da revisão")
    .fill("Conteúdo, gabarito e crédito de autoria conferidos nesta revisão.");
  await page
    .getByRole("button", { name: "Publicar versão", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Confirmar publicação desta versão?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar publicação", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Versão publicada.");
  await expect(page.getByRole("button", { name: "Banco de questões", exact: true })).toBeEnabled();
  expect(await hasUnloadGuard(page)).toBe(false);
}

for (const width of [390, 1440]) {
  test(`unsaved authoring is protected until cancelled, discarded or saved at ${width}px`, async ({
    page, context, provision, questions,
  }) => {
    await provision(context);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/questoes");
    await openCuration(page);
    const newDraft = page.getByRole("button", { name: "Nova questão autoral", exact: true });
    const back = page.getByRole("button", { name: "Voltar à fila" });
    const bank = page.getByRole("button", { name: "Banco de questões", exact: true });
    const warning = page.getByRole("region", { name: "Alterações locais", exact: true });

    // A fresh form is clean; changing only the options also needs protection.
    await newDraft.click();
    await expect(bank).toBeEnabled();
    expect(await hasUnloadGuard(page)).toBe(false);
    await back.click();
    await expect(page.getByRole("heading", { name: "Curadoria", exact: true })).toBeFocused();
    await expect(warning).toHaveCount(0);
    await newDraft.click();
    await page.getByRole("button", { name: "Adicionar alternativa", exact: true }).click();
    await expect(bank).toBeDisabled();
    await page.getByRole("button", { name: "Remover alternativa E", exact: true }).click();
    await expect(bank).toBeEnabled();

    const input = content(`TEST ONLY edição protegida ${randomUUID().slice(0, 8)}`);
    await fillDraft(page, input);
    await expect(bank).toBeDisabled();
    expect(await hasUnloadGuard(page)).toBe(true);
    await back.click();
    await expect(warning).toBeVisible();
    await expect(page.locator("#editorial-discard-message")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(warning.getByRole("button", { name: "Continuar editando", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(warning).toHaveCount(0);
    await expect(back).toBeFocused();
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue(input.title);
    await expect(bank).toBeDisabled();

    await back.click();
    await warning.getByRole("button", { name: "Descartar alterações", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Curadoria", exact: true })).toBeFocused();
    await expect(bank).toBeEnabled();
    expect(await hasUnloadGuard(page)).toBe(false);
    await newDraft.click();
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue("");
    await fillDraft(page, input);
    const saved = await saveDraft(page);
    questions.add(saved.questionId);
    await expect(bank).toBeEnabled();
    expect(await hasUnloadGuard(page)).toBe(false);
    await bank.click();
    await expect(page.getByRole("heading", { name: "Banco de questões", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Banco de questões", exact: true })).toBeVisible();
  });
}

test("authoring, independent rejection/publication, version replacement and historical answers form a complete workflow", async ({
  page,
  context,
  browser,
  provision,
  questions,
}) => {
  test.setTimeout(120000);
  await provision(context);
  const reviewerContext = await browser.newContext({
    baseURL: "http://localhost:4200",
  });
  try {
    await provision(reviewerContext);
    const reviewer = await reviewerContext.newPage();
    await page.goto("/questoes");
    await openCuration(page);
    await page
      .getByRole("button", { name: "Nova questão autoral", exact: true })
      .click();
    const title = `Aritmética autoral ${randomUUID().slice(0, 8)}`;
    const input = content(title);
    await fillDraft(page, input);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/curation-editor-${width}.png`,
        fullPage: true,
      });
    }
    await page.route("**/api/curation/questions", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ message: "Não foi possível salvar agora." }),
          })
        : route.continue(),
    );
    await page
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Não foi possível salvar agora.",
    );
    await expect(page.getByLabel("Enunciado", { exact: true })).toHaveValue(
      input.prompt,
    );
    await page.unroute("**/api/curation/questions");
    const first = await saveDraft(page);
    questions.add(first.questionId);
    await page
      .getByRole("button", { name: "Enviar para revisão", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Versão enviada para revisão independente.",
    );
    await expect(
      page.getByText(/Quem criou ou editou esta versão não pode publicá-la/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Publicar versão", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Banco de questões", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toHaveCount(0);

    await reviewer.goto("/questoes");
    await openCuration(reviewer);
    await reviewer
      .getByRole("button", { name: `Abrir: ${title}`, exact: true })
      .click();
    await expect(reviewer.locator(".editorial-text").first()).toHaveText(
      input.prompt,
    );
    expect(
      await reviewer.evaluate(() => (window as any).editorialProbe),
    ).toBeUndefined();
    await reviewer
      .getByLabel("Parecer da revisão")
      .fill(
        "Acrescente uma explicação mais detalhada para o raciocínio apresentado.",
      );
    await expect(reviewer.getByRole("button", { name: "Banco de questões", exact: true })).toBeDisabled();
    expect(await hasUnloadGuard(reviewer)).toBe(true);
    await reviewer
      .getByRole("button", { name: "Devolver para ajustes", exact: true })
      .click();
    await expect(reviewer.getByRole("status")).toContainText(
      "Versão devolvida para ajustes.",
    );
    await expect(reviewer.getByRole("button", { name: "Banco de questões", exact: true })).toBeEnabled();
    expect(await hasUnloadGuard(reviewer)).toBe(false);
    await openCuration(page);
    await page
      .getByRole("button", { name: `Abrir: ${title}`, exact: true })
      .click();
    await expect(page.locator(".editorial-review-note")).toContainText(
      "Acrescente uma explicação",
    );
    await expect(
      page.getByRole("button", { name: "Enviar para revisão", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Explicação do gabarito", { exact: true })
      .fill(
        input.explanation +
          " Ao reunir os dois grupos, contamos quatro unidades ao todo.",
      );
    await page
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Rascunho salvo.");
    await page
      .getByRole("button", { name: "Enviar para revisão", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Versão enviada para revisão independente.",
    );
    await reviewer.getByRole("button", { name: "Voltar à fila" }).click();
    await reviewer
      .getByRole("button", { name: `Abrir: ${title}`, exact: true })
      .click();
    await reviewer.setViewportSize({ width: 320, height: 900 });
    expect(
      await reviewer.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await reviewer.screenshot({
      path: "test-results/curation-review-320.png",
      fullPage: true,
    });
    await publish(reviewer);
    await page
      .getByRole("button", { name: "Banco de questões", exact: true })
      .click();
    const topicFilter = page.getByLabel("Assunto", { exact: true });
    await expect(topicFilter).toContainText("Matemática discreta");
    await topicFilter.selectOption({ label: "Matemática discreta" });
    await page.getByRole("button", { name: "Filtrar", exact: true }).click();
    await expect(page.locator(".question-list > li")).toHaveCount(1);
    await expect(topicFilter).toContainText("Algoritmos");
    await page
      .getByRole("button", { name: `Resolver: ${title}`, exact: true })
      .click();
    await expect(page.locator(".resolution .metadata").first()).toContainText(
      "Autoral",
    );
    await expect(page.locator(".question-credit")).toContainText(
      input.authorCredit,
    );
    await expect(
      page.locator(".resolution .metadata").first(),
    ).not.toContainText("demonstrativa");
    expect(
      await page.evaluate(() => (window as any).editorialProbe),
    ).toBeUndefined();
    await page.getByRole("radio", { name: "4", exact: true }).check();
    await page
      .getByRole("button", { name: "Confirmar resposta", exact: true })
      .click();
    await expect(page.locator(".feedback")).toContainText("Você acertou.");

    await openCuration(page);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/curation-queue-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: `Abrir: ${title}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Preparar nova versão", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "A versão anterior segue publicada.",
    );
    const updatedTitle = title + " atualizada";
    await page.getByLabel("Título", { exact: true }).fill(updatedTitle);
    await page
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Rascunho salvo.");
    await page
      .getByRole("button", { name: "Enviar para revisão", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Versão enviada para revisão independente.",
    );
    await page
      .getByRole("button", { name: "Banco de questões", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: `Revisar: ${title}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: updatedTitle, exact: true }),
    ).toHaveCount(0);
    await reviewer.getByRole("button", { name: "Voltar à fila" }).click();
    await reviewer
      .getByRole("button", { name: `Abrir: ${updatedTitle}`, exact: true })
      .click();
    await publish(reviewer);
    await page
      .getByRole("button", { name: "Banco de questões", exact: true })
      .click();
    await page
      .getByRole("button", { name: `Resolver: ${updatedTitle}`, exact: true })
      .click();
    await expect(page.locator(".resolution .metadata").first()).toContainText(
      "Versão 2",
    );
    await expect(
      page.getByRole("radio", { name: "4", exact: true }),
    ).not.toBeChecked();
    const historical = await context.request.get(`/api/questions/${first.id}`);
    expect(historical.status()).toBe(200);
    expect(await historical.json()).toMatchObject({
      versionNumber: 1,
      answer: { correct: true, optionId: "option-c" },
    });
  } finally {
    await reviewerContext.close();
  }
});

test("editing conflicts preserve local content and explicit reopen reconciles the draft", async ({
  page,
  context,
  provision,
  questions,
}) => {
  await provision(context);
  const created = await context.request.post("/api/curation/questions", {
    data: content(`Conflito ${randomUUID().slice(0, 8)}`),
  });
  expect(created.status()).toBe(201);
  const detail = await created.json();
  questions.add(detail.questionId);
  await page.goto("/questoes");
  await openCuration(page);
  await page
    .getByRole("button", { name: `Abrir: ${detail.title}`, exact: true })
    .click();
  const changed = await context.request.put(
    `/api/curation/versions/${detail.id}`,
    {
      data: {
        ...content("Edição confirmada por outra aba"),
        baseRevision: detail.revision,
      },
    },
  );
  expect(changed.status()).toBe(200);
  await page
    .getByLabel("Título", { exact: true })
    .fill("Meu texto local ainda não salvo");
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("A versão mudou.");
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
    "Meu texto local ainda não salvo",
  );
  await expect(page.getByRole("button", { name: "Banco de questões", exact: true })).toBeDisabled();
  expect(await hasUnloadGuard(page)).toBe(true);
  await page
    .getByRole("button", { name: "Reabrir versão", exact: true })
    .click();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
    "Edição confirmada por outra aba",
  );
  await expect(page.getByRole("button", { name: "Banco de questões", exact: true })).toBeEnabled();
  expect(await hasUnloadGuard(page)).toBe(false);
});

test("curation navigation stays unavailable to an account without the local curator role", async ({
  page,
  context,
  provision,
}) => {
  await provision(context, false);
  await page.goto("/questoes");
  await expect(
    page.getByRole("heading", { name: "Banco de questões", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Curadoria", exact: true }),
  ).toHaveCount(0);
  const queue = await context.request.get("/api/curation/questions");
  expect(queue.status()).toBe(403);
});
