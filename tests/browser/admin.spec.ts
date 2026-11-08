import { navigateTo, openProfile } from "./navigation-helpers";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { test, expect, type Page } from "@playwright/test";

// Contas TEST ONLY; o primeiro administrador é criado direto no banco, como o
// comando `admin:role` faz no servidor.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const emails: string[] = [];
const password = "Gestao sintetica 2026!";
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

async function register(page: Page, address: string, extra: { name?: string } = {}) {
  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta" }).first().click();
  await page.getByLabel("Nome").fill(extra.name ?? "Pessoa Teste");
  await page.getByLabel("E-mail").fill(address);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.locator("form").getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("button", { name: `Abrir conta, ${extra.name ?? "Pessoa Teste"}` })).toBeVisible();
}

test("sign-up takes a name without enrollment, and an admin authorizes a professor", async ({ page, browser }) => {
  const adminEmail = email("admin");
  await register(page, adminEmail, { name: "Admin TEST ONLY" });
  await pool.query("INSERT INTO account_role(identity_id,role) SELECT identity_id,'ADMIN' FROM account WHERE email=$1", [adminEmail]);
  await page.reload();
  await navigateTo(page, "Administração");
  await expect(page.getByRole("heading", { name: "Administração", level: 1 })).toBeVisible();

  const tabs = page.getByRole("tab");
  await tabs.first().focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Atividades", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(tabs.first()).toBeFocused();
  await page.getByRole("button", { name: "Cadastrar conta", exact: true }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toBeFocused();
  await page.getByLabel("Nome", { exact: true }).fill("A");
  await page.getByRole("dialog").getByRole("button", { name: "Cadastrar", exact: true }).click();
  await expect(page.getByText("Informe o nome com pelo menos 2 caracteres.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('dialog[aria-labelledby="admin-account-title"]')).toBeHidden();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  // Autoriza um e-mail que ainda não tem conta: fica aguardando cadastro.
  const professorEmail = email("prof");
  await page.getByRole("textbox", { name: "E-mail" }).fill(professorEmail);
  await page.getByRole("button", { name: "Autorizar" }).click();
  await expect(page.getByRole("status")).toContainText("ainda não tem conta");
  await expect(page.getByRole("region", { name: "Autorizações aguardando cadastro" })).toContainText(professorEmail);

  // A pessoa se cadastra; o papel só vale depois da confirmação.
  const other = await browser.newContext();
  const professor = await other.newPage();
  await register(professor, professorEmail, { name: "Prof TEST ONLY" });
  await other.close();
  await page.reload();
  await navigateTo(page, "Administração");
  const claims = page.getByRole("region", { name: "Cadastros aguardando sua confirmação" });
  await expect(claims).toContainText("Prof TEST ONLY");
  await claims.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("status")).toContainText("agora tem o papel Professor");
  const stored = (await pool.query(
    `SELECT a.enrollment,r.role FROM account a JOIN account_role r ON r.identity_id=a.identity_id WHERE a.email=$1`,
    [professorEmail],
  )).rows;
  // O cadastro não pede matrícula desde 08/11.
  expect(stored).toEqual([{ enrollment: null, role: "PROFESSOR" }]);

  await page.getByLabel("Buscar contas").fill(professorEmail);
  await page.getByRole("button", { name: "Buscar" }).click();
  const row = page.getByRole("row", { name: new RegExp(professorEmail) });
  await expect(row).toContainText("Professor");
  await row.getByRole("button", { name: `Remover papel de professor de ${professorEmail}` }).click();
  await expect(page.getByRole("status")).toContainText("removido");
  await expect(row).toContainText("Aluno");
});

test("an admin registers a professor account, who then updates profile and password", async ({ page, browser }) => {
  const adminEmail = email("admin");
  await register(page, adminEmail, { name: "Admin TEST ONLY" });
  await pool.query("INSERT INTO account_role(identity_id,role) SELECT identity_id,'ADMIN' FROM account WHERE email=$1", [adminEmail]);
  await page.reload();
  await navigateTo(page, "Administração");

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
  await openProfile(professor);
  await expect(professor.getByRole("heading", { name: "Meu perfil", level: 1 })).toBeVisible();
  await expect(professor.getByLabel("Nome")).toHaveValue("Prof Manual TEST ONLY");
  await expect(professor.getByLabel("Matrícula")).toHaveCount(0);

  const newPassword = "Nova senha girassol 2026!";
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
  await navigateTo(page, "Administração");
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
  await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(0);
  expect((await page.request.get("/api/admin/users")).status()).toBe(403);
});

test("account and admin screens reflow without horizontal scrolling", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Criar conta" }).first().click();
    await expect(page.getByLabel("Nome")).toBeVisible();
    await expect(page.getByLabel("Matrícula")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `largura ${width}`).toBe(true);
  }
});

test("an admin edits student profile and email, resets password, and revokes active sessions", async ({ page, browser }) => {
  const adminEmail = email("admin-maint");
  await register(page, adminEmail, { name: "Admin Manutencao TEST ONLY" });
  await pool.query("INSERT INTO account_role(identity_id,role) SELECT identity_id,'ADMIN' FROM account WHERE email=$1", [adminEmail]);

  const studentInitialEmail = email("aluno-maint");
  const studentUpdatedEmail = email("aluno-novo");
  const studentCtx = await browser.newContext();
  const studentPage = await studentCtx.newPage();
  await register(studentPage, studentInitialEmail, { name: "Estudante Inicial TEST ONLY" });

  await page.reload();
  await navigateTo(page, "Administração");
  await page.getByLabel("Buscar contas").fill(studentInitialEmail);
  await page.getByRole("button", { name: "Buscar" }).click();

  const row = page.getByRole("row", { name: new RegExp(studentInitialEmail) });
  await row.getByRole("button", { name: `Gerenciar conta de ${studentInitialEmail}` }).click();
  const dialog = page.locator('dialog[aria-labelledby="admin-manage-title"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("1 aparelho conectado.");

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `modal ${width}`).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // Atualiza nome e e-mail (exige senha do admin).
  const profileForm = dialog.locator("form").first();
  await profileForm.getByLabel("Nome").fill("Estudante Corrigido TEST ONLY");
  await profileForm.getByLabel("E-mail").fill(studentUpdatedEmail);
  await expect(profileForm.getByLabel("Sua senha de administrador")).toBeVisible();
  await profileForm.getByLabel("Sua senha de administrador").fill("senha errada 123");
  await profileForm.getByLabel(/Motivo/).fill("Correção solicitada na secretaria");
  await profileForm.getByRole("button", { name: "Salvar dados" }).click();
  await expect(profileForm.getByRole("alert")).toContainText("incorreta");

  await profileForm.getByLabel("Sua senha de administrador").fill(password);
  await profileForm.getByRole("button", { name: "Salvar dados" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toContainText(`Dados da conta de ${studentUpdatedEmail} atualizados.`);

  await page.getByLabel("Buscar contas").fill(studentUpdatedEmail);
  await page.getByRole("button", { name: "Buscar" }).click();
  const updatedRow = page.getByRole("row", { name: new RegExp(studentUpdatedEmail) });
  await expect(updatedRow).toContainText("Estudante Corrigido TEST ONLY");

  // Redefine a senha e encerra a sessão aberta da estudante.
  await updatedRow.getByRole("button", { name: `Gerenciar conta de ${studentUpdatedEmail}` }).click();
  await expect(dialog).toBeVisible();
  const resetSection = dialog.getByRole("region", { name: "Redefinir senha" });
  // A sugestão é gerada ao abrir; o ngModel a escreve no campo de forma assíncrona
  // e o diálogo reaproveita o campo da abertura anterior. Espera essa escrita
  // assentar e então digita uma senha conhecida, sem depender da leitura.
  const tempField = resetSection.getByLabel("Nova senha provisória");
  await expect(tempField).toHaveValue(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done))));
  const tempPassword = "Provisoria sintetica 2026";
  await tempField.fill(tempPassword);
  await expect(tempField).toHaveValue(tempPassword);
  await resetSection.getByLabel("Sua senha de administrador").fill(password);
  await resetSection.getByLabel(/Motivo/).fill("Perdeu a senha");
  await resetSection.getByRole("button", { name: "Redefinir senha" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toContainText(`Senha de ${studentUpdatedEmail} redefinida`);

  // Sessão anterior foi encerrada; login com a senha provisória funciona e pode ser encerrado avulso.
  expect((await studentCtx.request.get("/api/me/profile")).status()).toBe(401);
  await studentCtx.close();

  const freshCtx = await browser.newContext();
  expect((await freshCtx.request.post("/api/session", { data: {} })).status()).toBe(201);
  expect((await freshCtx.request.post("/api/auth/login", { data: { email: studentUpdatedEmail, password: tempPassword } })).status()).toBe(200);

  await page.getByRole("button", { name: "Buscar" }).click();
  await updatedRow.getByRole("button", { name: `Gerenciar conta de ${studentUpdatedEmail}` }).click();
  await expect(dialog).toContainText("1 aparelho conectado.");
  await dialog.getByRole("button", { name: "Encerrar sessões" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toContainText("encerrada(s)");
  expect((await freshCtx.request.get("/api/me/profile")).status()).toBe(401);
  await freshCtx.close();

  // Confere a auditoria antes da exclusão LGPD.
  await page.getByRole("tab", { name: "Atividades" }).click();
  await page.getByLabel("E-mail, assunto ou IP").fill(studentUpdatedEmail);
  await page.getByRole("button", { name: "Filtrar" }).click();
  const logTable = page.getByRole("table");
  await expect(logTable).toContainText("Admin alterou o e-mail");
  await expect(logTable).toContainText("Senha redefinida pelo admin");
  await expect(logTable).toContainText("Sessões encerradas pelo admin");

  // Exclui a conta e os dados de estudo conforme pedido LGPD e confere desidentificação do log.
  await page.getByRole("tab", { name: "Contas" }).click();
  await updatedRow.getByRole("button", { name: `Gerenciar conta de ${studentUpdatedEmail}` }).click();
  const deleteSection = dialog.getByRole("region", { name: "Excluir conta e dados de estudo" });
  await deleteSection.getByLabel(/Digite EXCLUIR/).fill("EXCLUIR");
  await deleteSection.getByLabel("Sua senha de administrador").fill(password);
  await deleteSection.getByLabel(/Motivo/).fill("Solicitação LGPD da estudante");
  await deleteSection.getByRole("button", { name: "Excluir conta e dados" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status")).toContainText(`Conta e dados de estudo de ${studentUpdatedEmail} excluídos.`);
  await expect(page.getByRole("row", { name: new RegExp(studentUpdatedEmail) })).toHaveCount(0);

  await page.getByRole("tab", { name: "Atividades" }).click();
  await page.getByLabel("E-mail, assunto ou IP").fill(adminEmail);
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(logTable).toContainText("Conta excluída pela administração");
  await expect(logTable).not.toContainText(studentUpdatedEmail);
});

