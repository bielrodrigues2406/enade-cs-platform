import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { test, expect, type Page } from "@playwright/test";

// Contas TEST ONLY; o primeiro administrador é criado direto no banco, como o
// comando `admin:role` faz no servidor.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const emails: string[] = [];
const password = "Admin teste 2026!";
const email = (label: string) => {
  const value = `${label}-${randomUUID()}@example.invalid`;
  emails.push(value);
  return value;
};

test.afterAll(async () => {
  const ids = (await pool.query("SELECT identity_id FROM account WHERE email=ANY($1)", [emails])).rows.map((r) => r.identity_id);
  await pool.query("DELETE FROM activity_log WHERE subject=ANY($1) OR actor_id=ANY($2::uuid[])", [emails, ids]);
  await pool.query("DELETE FROM role_event WHERE email=ANY($1)", [emails]);
  await pool.query("DELETE FROM role_invitation WHERE email=ANY($1)", [emails]);
  await pool.query("DELETE FROM account_role WHERE identity_id=ANY($1::uuid[])", [ids]);
  await pool.query("DELETE FROM answer WHERE owner_id=ANY($1::uuid[])", [ids]);
  await pool.query("DELETE FROM browser_session WHERE identity_id=ANY($1::uuid[])", [ids]);
  await pool.query("DELETE FROM account WHERE identity_id=ANY($1::uuid[])", [ids]);
  await pool.query("DELETE FROM study_identity WHERE id=ANY($1::uuid[])", [ids]);
  await pool.end();
});

async function register(page: Page, address: string, extra: { name?: string; enrollment?: string } = {}) {
  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta" }).first().click();
  await page.getByLabel("Nome").fill(extra.name ?? "Pessoa Teste");
  if (extra.enrollment) await page.getByLabel("Prontuário IFSP").fill(extra.enrollment);
  await page.getByLabel("E-mail").fill(address);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.locator("form").getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("button", { name: `Meu perfil, ${extra.name ?? "Pessoa Teste"}` })).toBeVisible();
}

test("sign-up takes name and enrollment, and an admin authorizes a professor", async ({ page, browser }) => {
  const adminEmail = email("admin");
  await register(page, adminEmail, { name: "Admin TEST ONLY" });
  await pool.query("INSERT INTO account_role(identity_id,role) SELECT identity_id,'ADMIN' FROM account WHERE email=$1", [adminEmail]);
  await page.reload();
  await page.getByRole("button", { name: "Administração" }).click();
  await expect(page.getByRole("heading", { name: "Administração", level: 1 })).toBeVisible();

  // Autoriza um e-mail que ainda não tem conta: fica aguardando cadastro.
  const professorEmail = email("prof");
  await page.getByRole("textbox", { name: "E-mail" }).fill(professorEmail);
  await page.getByRole("button", { name: "Autorizar" }).click();
  await expect(page.getByRole("status")).toContainText("ainda não tem conta");
  await expect(page.getByRole("region", { name: "Autorizações aguardando cadastro" })).toContainText(professorEmail);

  // A pessoa se cadastra com o prontuário; o papel só vale depois da confirmação.
  const other = await browser.newContext();
  const professor = await other.newPage();
  await register(professor, professorEmail, { name: "Prof TEST ONLY", enrollment: "pe3009999" });
  await other.close();
  await page.reload();
  await page.getByRole("button", { name: "Administração" }).first().click();
  const claims = page.getByRole("region", { name: "Cadastros aguardando sua confirmação" });
  await expect(claims).toContainText("Prof TEST ONLY");
  await expect(claims).toContainText("PE3009999");
  await claims.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("status")).toContainText("agora tem o papel Professor");
  const stored = (await pool.query(
    `SELECT a.enrollment,r.role FROM account a JOIN account_role r ON r.identity_id=a.identity_id WHERE a.email=$1`,
    [professorEmail],
  )).rows;
  expect(stored).toEqual([{ enrollment: "PE3009999", role: "PROFESSOR" }]);

  await page.getByLabel("Buscar contas").fill(professorEmail);
  await page.getByRole("button", { name: "Buscar" }).click();
  const row = page.getByRole("row", { name: new RegExp(professorEmail) });
  await expect(row).toContainText("Professor");
  await expect(row).toContainText("PE3009999");
  await row.getByRole("button", { name: `Remover papel de professor de ${professorEmail}` }).click();
  await expect(page.getByRole("status")).toContainText("removido");
  await expect(row).toContainText("Aluno");
});

test("an admin registers a professor account, who then updates profile and password", async ({ page, browser }) => {
  const adminEmail = email("admin");
  await register(page, adminEmail, { name: "Admin TEST ONLY" });
  await pool.query("INSERT INTO account_role(identity_id,role) SELECT identity_id,'ADMIN' FROM account WHERE email=$1", [adminEmail]);
  await page.reload();
  await page.getByRole("button", { name: "Administração" }).click();

  const professorEmail = email("manual-prof");
  await page.getByRole("button", { name: "Cadastrar conta" }).click();
  const dialog = page.getByRole("dialog", { name: "Cadastrar conta" });
  await expect(dialog).toBeVisible();
  // A senha inicial já vem sugerida; o admin pode trocar.
  await expect(dialog.getByLabel("Senha inicial")).toHaveValue(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
  await dialog.getByLabel("Nome").fill("Prof Manual TEST ONLY");
  await dialog.getByLabel("E-mail").fill(professorEmail);
  await dialog.getByLabel("Papel").selectOption("PROFESSOR");
  await dialog.getByLabel("Senha inicial").fill(password);
  await dialog.getByRole("button", { name: "Cadastrar", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toContainText(`Conta de ${professorEmail} cadastrada com o papel Professor`);

  // E-mail repetido: o modal mostra o erro e continua aberto.
  await page.getByRole("button", { name: "Cadastrar conta" }).click();
  await dialog.getByLabel("Nome").fill("Outra Pessoa TEST ONLY");
  await dialog.getByLabel("E-mail").fill(professorEmail);
  await dialog.getByRole("button", { name: "Cadastrar", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("já tem conta");
  await dialog.getByRole("button", { name: "Cancelar" }).click();

  // O professor entra com a senha inicial, corrige os dados e troca a senha.
  const other = await browser.newContext();
  const professor = await other.newPage();
  expect((await other.request.post("/api/session", { data: {} })).status()).toBe(201);
  await professor.goto("/");
  await professor.getByRole("button", { name: "Entrar" }).first().click();
  await professor.getByLabel("E-mail").fill(professorEmail);
  await professor.getByLabel("Senha", { exact: true }).fill(password);
  await professor.locator("form").getByRole("button", { name: "Entrar" }).click();
  await professor.getByRole("button", { name: "Meu perfil, Prof Manual TEST ONLY" }).click();
  await expect(professor.getByRole("heading", { name: "Meu perfil", level: 1 })).toBeVisible();
  await expect(professor.getByLabel("Nome")).toHaveValue("Prof Manual TEST ONLY");
  await professor.getByLabel("Prontuário IFSP").fill("pe3007777");
  await professor.getByRole("button", { name: "Salvar dados" }).click();
  await expect(professor.getByText("Dados salvos.")).toBeVisible();
  await expect(professor.getByLabel("Prontuário IFSP")).toHaveValue("PE3007777");

  const newPassword = "Nova senha teste 2026!";
  await professor.getByLabel("Senha atual", { exact: true }).fill("errada errada 1");
  await professor.getByLabel("Nova senha", { exact: true }).fill(newPassword);
  await professor.getByLabel("Repita a nova senha").fill(newPassword);
  await professor.getByRole("button", { name: "Trocar senha" }).click();
  await expect(professor.getByText("Senha atual incorreta.")).toBeVisible();
  await professor.getByLabel("Senha atual", { exact: true }).fill(password);
  await professor.getByRole("button", { name: "Trocar senha" }).click();
  await expect(professor.getByText(/Senha trocada/)).toBeVisible();
  await other.close();
  // A nova senha vale num navegador novo.
  const fresh = await browser.newContext();
  expect((await fresh.request.post("/api/session", { data: {} })).status()).toBe(201);
  const login = await fresh.request.post("/api/auth/login", { data: { email: professorEmail, password: newPassword } });
  expect(login.status()).toBe(200);
  await fresh.close();
});

test("the activity tab shows sign-ins and failed passwords, filtered by IP", async ({ page, browser }) => {
  const adminEmail = email("admin-log");
  await register(page, adminEmail, { name: "Admin Log TEST ONLY" });
  await pool.query("INSERT INTO account_role(identity_id,role) SELECT identity_id,'ADMIN' FROM account WHERE email=$1", [adminEmail]);
  // Uma senha errada para a própria conta, de outro navegador.
  const other = await browser.newContext();
  expect((await other.request.post("/api/session", { data: {} })).status()).toBe(201);
  expect((await other.request.post("/api/auth/login", { data: { email: adminEmail, password: "errada errada 2026" } })).status()).toBe(401);
  await other.close();

  await page.reload();
  await page.getByRole("button", { name: "Administração" }).click();
  await page.getByRole("tab", { name: "Atividades" }).click();
  await expect(page.getByRole("definition").first()).toBeVisible();
  await page.getByLabel("E-mail, assunto ou IP").fill(adminEmail);
  await page.getByRole("button", { name: "Filtrar" }).click();
  const table = page.getByRole("table");
  await expect(table).toContainText("Senha errada no login");
  await expect(table).toContainText("Criou conta");
  await page.getByLabel("Categoria").selectOption("ACCESS");
  await expect(table).not.toContainText("Papel concedido");
  const ipButton = table.getByRole("button", { name: /^Ver tudo do IP / }).first();
  const ip = (await ipButton.textContent())!.trim();
  await ipButton.click();
  await expect(page.getByLabel("E-mail, assunto ou IP")).toHaveValue(ip);
  // 10 por página; com mais registros, a paginação mostra as demais.
  await expect(table.locator("tbody tr").first()).toBeVisible();
  expect(await table.locator("tbody tr").count()).toBeLessThanOrEqual(10);
});

test("accounts without the admin role do not see administration", async ({ page }) => {
  await register(page, email("aluno"));
  await expect(page.getByRole("button", { name: "Administração" })).toHaveCount(0);
  expect((await page.request.get("/api/admin/users")).status()).toBe(403);
});

test("account and admin screens reflow without horizontal scrolling", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Criar conta" }).first().click();
    await expect(page.getByLabel("Prontuário IFSP")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `largura ${width}`).toBe(true);
  }
});
