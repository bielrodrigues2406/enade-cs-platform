import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { test, expect } from "@playwright/test";

// Prova TEST ONLY de 2096: objetivas 1 a 21 sem a 5 (as três primeiras de
// Formação Geral) e uma discursiva. Nada real é publicado ou alterado.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prefix = `test-only-edition-${randomUUID()}`;
const numbers = Array.from({ length: 21 }, (_, i) => i + 1).filter((n) => n !== 5);
const [exam, key, standard] = [randomUUID(), randomUUID(), randomUUID()];
const reviewer = randomUUID();
const discursiveId = `discursive-${exam.replace(/-/g, "").slice(0, 12)}-d1`;

test.beforeAll(async () => {
  const bytes = await readFile("tests/fixtures/test-only-question.webp");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const file = path.join(process.env.QUESTION_ASSET_DIR || path.resolve(".local/question-assets"), sha256.slice(0, 2), `${sha256}.webp`);
  if (!(await stat(file).catch(() => null))) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes); }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [id, kind] of [[exam, "EXAM"], [key, "ANSWER_KEY"], [standard, "RESPONSE_STANDARD"]]) await client.query(
      `INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,
         status,verification_origin,assisted_verifier,reviewed_at,is_final,key_finality)
       VALUES($1,$2,$3,$4,2096,'TEST ONLY Computação','BACHARELADO',$5,64,2,'VERIFIED','ASSISTED','test-only-reviewer',now(),$6,$7)`,
      [id, `ENADE 2096 · TEST ONLY ${kind}`, `https://download.inep.gov.br/enade/test-fixtures/${id}.pdf`, kind,
        createHash("sha256").update(`TEST ONLY ${id}`).digest("hex"), kind === "ANSWER_KEY", kind === "ANSWER_KEY" ? "ONLY_PUBLISHED" : null],
    );
    for (const n of numbers) {
      const parent = `${prefix}-${n}`, version = `${parent}-v1`;
      await client.query("INSERT INTO editorial_question(id,origin,official_exam_id,official_question_number) VALUES($1,'OFFICIAL',$2,$3)", [parent, exam, n]);
      await client.query(
        `INSERT INTO question_version(id,question_id,title,topic,prompt,origin,editorial_status,explanation,correct_option_id,
           author_credit,explanation_credit,exam_source_id,key_source_id,source_page,source_question_number,key_page,
           presentation,review_origin,assisted_extractor,assisted_reviewer,reviewed_at)
         VALUES($1,$2,$3,$4,$5,'OFFICIAL','DRAFT','TEST ONLY explicação.','A','Inep','TEST ONLY',$6,$7,1,$8,1,'TEXT','ASSISTED',
           'test-only-extractor','test-only-reviewer',now())`,
        [version, parent, `ENADE 2096 · Questão ${n}`, n <= 3 ? "Formação Geral" : "Redes", `TEST ONLY enunciado ${n}.`, exam, key, n],
      );
      for (const [position, option] of ["A", "B", "C", "D", "E"].entries())
        await client.query("INSERT INTO question_option(question_id,id,text,position) VALUES($1,$2,$3,$4)", [version, option, `TEST ONLY ${option}`, position]);
      await client.query("UPDATE question_version SET editorial_status='PUBLISHED' WHERE id=$1", [version]);
      await client.query("UPDATE editorial_question SET current_version_id=$2 WHERE id=$1", [parent, version]);
    }
    await client.query("INSERT INTO study_identity(id) VALUES($1)", [reviewer]);
    await client.query("INSERT INTO account(identity_id,email,password_hash) VALUES($1,$2,$3)",
      [reviewer, `edition-${reviewer}@example.invalid`, `scrypt$131072$8$1$${"0".repeat(32)}$${"0".repeat(64)}`]);
    await client.query("INSERT INTO question_asset(sha256,media_type,byte_size,width,height) VALUES($1,'image/webp',$2,760,240) ON CONFLICT DO NOTHING", [sha256, bytes.length]);
    await client.query(
      `INSERT INTO discursive_question(id,exam_source_id,standard_source_id,year,modality,number,area,criteria,reviewed_by)
       VALUES($1,$2,$3,2096,'BACHARELADO',1,'Formação Geral','[{"label":null,"points":10}]',$4)`, [discursiveId, exam, standard, reviewer]);
    for (const part of ["PROMPT", "STANDARD"]) await client.query(
      "INSERT INTO discursive_image(question_id,part,position,asset_sha256,source_page,box,dpi) VALUES($1,$2,1,$3,1,'{30,60,410,186}',200)",
      [discursiveId, part, sha256]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
});
test.afterAll(async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owners = (await client.query("SELECT DISTINCT owner_id FROM practice_attempt WHERE exam_source_id=$1", [exam])).rows.map((r) => r.owner_id);
    await client.query("DELETE FROM practice_attempt WHERE exam_source_id=$1", [exam]);
    await client.query("DELETE FROM discursive_question WHERE id=$1", [discursiveId]);
    await client.query("DELETE FROM editorial_question WHERE official_exam_id=$1", [exam]);
    await client.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])", [[exam, key, standard]]);
    await client.query("DELETE FROM account WHERE identity_id=$1", [reviewer]);
    await client.query("DELETE FROM browser_session WHERE identity_id=ANY($1::uuid[])", [[...owners, reviewer]]);
    await client.query("DELETE FROM study_identity WHERE id=ANY($1::uuid[]) AND NOT EXISTS(SELECT 1 FROM account a WHERE a.identity_id=study_identity.id)", [[...owners, reviewer]]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); await pool.end(); }
});

test("a student takes the full edition exam with a countdown, writes the discursive and sees results by block", async ({ page }) => {
  await page.goto("/treino");
  const editions = page.getByRole("region", { name: "Prova completa da edição" });
  const row = editions.getByRole("listitem").filter({ hasText: "ENADE 2096" });
  await expect(row).toContainText("20 objetivas (3 de Formação Geral) · 1 discursiva · falta a 5");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "test-results/edition-setup-1280.png", fullPage: true });
  await row.getByRole("button", { name: "Fazer esta prova" }).click();
  await expect(page.getByRole("group", { name: "Começar a prova de 2096?" })).toContainText("não para se você sair");
  await page.getByRole("button", { name: "Começar agora" }).click();

  await expect(page.getByText("Questão 1 de 20")).toBeVisible();
  await expect(page.locator(".practice-clock time")).toHaveText(/^3:59:\d\d$/);
  const saved = page.waitForResponse((r) => r.url().includes("/items/1") && r.request().method() === "PUT");
  await page.getByRole("radio").first().check();
  expect((await saved).status()).toBe(200);

  // No celular a folha de respostas começa recolhida; a discursiva está nela.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Folha de respostas").click();
  await page.getByRole("button", { name: "Discursiva 1" }).click();
  await expect(page.getByRole("heading", { name: "ENADE 2096 · Discursiva 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar e ver o padrão de resposta" })).toHaveCount(0);
  await page.getByLabel(/Sua resposta para/).fill("TEST ONLY resposta escrita durante a prova.");
  await expect(page.getByText("Rascunho salvo")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/edition-discursive-390.png", fullPage: true });

  await page.getByRole("button", { name: "Revisar e finalizar" }).click();
  await expect(page.getByRole("dialog")).toContainText("As discursivas com texto serão enviadas.");
  await page.getByRole("button", { name: "Finalizar prova" }).click();
  await expect(page.getByRole("heading", { name: "Resultado da prova" })).toBeVisible();
  await expect(page.locator(".practice-blocks")).toContainText("Formação Geral1 de 3");
  await expect(page.locator(".practice-blocks")).toContainText("Componente específico0 de 17");
  await page.screenshot({ path: "test-results/edition-result-390.png", fullPage: true });
  await page.getByRole("button", { name: "Abrir as discursivas" }).click();
  await expect(page.getByRole("button", { name: /ENADE 2096 · Discursiva 1/ })).toContainText("Enviada");
});
