import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { createApp, db } from "../apps/api/src/main.js";
import { authorize } from "../apps/api/src/roles.js";

const run = promisify(execFile);

// Contas TEST ONLY isoladas; limpeza remove somente os registros deste arquivo.
let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
const emails = new Set<string>();
const adminSecret = "Gestao manutencao 2026!";
const studentSecret = "Estudo inicial 2026!";

before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});

after(async () => {
  const list = [...emails];
  const ids = (await db.query("SELECT identity_id FROM account WHERE email=ANY($1)", [list])).rows.map((r) => r.identity_id);
  await db.query("DELETE FROM answer_event WHERE owner_id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM answer WHERE owner_id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM activity_log WHERE subject=ANY($1) OR actor_id=ANY($2::uuid[])", [list, ids]);
  await db.query("DELETE FROM role_event WHERE email=ANY($1)", [list]);
  await db.query("DELETE FROM role_invitation WHERE email=ANY($1)", [list]);
  await db.query("DELETE FROM account_role WHERE identity_id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM browser_session WHERE identity_id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM account WHERE identity_id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM study_identity WHERE id=ANY($1::uuid[])", [ids]);
  await app.close();
  await db.end();
});

const nextEmail = (prefix = "maint") => {
  const value = `${prefix}-${randomUUID()}@example.invalid`;
  emails.add(value);
  return value;
};

async function call(path: string, cookie: string, method = "GET", body?: unknown) {
  return fetch(`${base}/api/${path}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function register(address: string, password: string, extra: Record<string, string> = {}) {
  const guest = await fetch(`${base}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const guestCookie = guest.headers.get("set-cookie")!.split(";")[0];
  const created = await call("auth/register", guestCookie, "POST", {
    email: address,
    password,
    name: "Pessoa Teste",
    ...extra,
  });
  assert.equal(created.status, 201);
  const cookie = created.headers.get("set-cookie")!.split(";")[0];
  const id = (await db.query<{ id: string }>("SELECT identity_id AS id FROM account WHERE email=$1", [address])).rows[0].id;
  return { id, email: address, cookie };
}

async function login(address: string, password: string) {
  const guest = await fetch(`${base}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const guestCookie = guest.headers.get("set-cookie")!.split(";")[0];
  const res = await call("auth/login", guestCookie, "POST", { email: address, password });
  return { status: res.status, cookie: res.headers.get("set-cookie")?.split(";")[0] ?? guestCookie };
}

async function grantAdmin(address: string) {
  const client = await db.connect();
  try {
    await authorize(client, address, "ADMIN", null);
  } finally {
    client.release();
  }
}

test("non-admin accounts cannot access account maintenance routes", async () => {
  const student = await register(nextEmail("plain"), studentSecret);
  const target = await register(nextEmail("target"), studentSecret);

  assert.equal(
    (await call(`admin/accounts/${target.id}`, student.cookie, "PUT", { name: "Outro Nome", enrollment: "" })).status,
    403,
  );
  assert.equal(
    (await call(`admin/accounts/${target.id}/reset-password`, student.cookie, "POST", {
      newPassword: "Nova senha 2026!",
      adminPassword: studentSecret,
    })).status,
    403,
  );
  assert.equal(
    (await call(`admin/accounts/${target.id}/revoke-sessions`, student.cookie, "POST", {})).status,
    403,
  );
});

test("admin updates student name, enrollment and email with validation, uniqueness and password confirmation", async () => {
  const adminEmail = nextEmail("admin");
  const admin = await register(adminEmail, adminSecret, { name: "Admin TEST ONLY" });
  await grantAdmin(adminEmail);

  const studentEmail = nextEmail("student");
  const student = await register(studentEmail, studentSecret, { name: "Aluna Errada", enrollment: "pe3011111" });
  const other = await register(nextEmail("other"), studentSecret, { enrollment: "pe3022222" });

  // Prontuário duplicado ou inválido falha sem alterar o cadastro.
  assert.equal(
    (await call(`admin/accounts/${student.id}`, admin.cookie, "PUT", {
      name: "Aluna Corrigida",
      enrollment: "PE3022222",
    })).status,
    409,
  );
  assert.equal(
    (await call(`admin/accounts/${student.id}`, admin.cookie, "PUT", {
      name: "A",
      enrollment: "PE3011111",
    })).status,
    400,
  );

  // Correção de nome e prontuário sem trocar o e-mail não exige redigitar senha.
  const fixedProfile = await call(`admin/accounts/${student.id}`, admin.cookie, "PUT", {
    name: "  Aluna   Corrigida  ",
    enrollment: "pe3033333",
  });
  assert.equal(fixedProfile.status, 200);
  assert.deepEqual(await fixedProfile.json(), {
    id: student.id,
    email: studentEmail,
    name: "Aluna Corrigida",
    enrollment: "PE3033333",
  });

  // Trocar e-mail exige a senha atual do administrador e preserva unicidade.
  const correctedEmail = nextEmail("student-fixed");
  assert.equal(
    (await call(`admin/accounts/${student.id}`, admin.cookie, "PUT", {
      name: "Aluna Corrigida",
      enrollment: "PE3033333",
      email: correctedEmail,
      adminPassword: "senha incorreta!",
    })).status,
    403,
  );
  assert.equal(
    (await call(`admin/accounts/${student.id}`, admin.cookie, "PUT", {
      name: "Aluna Corrigida",
      enrollment: "PE3033333",
      email: other.email,
      adminPassword: adminSecret,
    })).status,
    409,
  );

  const emailChanged = await call(`admin/accounts/${student.id}`, admin.cookie, "PUT", {
    name: "Aluna Corrigida",
    enrollment: "PE3033333",
    email: correctedEmail.toUpperCase(),
    adminPassword: adminSecret,
  });
  assert.equal(emailChanged.status, 200);
  assert.deepEqual(await emailChanged.json(), {
    id: student.id,
    email: correctedEmail,
    name: "Aluna Corrigida",
    enrollment: "PE3033333",
  });
  assert.equal((await login(correctedEmail, studentSecret)).status, 200);
});

test("admin resets student password, revokes active sessions and preserves study history without exposing secrets", async () => {
  const adminEmail = nextEmail("admin-reset");
  const admin = await register(adminEmail, adminSecret, { name: "Admin Reset TEST ONLY" });
  await grantAdmin(adminEmail);

  const studentEmail = nextEmail("student-reset");
  const student = await register(studentEmail, studentSecret, { name: "Aluno Reset TEST ONLY" });
  const secondDevice = await login(studentEmail, studentSecret);
  assert.equal(secondDevice.status, 200);

  // Responde uma questão antes da redefinição: o histórico precisa continuar intacto.
  const answered = await call("questions/demo-sql-v1/answer", student.cookie, "PUT", {
    optionId: "demo-sql-v1-1",
    baseRevision: 0,
  });
  assert.equal(answered.status, 200);

  const listedBefore = await (await call(`admin/users?q=${encodeURIComponent(studentEmail)}`, admin.cookie)).json();
  assert.equal(listedBefore.items[0].activeSessions, 2);

  // A senha provisória não pode conter o nome da pessoa cuja conta muda (revisão do Codex, R8).
  assert.equal(
    (await call(`admin/accounts/${student.id}/reset-password`, admin.cookie, "POST", {
      newPassword: "Reset da aluna 2026!", adminPassword: adminSecret,
    })).status,
    400,
  );

  // Senha do admin errada é recusada.
  const tempPassword = "Temp-acesso-2026!";
  assert.equal(
    (await call(`admin/accounts/${student.id}/reset-password`, admin.cookie, "POST", {
      newPassword: tempPassword,
      adminPassword: "errada-admin-1234",
    })).status,
    403,
  );

  const reset = await call(`admin/accounts/${student.id}/reset-password`, admin.cookie, "POST", {
    newPassword: tempPassword,
    adminPassword: adminSecret,
  });
  assert.equal(reset.status, 200);
  assert.deepEqual(await reset.json(), { status: "PASSWORD_RESET", revokedSessions: 2 });

  // As duas sessões antigas e a senha anterior deixam de valer; o histórico segue na nova sessão.
  assert.equal((await call("me/profile", student.cookie)).status, 401);
  assert.equal((await call("me/profile", secondDevice.cookie)).status, 401);
  assert.equal((await login(studentEmail, studentSecret)).status, 401);

  const recovered = await login(studentEmail, tempPassword);
  assert.equal(recovered.status, 200);
  const questionAfter = await (await call("questions/demo-sql-v1", recovered.cookie)).json();
  assert.equal(questionAfter.answer.optionId, "demo-sql-v1-1");

  // Encerramento avulso de sessões sem redefinir a senha.
  const revoked = await call(`admin/accounts/${student.id}/revoke-sessions`, admin.cookie, "POST", {});
  assert.equal(revoked.status, 200);
  assert.deepEqual(await revoked.json(), { status: "REVOKED", revokedSessions: 1 });
  assert.equal((await call("me/profile", recovered.cookie)).status, 401);

  // A senha temporária nunca aparece na trilha de auditoria.
  const activity = await (await call(`admin/activity?q=${encodeURIComponent(studentEmail)}`, admin.cookie)).json();
  const actions = activity.items.map((item: any) => item.action);
  assert.ok(actions.includes("ADMIN_PASSWORD_RESET"));
  assert.ok(actions.includes("SESSIONS_REVOKED"));
  assert.equal(JSON.stringify(activity).includes(tempPassword), false);
});

test("other admin accounts are protected from panel takeover and recover via server CLI", async () => {
  const firstEmail = nextEmail("admin-one");
  const secondEmail = nextEmail("admin-two");
  const first = await register(firstEmail, adminSecret);
  const second = await register(secondEmail, adminSecret);
  await grantAdmin(firstEmail);
  await grantAdmin(secondEmail);

  assert.equal(
    (await call(`admin/accounts/${second.id}`, first.cookie, "PUT", {
      name: "Tentativa Lateral",
      enrollment: "",
    })).status,
    409,
  );
  assert.equal(
    (await call(`admin/accounts/${second.id}/reset-password`, first.cookie, "POST", {
      newPassword: "Outra-senha-gestao-2026!",
      adminPassword: adminSecret,
    })).status,
    409,
  );
  assert.equal(
    (await call(`admin/accounts/${second.id}/revoke-sessions`, first.cookie, "POST", {})).status,
    409,
  );

  // Recuperação legítima pelo comando no servidor funciona inclusive para contas ADMIN.
  const cliSecret = "Servidor-recupera-2026!";
  const { stdout } = await run(
    process.execPath,
    ["--import", "tsx", "scripts/admin-role.ts", "reset-password", secondEmail, cliSecret],
    { cwd: process.cwd(), env: process.env },
  );
  assert.match(stdout, /Senha redefinida/);
  assert.equal((await call("me/profile", second.cookie)).status, 401);
  assert.equal((await login(secondEmail, cliSecret)).status, 200);
});
