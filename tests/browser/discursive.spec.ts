import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { test, expect } from "@playwright/test";
import { signUp } from "./session-helpers";
import { testPdf } from "./pdf-fixture";

// Lote READY sintético (TEST ONLY) com uma discursiva e o padrão de resposta:
// o administrador confere no editor e publica; um aluno responde e se avalia.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const archive = process.env.SOURCE_ARCHIVE_DIR || path.resolve(".local/sources");
const importId = randomUUID();
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const files = { exam: testPdf(randomUUID()), key: testPdf(randomUUID()), standard: testPdf(randomUUID()) };

test.afterAll(async () => {
  const shas = Object.values(files).map(sha);
  const sources = (await pool.query("SELECT id FROM source_document WHERE sha256=ANY($1)", [shas])).rows.map((r) => r.id);
  await pool.query("DELETE FROM discursive_question WHERE exam_source_id=ANY($1::uuid[])", [sources]);
  await pool.query("DELETE FROM exam_import WHERE id=$1", [importId]);
  await pool.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])", [sources]);
  await pool.end();
});

test("an admin confirms a discursive item; a student writes, submits and self-assesses", async ({ page, context, browser }) => {
  await signUp(context);
  const email = (await (await context.request.get("/api/auth/me")).json()).email;
  const admin = (await pool.query("SELECT identity_id FROM account WHERE email=$1", [email])).rows[0].identity_id;
  await pool.query("INSERT INTO account_role(identity_id,role) VALUES($1,'ADMIN')", [admin]);
  await mkdir(archive, { recursive: true });
  for (const file of Object.values(files)) await writeFile(path.join(archive, `${sha(file)}.pdf`), file);
  const sizes = JSON.stringify([{ width: 612, height: 792 }]);
  await pool.query(
    `INSERT INTO exam_import(id,year,modality,exam_url,key_url,standard_url,exam_sha256,key_sha256,standard_sha256,
       page_count,page_sizes,standard_page_sizes,state,created_by)
     VALUES($1,2097,'BACHARELADO','https://download.inep.gov.br/enade/test-only/p.pdf','https://download.inep.gov.br/enade/test-only/g.pdf',
       'https://download.inep.gov.br/enade/test-only/pr.pdf',$2,$3,$4,1,$5,$5,'READY',$6)`,
    [importId, sha(files.exam), sha(files.key), sha(files.standard), sizes, admin],
  );
  await pool.query(
    `INSERT INTO exam_import_item(import_id,question_key,number,kind,boxes,standard_boxes,criteria) VALUES
     ($1,'D3',3,'DISCURSIVE','[{"page":1,"x0":40,"y0":40,"x1":420,"y1":200}]','[{"page":1,"x0":40,"y0":300,"x1":520,"y1":420}]',
      '[{"label":"a","points":5},{"label":"b","points":5}]')`,
    [importId],
  );

  // Conferência no editor: enunciado, padrão de resposta e itens.
  await page.goto("/");
  await page.getByRole("button", { name: "Administração" }).click();
  await page.getByRole("tab", { name: "Importar prova" }).click();
  await page.getByRole("listitem").filter({ hasText: "ENADE 2097" }).getByRole("button", { name: "Abrir" }).click();
  await expect(page.getByRole("tab", { name: "Enunciado na prova (1)" })).toBeVisible();
  await page.getByRole("tab", { name: "Padrão de resposta (1)" }).click();
  await expect(page.getByRole("img", { name: /padrão de resposta/ })).toBeVisible();
  for (const [label, value] of [["Item a)", "4"], ["Item b)", "6"]]) {
    const saved = page.waitForResponse((r) => r.url().includes("/items/D3") && r.request().method() === "PUT");
    await page.getByRole("spinbutton", { name: label }).fill(value);
    await page.getByRole("spinbutton", { name: label }).blur();
    expect((await saved).status()).toBe(200);
  }
  await expect(page.getByText("total 10 de 10 pontos")).toBeVisible();
  await page.getByLabel("Área").selectOption("Teoria da computação");
  await page.getByRole("button", { name: "Confirmar e seguir" }).click();
  await page.getByRole("button", { name: "Publicar 1 confirmadas" }).click();
  await expect(page.getByRole("status")).toContainText("1 questões publicadas");

  // Aluno (visitante): rascunho salvo sozinho, envio, padrão e autoavaliação.
  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await student.setViewportSize({ width: 390, height: 844 });
  await student.goto("/questoes");
  await student.getByRole("button", { name: "Discursivas" }).first().click();
  await student.getByRole("button", { name: /ENADE 2097 · Discursiva 3/ }).click();
  await expect(student.getByRole("heading", { name: "ENADE 2097 · Discursiva 3", level: 1 })).toBeVisible();
  await expect(student.getByRole("heading", { name: "Padrão de resposta" })).toHaveCount(0);
  await student.getByLabel(/Sua resposta para/).fill("TEST ONLY resposta com os dois itens.");
  await expect(student.getByText("Rascunho salvo")).toBeVisible();
  await student.getByRole("button", { name: "Enviar e ver o padrão de resposta" }).click();
  await expect(student.getByRole("heading", { name: "Padrão de resposta" })).toBeVisible();
  await expect(student.getByRole("img", { name: /Padrão de resposta do Inep/ })).toBeVisible();
  await student.getByRole("radiogroup", { name: "Item a)" }).getByRole("radio", { name: "Contemplei", exact: true }).click();
  await student.getByRole("radiogroup", { name: "Item b)" }).getByRole("radio", { name: "Em parte" }).click();
  // a vale 4 (contemplado) e b vale 6 (em parte): 7,0.
  await expect(student.locator(".disc-score strong")).toHaveText("7,0");
  await student.getByRole("button", { name: "Salvar autoavaliação" }).click();
  await expect(student.getByRole("status").filter({ hasText: "Autoavaliação salva" })).toContainText("7,0 de 10");
  for (const width of [320, 390, 1280]) {
    await student.setViewportSize({ width, height: 900 });
    expect(await student.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `largura ${width}`).toBe(true);
    await student.screenshot({ path: `test-results/discursive-${width}.png`, fullPage: true });
  }
  await student.getByRole("button", { name: "← Discursivas" }).click();
  await expect(student.getByRole("button", { name: /ENADE 2097 · Discursiva 3/ })).toContainText("Autoavaliada · 7,0");
  await studentContext.close();
});
