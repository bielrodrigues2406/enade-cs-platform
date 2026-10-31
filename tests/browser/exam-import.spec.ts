import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { test, expect } from "@playwright/test";
import { signUp } from "./session-helpers";
import { testPdf as pdf } from "./pdf-fixture";

// Lote READY sintético (TEST ONLY), como se o processo de extração tivesse
// terminado; o teste exercita o editor de caixas e a publicação.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const archive = process.env.SOURCE_ARCHIVE_DIR || path.resolve(".local/sources");
const importId = randomUUID();
let examSha = "";

test.afterAll(async () => {
  const sources = (await pool.query("SELECT id FROM source_document WHERE sha256=$1 OR title LIKE 'ENADE 2098%'", [examSha])).rows.map((r) => r.id);
  await pool.query("DELETE FROM editorial_question WHERE official_exam_id=ANY($1::uuid[])", [sources]);
  await pool.query("DELETE FROM exam_import WHERE id=$1", [importId]);
  await pool.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])", [sources]);
  await pool.end();
});

test("an admin adjusts a proposed box, classifies and publishes the question", async ({ page, context }) => {
  await signUp(context);
  const email = (await (await context.request.get("/api/auth/me")).json()).email;
  const admin = (await pool.query("SELECT identity_id FROM account WHERE email=$1", [email])).rows[0].identity_id;
  await pool.query("INSERT INTO account_role(identity_id,role) VALUES($1,'ADMIN')", [admin]);
  const exam = pdf(randomUUID()), key = pdf(randomUUID());
  examSha = createHash("sha256").update(exam).digest("hex");
  const keySha = createHash("sha256").update(key).digest("hex");
  await mkdir(archive, { recursive: true });
  await writeFile(path.join(archive, `${examSha}.pdf`), exam);
  await writeFile(path.join(archive, `${keySha}.pdf`), key);
  await pool.query(
    `INSERT INTO exam_import(id,year,modality,exam_url,key_url,exam_sha256,key_sha256,page_count,page_sizes,state,created_by)
     VALUES($1,2098,'BACHARELADO','https://download.inep.gov.br/enade/test-only/p.pdf','https://download.inep.gov.br/enade/test-only/g.pdf',$2,$3,1,$4,'READY',$5)`,
    [importId, examSha, keySha, JSON.stringify([{ width: 612, height: 792 }]), admin],
  );
  await pool.query(
    `INSERT INTO exam_import_item(import_id,question_key,number,kind,answer,key_answer,boxes,warnings) VALUES
     ($1,'Q1',1,'OBJECTIVE','C','C','[{"page":1,"x0":40,"y0":40,"x1":400,"y1":160}]','{"Tem figura: confira se a caixa pega a figura inteira."}')`,
    [importId],
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Administração" }).click();
  await page.getByRole("tab", { name: "Importar prova" }).click();
  await page.getByRole("listitem").filter({ hasText: "ENADE 2098" }).getByRole("button", { name: "Abrir" }).click();
  await expect(page.getByText("Tem figura: confira se a caixa pega a figura inteira.")).toBeVisible();
  const box = page.getByRole("group", { name: /Caixa 1 da questão 1/ });
  await expect(box).toBeVisible();
  // Teclado: seta move a caixa; a gravação acontece a cada ajuste.
  await box.focus();
  const saved = page.waitForResponse((r) => r.url().includes(`/api/imports/${importId}/items/Q1`) && r.request().method() === "PUT");
  await page.keyboard.press("ArrowRight");
  expect((await saved).status()).toBe(200);
  const stored = (await pool.query("SELECT boxes FROM exam_import_item WHERE import_id=$1", [importId])).rows[0].boxes;
  expect(stored[0].x0).toBe(42);

  await page.getByLabel("Área").selectOption("Redes");
  await page.getByRole("button", { name: "Confirmar e seguir" }).click();
  await expect(page.getByText(/1 confirmadas · 0 a conferir/)).toBeVisible();
  await page.getByRole("button", { name: "Publicar 1 confirmadas" }).click();
  await expect(page.getByRole("status")).toContainText("1 questões publicadas");
  const version = (await pool.query(
    "SELECT review_origin,correct_option_id,topic FROM question_version WHERE question_id=$1", [`official-${examSha.slice(0, 12)}-q1`],
  )).rows[0];
  expect(version).toEqual({ review_origin: "IMPORT", correct_option_id: "C", topic: "Redes" });
});
