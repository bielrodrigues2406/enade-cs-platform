import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { test, expect, type Page } from "@playwright/test";

// Fixtures sinteticas TEST ONLY. Nao reproduzem provas nem revisoes humanas.
// A busca por marcador exclusivo isola o cenario do acervo de desenvolvimento.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const marker = `TEST ONLY catalog ${randomUUID().slice(0, 8)}`;
const prefix = `test-only-catalog-browser-${randomUUID()}`;
const customTopic = `${marker} assunto especifico`;
const sources = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const questionIds = Array.from({ length: 62 }, (_, index) =>
  `${prefix}-${String(index + 1).padStart(3, "0")}`,
);
const versions = questionIds.map((id) => `${id}-v1`);
const title = (number: number) => `${marker} · ${String(number).padStart(3, "0")}`;
const catalogUrl = (extra: Record<string, string> = {}) =>
  "/questoes?" + new URLSearchParams({ q: marker, ...extra });
const pager = (page: Page) =>
  page.getByRole("navigation", { name: "Paginação do banco de questões" });
const filter = (page: Page) =>
  page.getByRole("button", { name: "Filtrar", exact: true }).click();
const expectList = async (page: Page, count: number) =>
  expect(page.locator(".question-list > li")).toHaveCount(count);

const identities = new Set<string>();
test.afterEach(async ({ context }) => {
  const cookie = (await context.cookies()).find((item) => item.name === "enade_session");
  if (!cookie) return;
  const tokenHash = createHash("sha256").update(cookie.value).digest("hex");
  const row = (await pool.query(
    "SELECT identity_id FROM browser_session WHERE token_hash=$1", [tokenHash],
  )).rows[0];
  if (row) identities.add(row.identity_id);
});

test.beforeAll(async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [index, id] of sources.entries()) {
      const kind = index % 2 === 0 ? "EXAM" : "ANSWER_KEY";
      const year = index < 2 ? 2021 : 2017;
      const sha256 = createHash("sha256").update(`TEST ONLY ${id}`).digest("hex");
      await client.query(
        `INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,
          status,verification_origin,assisted_verifier,reviewed_at,is_final,key_finality)
         VALUES($1,$2,$3,$4,$5,'TEST ONLY Computacao','BACHARELADO',$6,64,2,
          'VERIFIED','ASSISTED','test-only-reviewer',now(),$7,$8)`,
        [id, `${marker} ${kind} ${year}`, `https://download.inep.gov.br/enade/test-fixtures/${id}.pdf`,
          kind, year, sha256, kind === "ANSWER_KEY", kind === "ANSWER_KEY" ? "DECLARED" : null],
      );
    }
    for (const [index, questionId] of questionIds.entries()) {
      const number = index + 1;
      const official = number > 60;
      const sourceIndex = number === 61 ? 0 : 2;
      const topic = number <= 59 ? "Algoritmos" : number === 60 ? customTopic : number === 61 ? "Redes" : "Matemática";
      const versionId = versions[index];
      if (official) {
        await client.query(
          "INSERT INTO editorial_question(id,origin,official_exam_id,official_question_number) VALUES($1,'OFFICIAL',$2,1)",
          [questionId, sources[sourceIndex]],
        );
        await client.query(
          `INSERT INTO question_version(id,question_id,title,topic,prompt,origin,editorial_status,explanation,
            correct_option_id,author_credit,explanation_credit,exam_source_id,key_source_id,source_page,
            source_question_number,key_page,review_origin,assisted_extractor,assisted_reviewer)
           VALUES($1,$2,$3,$4,'TEST ONLY enunciado sintetico.','OFFICIAL','DRAFT','TEST ONLY explicacao.',
            'A','Inep','TEST ONLY explicacao',$5,$6,1,1,1,'ASSISTED','test-only-extractor','test-only-reviewer')`,
          [versionId, questionId, title(number), topic, sources[sourceIndex], sources[sourceIndex + 1]],
        );
      } else {
        await client.query("INSERT INTO editorial_question(id,origin) VALUES($1,'AUTHOR_CREATED')", [questionId]);
        await client.query(
          `INSERT INTO question_version(id,question_id,title,topic,prompt,origin,editorial_status,explanation,
            correct_option_id,author_credit,demonstration)
           VALUES($1,$2,$3,$4,'TEST ONLY enunciado sintetico.','AUTHOR_CREATED','DRAFT',
            'TEST ONLY explicacao.','A','TEST ONLY demonstracao',true)`,
          [versionId, questionId, title(number), topic],
        );
      }
      for (const [position, id] of ["A", "B", "C", "D"].entries()) {
        await client.query("INSERT INTO question_option(question_id,id,text,position) VALUES($1,$2,$3,$4)",
          [versionId, id, `TEST ONLY alternativa ${id}`, position]);
      }
      await client.query("UPDATE question_version SET editorial_status='PUBLISHED',reviewed_at=now() WHERE id=$1", [versionId]);
      await client.query("UPDATE editorial_question SET current_version_id=$2 WHERE id=$1", [questionId, versionId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

test.afterAll(async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM answer WHERE question_id=ANY($1::text[])", [versions]);
    await client.query("DELETE FROM editorial_question WHERE id=ANY($1::text[])", [questionIds]);
    await client.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])", [sources]);
    for (const identity of identities) {
      await client.query("DELETE FROM answer WHERE owner_id=$1", [identity]);
      await client.query("DELETE FROM browser_session WHERE identity_id=$1", [identity]);
      await client.query("DELETE FROM study_identity WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM account WHERE identity_id=$1)", [identity]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});

test("catalog reaches beyond 50 and restores its selection through URL and browser history", async ({ page }) => {
  await page.goto(catalogUrl());
  await expectList(page, 20);
  await expect(page.locator(".list-heading")).toContainText("62");
  await expect(pager(page)).toContainText("Página 1 de 4");
  await expect(page.getByLabel("Assunto", { exact: true }).locator("option", { hasText: customTopic })).toHaveCount(1);
  await expect(page.getByLabel("Ano da prova").locator('option[value="2021"]')).toHaveCount(1);
  for (let number = 2; number <= 4; number++) {
    if (number === 4) await page.getByLabel("Buscar no caderno").fill("TEST ONLY filtro ainda não aplicado");
    await pager(page).getByRole("button", { name: "Próxima", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(pager(page)).toContainText(`Página ${number} de 4`);
  }
  await expectList(page, 2);
  await expect(page.getByLabel("Buscar no caderno")).toHaveValue(marker);
  await expect(page.getByRole("heading", { name: title(62), exact: true })).toBeVisible();
  await expect(pager(page).getByRole("button", { name: "Próxima", exact: true })).toBeDisabled();
  expect(new URL(page.url()).searchParams.get("page")).toBe("4");
  await page.reload();
  await expect(pager(page)).toContainText("Página 4 de 4");
  await expect(page.getByLabel("Buscar no caderno")).toHaveValue(marker);
  await page.goBack();
  await expect(pager(page)).toContainText("Página 3 de 4");
  await page.goForward();
  await expect(pager(page)).toContainText("Página 4 de 4");
  await page.getByLabel("Assunto", { exact: true }).selectOption(customTopic);
  await filter(page);
  await expectList(page, 1);
  await expect(page.getByRole("heading", { name: title(60), exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await page.reload();
  await expect(page.getByLabel("Assunto", { exact: true })).toHaveValue(customTopic);
  await expectList(page, 1);
});

test("area and year filters preserve explicit classification and recover from an empty selection", async ({ page }) => {
  await page.goto(catalogUrl());
  await expectList(page, 20);
  await page.getByLabel("Área", { exact: true }).selectOption("unclassified");
  await filter(page);
  await expectList(page, 1);
  await expect(page.getByRole("heading", { name: title(60), exact: true })).toBeVisible();
  await page.getByLabel("Área", { exact: true }).selectOption("Redes");
  await page.getByLabel("Ano da prova").selectOption("2021");
  await filter(page);
  await expectList(page, 1);
  await expect(page.getByRole("heading", { name: title(61), exact: true })).toBeVisible();
  await expect(page.locator(".question-list")).toContainText("2021");
  await page.reload();
  await expect(page.getByLabel("Área", { exact: true })).toHaveValue("Redes");
  await expect(page.getByLabel("Ano da prova")).toHaveValue("2021");
  await page.getByLabel("Ano da prova").selectOption("2017");
  await filter(page);
  await expect(page.getByRole("heading", { name: "Nenhuma questão nesta seleção" })).toBeVisible();
  // Year and topic options come from the whole published collection, even at zero results.
  await expect(page.getByLabel("Ano da prova").locator('option[value="2021"]')).toHaveCount(1);
  await expect(page.getByLabel("Assunto", { exact: true }).locator("option", { hasText: customTopic })).toHaveCount(1);
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(page.getByLabel("Área", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Ano da prova")).toHaveValue("");
  await expect(page).toHaveURL(/\/questoes$/);
  await expect(page.locator(".question-list > li").first()).toBeVisible();
});

test("saved answer returns to its page and next question crosses the page boundary", async ({ page }) => {
  await page.goto(catalogUrl());
  await expectList(page, 20);
  await page.getByRole("button", { name: `Resolver: ${title(20)}`, exact: true }).click();
  await expect(page.locator(".resolution-position")).toContainText("Questão 20 de 62");
  await page.getByRole("radio", { name: "TEST ONLY alternativa A", exact: true }).check();
  await page.getByRole("button", { name: "Confirmar resposta", exact: true }).click();
  await expect(page.locator(".feedback")).toContainText("RESPOSTA SALVA");
  // A failed question request at the boundary must retain the previous page,
  // question and saved feedback, so a retry cannot silently skip an item.
  const nextQuestionRoute = `**/api/questions/${versions[20]}`;
  await page.route(nextQuestionRoute, route => route.fulfill({
    status: 503, contentType: "application/json",
    body: JSON.stringify({ message: "TEST ONLY falha ao abrir a próxima questão." }),
  }));
  await page.getByRole("button", { name: /Próxima questão/ }).click();
  await expect(page.getByRole("alert")).toContainText("falha ao abrir");
  await expect(page.getByRole("heading", { name: title(20), exact: true })).toBeVisible();
  await expect(page.locator(".resolution-position")).toContainText("Questão 20 de 62");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await page.unroute(nextQuestionRoute);
  await page.getByRole("button", { name: /Próxima questão/ }).click();
  await expect(page.getByRole("heading", { name: title(21), exact: true })).toBeVisible();
  await expect(page.locator(".resolution-position")).toContainText("Questão 21 de 62");
  expect(new URL(page.url()).searchParams.get("page")).toBe("2");
  await page.getByRole("button", { name: "← Voltar ao banco", exact: true }).click();
  await expect(pager(page)).toContainText("Página 2 de 4");
  await expect(page.locator(".catalog-progress")).toContainText("1");
  await expect(page.locator(".catalog-progress")).toContainText("62");
  await page.reload();
  await expect(pager(page)).toContainText("Página 2 de 4");
  await pager(page).getByRole("button", { name: "Anterior", exact: true }).click();
  await page.getByRole("button", { name: `Revisar: ${title(20)}`, exact: true }).click();
  await expect(page.getByRole("radio", { name: "TEST ONLY alternativa A", exact: true })).toBeChecked();
});

test("catalog failure can retry without dropping the applied filters or page", async ({ page }) => {
  await page.goto(catalogUrl({ page: "2" }));
  await expect(pager(page)).toContainText("Página 2 de 4");
  let failNext = true;
  await page.route("**/api/catalog?**", async (route) => {
    if (!failNext) return route.continue();
    failNext = false;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "TEST ONLY falha temporária. Tente novamente." }) });
  });
  await pager(page).getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("falha temporária");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(pager(page)).toContainText("Página 3 de 4");
  await expect(page.getByLabel("Buscar no caderno")).toHaveValue(marker);
  expect(new URL(page.url()).searchParams.get("page")).toBe("3");
  await page.unroute("**/api/catalog?**");
});

test("catalog filters and pagination reflow and remain keyboard operable", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(catalogUrl({ page: "4" }));
    await expect(pager(page)).toContainText("Página 4 de 4");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await pager(page).getByRole("button", { name: "Anterior", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(pager(page)).toContainText("Página 3 de 4");
    await page.getByLabel("Área", { exact: true }).focus();
    await expect(page.getByLabel("Área", { exact: true })).toBeFocused();
    // Native focus scrolls the viewport; reset it before a full-page capture
    // so the sticky header does not overlap the title in the screenshot.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `test-results/catalog-paginated-${width}.png`, fullPage: true });
  }
});

test("home counts the full collection and suggests an unanswered item beyond the first page", async ({ page, context }) => {
  await page.goto("/questoes");
  await expectList(page, 20);
  const response = await context.request.get("/api/catalog?limit=50");
  expect(response.status()).toBe(200);
  const before = await response.json();
  expect(before.total).toBeGreaterThan(50);
  expect(before.items.length).toBeGreaterThan(20);
  const next = before.items[20];
  // Answers belong only to this test's anonymous identity. Source questions,
  // including the three existing demos, are never edited or republished.
  for (const row of before.items.slice(0, 20)) {
    const detailResponse = await context.request.get(`/api/questions/${encodeURIComponent(row.id)}`);
    expect(detailResponse.status()).toBe(200);
    const detail = await detailResponse.json();
    const saved = await context.request.put(`/api/questions/${encodeURIComponent(row.id)}/answer`, {
      data: { optionId: detail.options[0].id, baseRevision: detail.answer?.revision ?? 0 },
    });
    expect(saved.status()).toBe(200);
  }
  const updatedResponse = await context.request.get("/api/catalog?limit=20");
  expect(updatedResponse.status()).toBe(200);
  const updated = await updatedResponse.json();
  expect(updated.summary.total).toBe(before.total);
  expect(updated.summary.answered).toBe(20);
  expect(updated.suggestions[0].id).toBe(next.id);

  await page.goto(catalogUrl({ area: "Algoritmos", page: "2" }));
  await expect(pager(page)).toContainText("Página 2 de 3");
  const selectionUrl = page.url();
  await page.getByRole("button", { name: "Início", exact: true }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".cover-summary")).toContainText(`Você respondeu 20 de ${before.total} questões`);
  await expect(page.getByRole("region", { name: "Seu andamento" }).locator(".bar-row").first()).toContainText(`20 de ${before.total}`);
  await expect(page.getByRole("button", { name: `Continuar com: ${next.title}`, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Resolver: ${next.title}`, exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Banco de questões", exact: true }).first().click();
  await expect(page).toHaveURL(selectionUrl);
  await expect(pager(page)).toContainText("Página 2 de 3");
  await page.reload();
  await expect(page).toHaveURL(selectionUrl);
  await expect(page.getByLabel("Área", { exact: true })).toHaveValue("Algoritmos");
  await expect(page.getByLabel("Buscar no caderno")).toHaveValue(marker);
  await expect(pager(page)).toContainText("Página 2 de 3");
  await page.getByRole("button", { name: "Início", exact: true }).first().click();
  await page.getByRole("button", { name: `Continuar com: ${next.title}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: next.title, exact: true })).toBeVisible();
});
