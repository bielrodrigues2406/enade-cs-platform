import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp, db } from "../apps/api/src/main.js";
import { authorize } from "../apps/api/src/roles.js";

// Contas TEST ONLY criadas por este arquivo; a limpeza remove só elas.
let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
const emails = new Set<string>();
const password = "Papel teste 2026!";

before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});
after(async () => {
  const list = [...emails];
  const ids = (await db.query("SELECT identity_id FROM account WHERE email=ANY($1)", [list])).rows.map((r) => r.identity_id);
  await db.query("DELETE FROM role_event WHERE email=ANY($1)", [list]);
  await db.query("DELETE FROM role_invitation WHERE email=ANY($1)", [list]);
  await db.query("DELETE FROM account_role WHERE identity_id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM browser_session WHERE identity_id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM account WHERE identity_id=ANY($1::uuid[])", [ids]);
  await db.query("DELETE FROM study_identity WHERE id=ANY($1::uuid[])", [ids]);
  await app.close();
  await db.end();
});

const email = () => {
  const value = `roles-${randomUUID()}@example.invalid`;
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
async function account(address: string, extra: Record<string, string> = {}) {
  const guest = await fetch(`${base}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const cookie = guest.headers.get("set-cookie")!.split(";")[0];
  const created = await call("auth/register", cookie, "POST", { email: address, password, ...extra });
  return { status: created.status, cookie: created.headers.get("set-cookie")?.split(";")[0] ?? cookie };
}
async function makeAdmin(address: string) {
  const client = await db.connect();
  try {
    await authorize(client, address, "ADMIN", null);
  } finally {
    client.release();
  }
}

test("roles are server-side: accounts without a role see nothing administrative", async () => {
  const plain = await account(email());
  assert.equal(plain.status, 201);
  assert.deepEqual(await (await call("access", plain.cookie)).json(), { roles: [] });
  assert.equal((await call("admin/users", plain.cookie)).status, 403);
  assert.equal((await call("admin/roles", plain.cookie, "POST", { email: email(), role: "PROFESSOR" })).status, 403);
});

test("an admin authorizes professors by e-mail, before or after the account exists, with an audit trail", async () => {
  const adminEmail = email();
  const admin = await account(adminEmail);
  await makeAdmin(adminEmail);
  assert.deepEqual(await (await call("access", admin.cookie)).json(), { roles: ["ADMIN"] });

  const existingEmail = email();
  const existing = await account(existingEmail);
  const now = await call("admin/roles", admin.cookie, "POST", { email: existingEmail, role: "PROFESSOR" });
  assert.deepEqual(await now.json(), { status: "GRANTED" });
  assert.deepEqual(await (await call("access", existing.cookie)).json(), { roles: ["PROFESSOR"] });

  const laterEmail = email();
  const invited = await call("admin/roles", admin.cookie, "POST", { email: laterEmail.toUpperCase(), role: "PROFESSOR" });
  assert.deepEqual(await invited.json(), { status: "INVITED" });
  const later = await account(laterEmail, { name: "  Prof.  TEST ONLY ", enrollment: "pe3012345" });
  assert.equal(later.status, 201);
  assert.deepEqual(await (await call("access", later.cookie)).json(), { roles: ["PROFESSOR"] });
  const stored = (await db.query("SELECT display_name,enrollment FROM account WHERE email=$1", [laterEmail])).rows[0];
  assert.deepEqual(stored, { display_name: "Prof. TEST ONLY", enrollment: "PE3012345" });

  const listing = await (await call(`admin/users?q=${encodeURIComponent(laterEmail)}`, admin.cookie)).json();
  assert.equal(listing.total, 1);
  assert.deepEqual(listing.items[0].roles, ["PROFESSOR"]);

  const removed = await call("admin/roles/revoke", admin.cookie, "POST", { email: laterEmail, role: "PROFESSOR" });
  assert.equal(removed.status, 200);
  assert.deepEqual(await (await call("access", later.cookie)).json(), { roles: [] });
  const events = (await db.query("SELECT action FROM role_event WHERE email=$1 ORDER BY id", [laterEmail])).rows.map((r) => r.action);
  assert.deepEqual(events, ["INVITED", "GRANTED", "REVOKED"]);

  // Um administrador não remove o próprio acesso pela tela.
  assert.equal((await call("admin/roles/revoke", admin.cookie, "POST", { email: adminEmail, role: "ADMIN" })).status, 409);
});

test("profile fields are validated and an enrollment belongs to one account", async () => {
  assert.equal((await account(email(), { enrollment: "12345" })).status, 400);
  assert.equal((await account(email(), { name: "x" })).status, 400);
  const enrollment = `PE${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
  assert.equal((await account(email(), { enrollment })).status, 201);
  assert.equal((await account(email(), { enrollment })).status, 409);
});
