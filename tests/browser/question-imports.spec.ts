import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test";

// These isolated fixtures deliberately contain no official question or PDF.
// Fake documents, accounts and assisted notes exercise the editorial contract.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const archiveDirectory =
  process.env.SOURCE_ARCHIVE_DIR || path.resolve(".local/sources");
type Source = { id: string; sha256: string; file: string };
type Content = {
  title: string;
  topic: string;
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  explanationCredit: string;
  keyPage: number;
};
type Fixtures = {
  fixture: {
    actor: (context: BrowserContext, curator?: boolean) => Promise<string>;
    source: (actor: string, kind: "EXAM" | "ANSWER_KEY") => Promise<Source>;
    item: (exam: Source, key: Source, number?: number) => Promise<{ id: string; content: Content }>;
  };
};
function syntheticPdf(label: string) {
  const stream = `BT /F1 12 Tf 40 720 Td (Synthetic fixture - NOT official content) Tj 0 -20 Td (${label}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n% Synthetic test fixture\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
const test = base.extend<Fixtures>({
  fixture: async ({}, use) => {
    const identities: string[] = [], sources: Source[] = [], items: string[] = [];
    const marker = randomUUID().slice(0, 8);
    await use({
      async actor(context, curator = true) {
        expect((await context.request.post("/api/session", { data: {} })).status()).toBe(201);
        const email = `intake-browser-${randomUUID()}@example.invalid`;
        expect((await context.request.post("/api/auth/register", {
          data: { email, password: "Importação sintética 2026!" },
        })).status()).toBe(201);
        const id = (await pool.query("SELECT identity_id FROM account WHERE email=$1", [email])).rows[0].identity_id;
        identities.push(id);
        if (curator) await pool.query("INSERT INTO curator_role(identity_id) VALUES($1)", [id]);
        return id;
      },
      async source(actor, kind) {
        const id = randomUUID(), bytes = syntheticPdf(id);
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        const file = path.join(archiveDirectory, `${sha256}.pdf`);
        await mkdir(archiveDirectory, { recursive: true });
        await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
        const source = { id, sha256, file };
        sources.push(source);
        await pool.query(
          "INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,imported_by,last_editor_id) VALUES($1,$2,$3,$4,2026,'Ciência da Computação (fixture)','BACHARELADO',$5,$6,1,$7,$7)",
          [id, `${kind} sintético ${marker}`, `https://download.inep.gov.br/enade/test-fixtures/${id}.pdf`, kind, sha256, bytes.length, actor],
        );
        return source;
      },
      async item(exam, key, number = 1) {
        const id = randomUUID();
        const content: Content = {
          title: `Importação sintética ${marker} Q${number}`,
          topic: "Importação de teste",
          prompt: "Fixture sintética: qual alternativa preserva o texto de teste? Não reproduz conteúdo oficial.",
          options: [{ id: "A", text: "Texto preservado da fixture." }, { id: "B", text: "Texto diferente da fixture." }],
          correctOptionId: "A", explanation: "A alternativa A mantém o texto sintético usado neste teste.",
          explanationCredit: "Análise assistida sintética de teste", keyPage: 1,
        };
        const raw = { key: `Q${number}`, kind: "OBJECTIVE", number, status: "revisao-manual", prompt: content.prompt, answer: "A" };
        await pool.query(
          "INSERT INTO question_intake(id,exam_source_id,key_source_id,source_key,question_number,kind,pages,original_raw,extraction,machine_digest,content,assisted_review,flags,state) VALUES($1,$2,$3,$4,$5,'OBJECTIVE',ARRAY[1],$6,'{}',$7,$8,$9,ARRAY['figura'],'HOLD')",
          [id, exam.id, key.id, `Q${number}`, number, raw, createHash("sha256").update(JSON.stringify(raw)).digest("hex"), content,
            { origin: "ASSISTED", humanReviewed: false, author: "Análise assistida de teste", status: "MANUAL_REQUIRED", notes: ["Nota sintética: conferir o documento de teste."], issues: [{ code: "figura", note: "Pendência sintética para testar a conferência." }] }],
        );
        items.push(id);
        return { id, content };
      },
    });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const drafted = (await client.query(
        "SELECT v.question_id FROM question_intake i JOIN question_version v ON v.id=i.drafted_version_id WHERE i.id=ANY($1::uuid[])", [items],
      )).rows;
      await client.query("DELETE FROM question_intake WHERE id=ANY($1::uuid[])", [items]);
      for (const row of drafted) await client.query("DELETE FROM editorial_question WHERE id=$1", [row.question_id]);
      for (const source of sources) await client.query("DELETE FROM source_document WHERE id=$1", [source.id]);
      for (const id of identities) {
        await client.query("DELETE FROM answer WHERE owner_id=$1", [id]);
        await client.query("DELETE FROM browser_session WHERE identity_id=$1", [id]);
        await client.query("DELETE FROM curator_role WHERE identity_id=$1", [id]);
        await client.query("DELETE FROM account WHERE identity_id=$1", [id]);
        await client.query("DELETE FROM study_identity WHERE id=$1", [id]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
      for (const source of sources) await unlink(source.file).catch(err => { if (err.code !== "ENOENT") throw err; });
    }
  },
});
test.afterAll(() => pool.end());

async function openQueue(page: Page) {
  await page.goto("/questoes");
  await page.getByRole("button", { name: "Curadoria", exact: true }).click();
  await page.getByRole("button", { name: "Importação", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Questões importadas", exact: true })).toBeVisible();
}
async function reflow(page: Page, label: string) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/intake-${label}-${width}.png`, fullPage: true });
  }
}

test("intake queue recovers from loading failures and supports filtering, pagination and reflow", async ({ page, context, fixture }) => {
  test.setTimeout(120000);
  const actor = await fixture.actor(context);
  const exam = await fixture.source(actor, "EXAM"), key = await fixture.source(actor, "ANSWER_KEY");
  for (let number = 1; number <= 28; number++) await fixture.item(exam, key, number);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const listRoute = "**/api/curation/imports?*";
  await page.route(listRoute, async route => {
    await gate;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Falha sintética ao carregar a importação." }) });
  });
  await openQueue(page);
  await expect(page.getByRole("status")).toContainText("Carregando questões importadas");
  release();
  await expect(page.getByRole("alert")).toContainText("Falha sintética ao carregar a importação.");
  await page.unroute(listRoute);
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("table", { name: "Questões importadas para conferência" })).toBeVisible();
  const filtered = page.waitForResponse(response => response.url().includes("/api/curation/imports?") && new URL(response.url()).searchParams.get("state") === "HOLD");
  await page.getByRole("combobox", { name: /^Situação/ }).selectOption("HOLD");
  const selection = await (await filtered).json();
  expect(selection.items.length).toBe(25);
  expect(selection.items.every((row: { state: string }) => row.state === "HOLD")).toBe(true);
  const next = page.waitForResponse(response => response.url().includes("/api/curation/imports?") && new URL(response.url()).searchParams.get("offset") === "25");
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  expect((await (await next).json()).offset).toBe(25);
  await expect(page.getByRole("button", { name: "Anterior", exact: true })).toBeEnabled();
  await reflow(page, "queue");
  await page.getByRole("combobox", { name: /^Situação/ }).focus();
  await page.keyboard.press("Tab");
  const refresh = page.getByRole("button", { name: "Atualizar importação", exact: true });
  await expect(refresh).toBeFocused();
  expect(await refresh.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
  // Isolated response fixture checks the empty-state affordance even when the
  // shared development database already contains real imported batches.
  await page.route(listRoute, route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], total: 0, offset: 0, limit: 25, counts: { PENDING: 0, HOLD: 0, DRAFTED: 0 } }) }));
  await refresh.click();
  await expect(page.getByRole("heading", { name: "Nenhuma questão nesta seleção", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver todas as situações", exact: true })).toBeVisible();
});

test("intake preserves local edits on conflicts and creates only a private draft after source conference", async ({ page, context, browser, fixture }) => {
  test.setTimeout(120000);
  const actor = await fixture.actor(context);
  const exam = await fixture.source(actor, "EXAM"), key = await fixture.source(actor, "ANSWER_KEY");
  const item = await fixture.item(exam, key);
  const reviewerContext = await browser.newContext({ baseURL: "http://localhost:4200" });
  const studentContext = await browser.newContext({ baseURL: "http://localhost:4200" });
  try {
    await fixture.actor(reviewerContext);
    await fixture.actor(studentContext, false);
    await openQueue(page);
    await page.getByRole("button", { name: `Conferir: ${item.content.title}`, exact: true }).click();
    await expect(page.getByText("Análise assistida de teste · revisão humana pendente", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Baixar prova arquivada", exact: false })).toHaveAttribute("href", `/api/curation/sources/${exam.id}/file#page=1`);
    await expect(page.getByRole("button", { name: "Criar rascunho editorial", exact: true })).toBeDisabled();
    await reflow(page, "detail");
    const localPrompt = item.content.prompt + " Alteração local que deve ser preservada.";
    await page.getByLabel("Enunciado", { exact: true }).fill(localPrompt);
    await page.getByLabel("Nota da conferência", { exact: false }).fill("Nota local sintética para conferir a preservação do texto.");
    // A second authenticated request wins the CAS before this browser saves.
    expect((await reviewerContext.request.put(`/api/curation/imports/${item.id}`, { data: {
      baseRevision: 1, content: { ...item.content, prompt: item.content.prompt + " Edição concorrente." }, resolvedFlags: [], note: "Nota concorrente sintética de teste.",
    } })).status()).toBe(200);
    await page.getByRole("button", { name: "Salvar conferência", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Seu texto local foi preservado.");
    await expect(page.getByLabel("Enunciado", { exact: true })).toHaveValue(localPrompt);
    await page.getByRole("button", { name: "Recarregar versão salva", exact: true }).click();
    await expect(page.getByText("Há alterações que ainda não foram salvas.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Descartar alterações", exact: true }).click();
    await expect(page.getByLabel("Enunciado", { exact: true })).toHaveValue(item.content.prompt + " Edição concorrente.");
    await page.getByLabel("Conferi e resolvi: Figura ou diagrama precisa de conferência", { exact: true }).check();
    await page.getByLabel("Nota da conferência", { exact: false }).fill("Pendência da fixture sintética conferida; nenhum conteúdo oficial foi usado.");
    await page.getByRole("button", { name: "Salvar conferência", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Conferência salva. A questão continua privada.");
    await expect(page.getByRole("button", { name: "Criar rascunho editorial", exact: true })).toBeDisabled();
    for (const source of [exam, key]) {
      const verified = await reviewerContext.request.post(`/api/curation/sources/${source.id}/review`, { data: {
        baseRevision: 1, decision: "VERIFY", note: "Conferência sintética do PDF de teste por uma segunda conta.",
        checklist: { origin: true, edition: true, integrity: true, final: true },
      } });
      expect(verified.status()).toBe(200);
    }
    await page.getByRole("button", { name: "Voltar à importação", exact: false }).click();
    await page.getByRole("button", { name: `Conferir: ${item.content.title}`, exact: true }).click();
    const promote = page.getByRole("button", { name: "Criar rascunho editorial", exact: true });
    await expect(promote).toBeDisabled();
    await page.getByLabel("Conferi o texto, as alternativas e a resposta com os PDFs arquivados.", { exact: true }).check();
    const promoted = page.waitForResponse(response => response.url().endsWith(`/api/curation/imports/${item.id}/draft`) && response.request().method() === "POST");
    await promote.click();
    const result = await promoted;
    expect(result.status()).toBe(200);
    const draft = await result.json();
    await expect(page.getByRole("status")).toContainText("Rascunho editorial criado.");
    expect((await pool.query("SELECT editorial_status FROM question_version WHERE id=$1", [draft.versionId])).rows[0].editorial_status).toBe("DRAFT");
    expect((await studentContext.request.get(`/api/questions/${draft.versionId}`)).status()).toBe(404);
    expect((await studentContext.request.get(`/api/curation/imports/${item.id}`)).status()).toBe(403);
    const publicRows = await (await studentContext.request.get(`/api/questions?q=${encodeURIComponent(item.content.title)}`)).json();
    expect(publicRows).toEqual([]);
  } finally {
    await reviewerContext.close();
    await studentContext.close();
  }
});
