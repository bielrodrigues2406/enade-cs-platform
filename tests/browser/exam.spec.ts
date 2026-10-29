import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// TEST ONLY synthetic content. No real question/source is edited or published.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prefix = `test-only-practice-${randomUUID()}`;
const area = "Compiladores";
const questions = Array.from({ length: 30 }, (_, index) => `${prefix}-${index + 1}`);
const versions = questions.map((id) => `${id}-v1`);
const imageVersion = versions[29];
const sources = [randomUUID(), randomUUID()];
const identities = new Set<string>();
const emails = new Set<string>();
let asset = { sha256: "", file: "", fileCreated: false, rowCreated: false };

async function track(context: BrowserContext) {
  const cookie = (await context.cookies()).find((row) => row.name === "enade_session");
  if (!cookie) return;
  const hash = createHash("sha256").update(cookie.value).digest("hex");
  const row = (await pool.query("SELECT identity_id FROM browser_session WHERE token_hash=$1", [hash])).rows[0];
  if (row) identities.add(row.identity_id);
}
const map = (page: Page) => page.getByRole("navigation", { name: "Questões do treino", exact: true });
const questionButton = (page: Page, position: number) => map(page).getByRole("button", { name: new RegExp(`^Questão ${position},`) });
const saved = (page: Page) => expect(page.getByRole("status")).toContainText("Alterações salvas.");
async function saveAction(page: Page, action: () => Promise<unknown>) {
  const response = page.waitForResponse((row) => row.request().method() === "PUT" && /\/api\/practice\/[^/]+\/items\/[0-9]+$/.test(new URL(row.url()).pathname));
  await action();
  expect((await response).status()).toBe(200);
  await saved(page);
}
async function currentView(page: Page) {
  const id = new URL(page.url()).searchParams.get("attempt");
  expect(id).toBeTruthy();
  const response = await page.request.get(`/api/practice/${id}`);
  expect(response.status()).toBe(200);
  return response.json();
}
async function start(page: Page, size = 10) {
  await page.goto("/treino");
  await expect(page.getByRole("heading", { name: "Treino parcial", exact: true })).toBeVisible();
  await expect(page.getByLabel("Área do treino")).toBeVisible();
  await page.getByLabel("Área do treino").selectOption(area);
  await page.getByRole("radio", { name: `${size} questões`, exact: true }).check();
  const started = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/practice" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Começar treino", exact: true }).click();
  const response = await started;
  expect(response.status()).toBe(201);
  const view = await response.json();
  await expect(map(page)).toBeVisible();
  await expect(page).toHaveURL((url) => url.searchParams.get("attempt") === view.id);
  await expect(page.locator("#practice-position")).toBeFocused();
  return view;
}
function radio(page: Page, item: any, option: string) {
  return page.getByRole("radio", { name: item.question.presentation === "IMAGE" ? `Alternativa ${option}` : `TEST ONLY alternativa ${option}`, exact: true });
}
const correctOption = (item: any) => item.question.id === imageVersion ? "B" : "A";
async function finish(page: Page) {
  await page.getByRole("button", { name: "Revisar e finalizar", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Finalizar este treino?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Finalizar treino", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resultado do treino", exact: true })).toBeVisible();
}

test.beforeAll(async () => {
  const bytes = await readFile("tests/fixtures/test-only-question.webp");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const file = path.join(process.env.QUESTION_ASSET_DIR || path.resolve(".local/question-assets"), sha256.slice(0, 2), `${sha256}.webp`);
  const fileCreated = !(await stat(file).catch(() => null));
  if (fileCreated) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes); }
  asset = { sha256, file, fileCreated, rowCreated: false };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [index, id] of sources.entries()) {
      const kind = index ? "ANSWER_KEY" : "EXAM";
      await client.query(
        `INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,
           status,verification_origin,assisted_verifier,reviewed_at,is_final,key_finality)
         VALUES($1,$2,$3,$4,2021,'TEST ONLY Computação','BACHARELADO',$5,64,2,
           'VERIFIED','ASSISTED','test-only-reviewer',now(),$6,$7)`,
        [id, `TEST ONLY treino ${kind}`, `https://download.inep.gov.br/enade/test-fixtures/${id}.pdf`, kind,
          createHash("sha256").update(`TEST ONLY ${id}`).digest("hex"), !!index, index ? "ONLY_PUBLISHED" : null],
      );
    }
    asset.rowCreated = !!(await client.query(
      "INSERT INTO question_asset(sha256,media_type,byte_size,width,height) VALUES($1,'image/webp',$2,760,240) ON CONFLICT DO NOTHING RETURNING sha256",
      [sha256, bytes.length],
    )).rowCount;
    for (const [index, id] of questions.entries()) {
      const image = index === 29;
      if (image) await client.query("INSERT INTO editorial_question(id,origin,official_exam_id,official_question_number) VALUES($1,'OFFICIAL',$2,1)", [id, sources[0]]);
      else await client.query("INSERT INTO editorial_question(id,origin) VALUES($1,'AUTHOR_CREATED')", [id]);
      await client.query(
        `INSERT INTO question_version(id,question_id,title,topic,prompt,origin,editorial_status,explanation,correct_option_id,
           author_credit,demonstration,explanation_credit,exam_source_id,key_source_id,source_page,source_question_number,key_page,
           presentation,review_origin,assisted_extractor,assisted_reviewer)
         VALUES($1,$2,$3,$4,$5,$6,'DRAFT','TEST ONLY explicação do treino.',$7,$8,$9,$10,$11,$12,$13,$13,$13,$14,$15,$16,$17)`,
        [versions[index], id, `TEST ONLY treino · Questão ${index + 1}`, area, `TEST ONLY enunciado sintético ${index + 1}.`,
          image ? "OFFICIAL" : "AUTHOR_CREATED", image ? "B" : "A", image ? "Inep" : "TEST ONLY demonstração", !image,
          "TEST ONLY explicação", image ? sources[0] : null, image ? sources[1] : null, image ? 1 : null,
          image ? "IMAGE" : "TEXT", image ? "ASSISTED" : "HUMAN", image ? "test-only-extractor" : null, image ? "test-only-reviewer" : null],
      );
      for (const [position, option] of ["A", "B", "C", "D"].entries()) await client.query(
        "INSERT INTO question_option(question_id,id,text,position) VALUES($1,$2,$3,$4)",
        [versions[index], option, `TEST ONLY alternativa ${option}`, position],
      );
      if (image) await client.query(
        "INSERT INTO question_version_image(version_id,position,asset_sha256,source_page,box,dpi) VALUES($1,1,$2,1,'{30,60,410,186}',200)", [versions[index], sha256],
      );
      await client.query("UPDATE question_version SET editorial_status='PUBLISHED',reviewed_at=now() WHERE id=$1", [versions[index]]);
      await client.query("UPDATE editorial_question SET current_version_id=$2 WHERE id=$1", [id, versions[index]]);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
});
test.afterEach(async ({ context }) => { await track(context); });
test.afterAll(async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Attempts are deleted before their pinned versions; only our owners/content.
    await client.query("DELETE FROM practice_attempt WHERE owner_id=ANY($1::uuid[])", [[...identities]]);
    await client.query("DELETE FROM answer WHERE question_id=ANY($1::text[])", [versions]);
    await client.query("DELETE FROM editorial_question WHERE id=ANY($1::text[])", [questions]);
    await client.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])", [sources]);
    for (const id of identities) {
      await client.query("DELETE FROM answer WHERE owner_id=$1", [id]);
      await client.query("DELETE FROM browser_session WHERE identity_id=$1", [id]);
      await client.query("DELETE FROM account WHERE identity_id=$1 AND email=ANY($2::text[])", [id, [...emails]]);
      await client.query("DELETE FROM study_identity WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM account WHERE identity_id=$1)", [id]);
    }
    if (asset.rowCreated) await client.query("DELETE FROM question_asset WHERE sha256=$1 AND NOT EXISTS(SELECT 1 FROM question_version_image WHERE asset_sha256=$1)", [asset.sha256]);
    await client.query("COMMIT");
    if (asset.fileCreated && !(await client.query("SELECT 1 FROM question_version_image WHERE asset_sha256=$1", [asset.sha256])).rowCount) await rm(asset.file, { force: true });
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
});

test("partial practice shows real availability and blocks sizes without enough published content", async ({ page }) => {
  await page.goto("/treino");
  await expect(page.getByRole("radio", { name: "20 questões", exact: true })).toBeChecked();
  await page.getByLabel("Área do treino").selectOption("Segurança");
  for (const size of [10, 20, 30]) await expect(page.getByRole("radio", { name: `${size} questões`, exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Começar treino", exact: true })).toBeDisabled();
  await expect(page.getByText("0 questões publicadas disponíveis nesta seleção.")).toBeVisible();
  await page.getByLabel("Área do treino").selectOption(area);
  await expect(page.getByRole("radio", { name: "30 questões", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Caderno de erros", exact: true }).click();
  await expect(page).toHaveURL(/\/questoes$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Banco de questões", exact: true })).toBeVisible();
});
for (const size of [10, 20, 30]) {
  test(`partial practice pins ${size} distinct items and finalizes with unanswered items`, async ({ page }) => {
    const view = await start(page, size);
    expect(view.items).toHaveLength(size);
    expect(new Set(view.items.map((item: any) => item.question.id)).size).toBe(size);
    expect(view.summary).toBeNull();
    expect(JSON.stringify(view)).not.toContain("correctOptionId");
    await expect(map(page).getByRole("button", { name: /^Questão / })).toHaveCount(size);
    await expect(page.getByText("TEST ONLY explicação do treino.")).toHaveCount(0);
    await finish(page);
    await expect(page.locator(".practice-score")).toContainText(`0 de ${size}`);
    await expect(page.getByText(`0 erradas · ${size} não respondidas.`)).toBeVisible();
    await page.reload();
    await expect(page.locator(".practice-score")).toContainText(`0 de ${size}`);
  });
}

test("answers and review marks resume after reload and final result keeps blanks in its denominator", async ({ page }) => {
  const view = await start(page, 10);
  const first = view.items[0], second = view.items[1];
  await saveAction(page, () => radio(page, first, correctOption(first)).check());
  await saveAction(page, () => page.getByRole("checkbox", { name: "Marcar para revisar", exact: true }).check());
  await questionButton(page, 2).click();
  await saveAction(page, () => radio(page, second, "C").check());
  const url = page.url();
  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(page.locator("#practice-position")).toHaveText("Questão 2 de 10");
  await expect(radio(page, second, "C")).toBeChecked();
  await questionButton(page, 1).click();
  await expect(radio(page, first, correctOption(first))).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Marcar para revisar", exact: true })).toBeChecked();
  const persisted = await currentView(page);
  expect(persisted.summary).toBeNull(); expect(persisted.items[0].answer.marked).toBe(true);
  expect(persisted.items.every((item: any) => item.result === undefined)).toBe(true);
  await page.getByRole("button", { name: "Revisar e finalizar", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Finalizar este treino?" });
  await expect(confirmation).toContainText("2 respondidas · 8 em branco · 1 marcada para revisar.");
  await confirmation.getByRole("button", { name: "Continuar respondendo", exact: true }).click();
  await finish(page);
  await expect(page.locator(".practice-score")).toContainText("1 de 10");
  await expect(page.getByText("1 errada · 8 não respondidas.")).toBeVisible();
  await page.getByRole("button", { name: "Rever respostas", exact: true }).click();
  await expect(page.getByRole("region", { name: "Correção da questão", exact: true })).toContainText("Resposta correta");
  await expect(page.getByRole("radio").first()).toBeDisabled();
  await questionButton(page, 2).click();
  await expect(page.getByRole("region", { name: "Correção da questão", exact: true })).toContainText("Resposta incorreta");
  const notebook = await (await page.request.get("/api/review?topic=&offset=0")).json();
  expect(notebook.summary.answered).toBe(0);
});

test("a lost save acknowledgement stays protected until retry confirms the same operation", async ({ page }) => {
  const view = await start(page, 10), item = view.items[0];
  let loseAcknowledgement = true;
  await page.route(`**/api/practice/${view.id}/items/1`, async (route) => {
    if (!loseAcknowledgement) return route.continue();
    loseAcknowledgement = false;
    const applied = await route.fetch(); expect(applied.status()).toBe(200);
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "TEST ONLY resposta perdida após gravar." }) });
  });
  await radio(page, item, "A").check();
  await expect(page.getByRole("alert")).toContainText("resposta perdida após gravar");
  expect((await currentView(page)).items[0].answer.optionId).toBe("A");
  await expect(page.getByRole("button", { name: "Limpar resposta", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Revisar e finalizar", exact: true })).toBeDisabled();
  await expect(radio(page, item, "B")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Banco de questões", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; })).toBe(true);
  await saveAction(page, () => page.getByRole("button", { name: "Tentar salvar novamente", exact: true }).click());
  expect((await currentView(page)).items[0].answer.revision).toBe(1);
  await saveAction(page, () => page.getByRole("button", { name: "Limpar resposta", exact: true }).click());
  const cleared = (await currentView(page)).items[0].answer;
  expect(cleared.optionId).toBeNull(); expect(cleared.revision).toBe(2);
  await expect(page.getByRole("button", { name: "Revisar e finalizar", exact: true })).toBeEnabled();
  await page.unroute(`**/api/practice/${view.id}/items/1`);
  let loseFinish = true;
  await page.route(`**/api/practice/${view.id}/finish`, async (route) => {
    if (!loseFinish) return route.continue();
    loseFinish = false;
    const applied = await route.fetch(); expect(applied.status()).toBe(200);
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "TEST ONLY confirmação final perdida." }) });
  });
  await page.getByRole("button", { name: "Revisar e finalizar", exact: true }).click();
  await page.getByRole("dialog", { name: "Finalizar este treino?" }).getByRole("button", { name: "Finalizar treino", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("confirmação final perdida");
  expect((await currentView(page)).state).toBe("COMPLETED");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.locator(".practice-score")).toContainText("0 de 10");
  await page.unroute(`**/api/practice/${view.id}/finish`);
});

test("another tab cannot overwrite an old revision and a different visitor cannot open the attempt", async ({ page, context, browser }) => {
  const view = await start(page, 10), item = view.items[0];
  const otherTab = await context.newPage();
  await otherTab.goto(page.url());
  await expect(map(otherTab)).toBeVisible();
  await saveAction(page, () => radio(page, item, "A").check());
  await radio(otherTab, item, "C").check();
  await expect(otherTab.getByRole("alert")).toContainText(/outra|atualiz|reabr|conflito/i);
  await expect(otherTab.getByRole("button", { name: "Limpar resposta", exact: true })).toBeDisabled();
  await expect(otherTab.getByRole("button", { name: "Revisar e finalizar", exact: true })).toBeDisabled();
  await otherTab.getByRole("button", { name: "Reabrir treino", exact: true }).click();
  await otherTab.getByRole("button", { name: "Descartar e reabrir", exact: true }).click();
  await expect(radio(otherTab, item, "A")).toBeChecked();
  await expect(otherTab.getByRole("button", { name: "Revisar e finalizar", exact: true })).toBeEnabled();
  const outsider = await browser.newContext();
  try {
    const tab = await outsider.newPage(); await tab.goto(`/treino?attempt=${view.id}`);
    await expect(tab.getByRole("alert")).toContainText("Treino não encontrado");
    await expect(map(tab)).toHaveCount(0);
    await track(outsider);
  } finally { await outsider.close(); await otherTab.close(); }
});

test("image practice reuses zoom and preserves keyboard and reflow across study widths", async ({ page }) => {
  const view = await start(page, 30);
  const image = view.items.find((item: any) => item.question.id === imageVersion);
  expect(image).toBeTruthy();
  await questionButton(page, image.position).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 320) {
      const sheetMap = map(page).locator("details");
      await expect(sheetMap).toHaveJSProperty("open", false);
      await map(page).locator("summary").focus(); await page.keyboard.press("Enter");
      await expect(sheetMap).toHaveJSProperty("open", true);
      await questionButton(page, image.position).focus(); await page.keyboard.press("Enter");
      await map(page).locator("summary").click();
      await expect(sheetMap).toHaveJSProperty("open", false);
    }
    const sheet = page.getByRole("img", { name: /Questão 1 da prova ENADE 2021/ });
    await expect(sheet).toBeVisible();
    await expect.poll(() => sheet.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(760);
    const enlarge = page.getByRole("button", { name: "Ampliar", exact: true });
    await enlarge.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Questão ampliada", exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(enlarge).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `test-results/practice-image-${width}.png`, fullPage: true });
  }
  await saveAction(page, () => page.getByRole("radio", { name: "Alternativa B", exact: true }).check());
  await finish(page);
  await page.getByRole("button", { name: "Rever respostas", exact: true }).click();
  await questionButton(page, image.position).click();
  await expect(page.getByRole("link", { name: /^Gabarito publicado pelo Inep:/ })).toBeVisible();
  await expect(page.getByText(/O Inep não indicou este gabarito como definitivo/)).toBeVisible();
});

test("registering preserves the guest attempt and logout isolates it from a fresh visitor", async ({ page, context }) => {
  const view = await start(page, 10);
  await track(context);
  const email = `practice-${randomUUID()}@example.invalid`; emails.add(email);
  await page.locator("header").getByRole("button", { name: "Criar conta", exact: true }).click();
  const form = page.locator("app-account form");
  await form.getByLabel("E-mail", { exact: true }).fill(email);
  await form.getByLabel("Senha", { exact: true }).fill("TEST ONLY treino senha 2026!");
  await form.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.locator("header").getByText(email, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retomar treino", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retomar treino", exact: true }).click();
  await expect(page.locator("#practice-position")).toBeFocused();
  await expect(page).toHaveURL((url) => url.searchParams.get("attempt") === view.id);
  await page.locator("header").getByRole("button", { name: "Sair da conta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Treino parcial", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retomar treino", exact: true })).toHaveCount(0);
  await track(context);
});
