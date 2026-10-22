import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as pollDelay } from "node:timers/promises";
import { createApp, db } from "../apps/api/src/main.js";

let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
const identities = new Set<string>();

before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});

after(async () => {
  // Every ID is captured from a session created by this file, before rotation.
  // Do not remove other development accounts or seeded content.
  if (identities.size) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const ids = [...identities];
      await client.query(
        "DELETE FROM browser_session WHERE identity_id=ANY($1::uuid[])",
        [ids],
      );
      await client.query("DELETE FROM answer WHERE owner_id=ANY($1::uuid[])", [
        ids,
      ]);
      await client.query(
        "DELETE FROM account WHERE identity_id=ANY($1::uuid[])",
        [ids],
      );
      await client.query(
        "DELETE FROM study_identity WHERE id=ANY($1::uuid[])",
        [ids],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  await app.close();
  await db.end();
});

function credentials() {
  return {
    email: `accounts-${randomUUID()}@example.invalid`,
    password: `test-only-${randomUUID()}`,
  };
}

function request(path: string, cookie = "", method = "GET", body?: unknown) {
  return fetch(`${base}/api/${path}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function tokenHash(cookie: string) {
  return createHash("sha256")
    .update(cookie.slice("enade_session=".length))
    .digest("hex");
}

async function issuedCookie(response: Response) {
  const header = response.headers.get("set-cookie");
  assert.ok(header, "a new session cookie must be issued");
  assert.ok(/HttpOnly/i.test(header), "session cookie must be HttpOnly");
  assert.ok(
    /SameSite=Strict/i.test(header),
    "session cookie must use SameSite Strict",
  );
  assert.ok(
    /Path=\/api(?:;|$)/i.test(header),
    "session cookie must be scoped to the API",
  );
  const cookie = header.split(";")[0];
  const row = (
    await db.query<{ identity_id: string }>(
      "SELECT identity_id FROM browser_session WHERE token_hash=$1",
      [tokenHash(cookie)],
    )
  ).rows[0];
  assert.ok(row, "issued session must exist in PostgreSQL");
  identities.add(row.identity_id);
  return cookie;
}

async function guest() {
  const response = await request("session", "", "POST", {});
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { mode: "guest" });
  return issuedCookie(response);
}

async function register(input = credentials(), originalCookie?: string) {
  const original = originalCookie ?? (await guest());
  const response = await request("auth/register", original, "POST", input);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    mode: "account",
    email: input.email.trim().toLowerCase(),
  });
  return { ...input, original, cookie: await issuedCookie(response) };
}

async function readAnswer(cookie: string) {
  const response = await request("questions/demo-sql-v1", cookie);
  assert.equal(response.status, 200);
  return (await response.json()).answer;
}

async function answer(cookie: string, optionId = "demo-sql-v1-1") {
  const response = await request(
    "questions/demo-sql-v1/answer",
    cookie,
    "PUT",
    { optionId, baseRevision: 0 },
  );
  assert.equal(response.status, 200);
  return response.json();
}

test("registration preserves guest answers, normalizes email and rotates the bearer token", async () => {
  const cookie = await guest();
  await answer(cookie);
  const input = credentials();
  const account = await register(
    { ...input, email: `  ${input.email.toUpperCase()}  ` },
    cookie,
  );
  assert.ok(
    account.cookie !== cookie,
    "registration must rotate the anonymous token",
  );
  assert.equal((await request("auth/me", cookie)).status, 401);
  assert.deepEqual(await (await request("auth/me", account.cookie)).json(), {
    mode: "account",
    email: input.email,
  });
  assert.deepEqual(
    await (await request("session", account.cookie, "POST", {})).json(),
    { mode: "account", email: input.email },
  );
  const saved = await readAnswer(account.cookie);
  assert.equal(saved.optionId, "demo-sql-v1-1");
  assert.equal(saved.revision, 1);
  const stored = (
    await db.query<{ password_hash: string }>(
      "SELECT password_hash FROM account WHERE email=$1",
      [input.email],
    )
  ).rows[0];
  assert.ok(
    stored && stored.password_hash !== input.password,
    "the database must contain a hash rather than the password",
  );
  assert.ok(!stored.password_hash.includes(input.password));
});

test("logout revokes access and a fresh login restores only the account history", async () => {
  const account = await register();
  await answer(account.cookie);
  const logout = await request("auth/logout", account.cookie, "POST", {});
  assert.equal(logout.status, 200);
  assert.deepEqual(await logout.json(), { mode: "guest" });
  const loggedOut = await issuedCookie(logout);
  assert.equal((await request("auth/me", account.cookie)).status, 401);
  assert.equal(
    (
      await request("questions/demo-sql-v1/answer", account.cookie, "PUT", {
        optionId: "demo-sql-v1-0",
        baseRevision: 1,
      })
    ).status,
    401,
  );
  assert.equal(await readAnswer(loggedOut), null);
  const freshBrowser = await guest();
  const login = await request("auth/login", freshBrowser, "POST", {
    email: account.email,
    password: account.password,
  });
  assert.equal(login.status, 200);
  const signedIn = await issuedCookie(login);
  assert.equal((await request("auth/me", freshBrowser)).status, 401);
  assert.equal((await readAnswer(signedIn)).optionId, "demo-sql-v1-1");
  assert.equal(await readAnswer(loggedOut), null);
});

test("separate accounts and guest histories remain isolated when signing in", async () => {
  const first = await register();
  const second = await register();
  await answer(first.cookie, "demo-sql-v1-1");
  await answer(second.cookie, "demo-sql-v1-0");
  assert.equal((await readAnswer(first.cookie)).optionId, "demo-sql-v1-1");
  assert.equal((await readAnswer(second.cookie)).optionId, "demo-sql-v1-0");

  const anotherGuest = await guest();
  const network = await request(
    "questions/demo-network-v1/answer",
    anotherGuest,
    "PUT",
    { optionId: "demo-network-v1-3", baseRevision: 0 },
  );
  assert.equal(network.status, 200);
  const login = await request("auth/login", anotherGuest, "POST", {
    email: first.email,
    password: first.password,
  });
  assert.equal(login.status, 200);
  const signedIn = await issuedCookie(login);
  assert.equal((await readAnswer(signedIn)).optionId, "demo-sql-v1-1");
  const networkAfterLogin = await (
    await request("questions/demo-network-v1", signedIn)
  ).json();
  assert.equal(
    networkAfterLogin.answer,
    null,
    "guest answers must not silently merge into an existing account",
  );
});

test("login failure is generic and an authenticated session cannot switch accounts", async () => {
  const account = await register();
  const cookie = await guest();
  const incorrect = await request("auth/login", cookie, "POST", {
    email: account.email,
    password: credentials().password,
  });
  const unknown = await request("auth/login", cookie, "POST", credentials());
  assert.equal(incorrect.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await incorrect.json(), await unknown.json());
  const login = await request("auth/login", cookie, "POST", {
    email: ` ${account.email.toUpperCase()} `,
    password: account.password,
  });
  assert.equal(login.status, 200);
  const signedIn = await issuedCookie(login);
  assert.equal(
    (await request("auth/login", signedIn, "POST", credentials())).status,
    409,
  );
  assert.equal(
    (await request("auth/register", signedIn, "POST", credentials())).status,
    409,
  );
});

test("invalid credentials are rejected before creating an account", async () => {
  const cookie = await guest();
  for (const body of [
    {},
    { email: "invalid", password: credentials().password },
    { email: credentials().email, password: "short" },
    { email: credentials().email, password: "x".repeat(129) },
    { email: [credentials().email], password: credentials().password },
    { email: credentials().email, password: null },
  ])
    assert.equal(
      (await request("auth/register", cookie, "POST", body)).status,
      400,
    );
  assert.deepEqual(await (await request("auth/me", cookie)).json(), {
    mode: "guest",
  });
});

test("concurrent registration of the same email creates exactly one account", async () => {
  const input = credentials();
  const cookies = [await guest(), await guest()];
  const results = await Promise.all(
    cookies.map((cookie) => request("auth/register", cookie, "POST", input)),
  );
  assert.deepEqual(
    results.map((response) => response.status).sort(),
    [201, 409],
  );
  const winner = results.find((response) => response.status === 201)!;
  const signedIn = await issuedCookie(winner);
  assert.deepEqual(await (await request("auth/me", signedIn)).json(), {
    mode: "account",
    email: input.email,
  });
  assert.equal(
    (
      await db.query("SELECT identity_id FROM account WHERE email=$1", [
        input.email,
      ])
    ).rowCount,
    1,
  );
  const loser =
    cookies[results.findIndex((response) => response.status === 409)];
  assert.deepEqual(await (await request("auth/me", loser)).json(), {
    mode: "guest",
  });
});

test("expired tokens do not grant access and session renewal starts a new guest identity", async () => {
  const cookie = await guest();
  await answer(cookie);
  await db.query(
    "UPDATE browser_session SET expires_at=now()-interval '1 minute' WHERE token_hash=$1",
    [tokenHash(cookie)],
  );
  assert.equal((await request("auth/me", cookie)).status, 401);
  assert.equal(
    (
      await request("questions/demo-sql-v1/answer", cookie, "PUT", {
        optionId: "demo-sql-v1-0",
        baseRevision: 1,
      })
    ).status,
    401,
  );
  const renewed = await request("session", cookie, "POST", {});
  assert.equal(renewed.status, 201);
  const freshCookie = await issuedCookie(renewed);
  assert.ok(freshCookie !== cookie, "renewal must issue a new token");
  assert.equal(await readAnswer(freshCookie), null);
});

test("authentication rejects form posts and foreign browser origins", async () => {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "email=invalid&password=invalid",
  });
  assert.equal(response.status, 415);
  const foreign = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://foreign.example",
    },
    body: JSON.stringify(credentials()),
  });
  assert.equal(foreign.status, 403);
});

test(
  "logout is serialized before a queued answer save using the revoked credential",
  { timeout: 30000 },
  async () => {
    const account = await register();
    await answer(account.cookie);
    const locker = await db.connect();
    let lockHeld = false;
    let logoutRequest: Promise<Response> | undefined;
    let saveRequest: Promise<Response> | undefined;

    async function waitForBlockedQuery(
      queryPrefix: string,
      blockerPid: number,
    ) {
      const deadline = performance.now() + 5000;
      do {
        const waiting = await db.query<{ pid: number }>(
          `SELECT pid FROM pg_stat_activity
         WHERE datname=current_database() AND state='active'
           AND wait_event_type='Lock' AND query LIKE $1
           AND $2::integer=ANY(pg_blocking_pids(pid))`,
          [queryPrefix + "%", blockerPid],
        );
        if (waiting.rows.length) return waiting.rows[0].pid;
        // Poll an observable lock condition, rather than guessing how long HTTP takes.
        await pollDelay(10);
      } while (performance.now() < deadline);
      assert.fail(
        "the expected database request did not enter the observed lock queue",
      );
    }

    try {
      await locker.query("BEGIN");
      lockHeld = true;
      const lockerPid = (
        await locker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0].pid;
      const locked = await locker.query(
        "SELECT token_hash FROM browser_session WHERE token_hash=$1 FOR UPDATE",
        [tokenHash(account.cookie)],
      );
      assert.equal(locked.rowCount, 1);

      logoutRequest = fetch(`${base}/api/auth/logout`, {
        method: "POST",
        headers: { Cookie: account.cookie, "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(15000),
      });
      void logoutRequest.catch(() => {});
      const logoutPid = await waitForBlockedQuery(
        "DELETE FROM browser_session WHERE token_hash=$1",
        lockerPid,
      );

      saveRequest = fetch(`${base}/api/questions/demo-sql-v1/answer`, {
        method: "PUT",
        headers: { Cookie: account.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: "demo-sql-v1-0", baseRevision: 1 }),
        signal: AbortSignal.timeout(15000),
      });
      void saveRequest.catch(() => {});
      // The credential SELECT FOR UPDATE must be behind the logout DELETE, not
      // merely in flight. This establishes the serialization order under test.
      await waitForBlockedQuery(
        "SELECT s.identity_id AS id,a.email FROM browser_session",
        logoutPid,
      );
      await locker.query("COMMIT");
      lockHeld = false;

      const [logout, delayedSave] = await Promise.all([
        logoutRequest,
        saveRequest,
      ]);
      assert.equal(logout.status, 200);
      const loggedOut = await issuedCookie(logout);
      assert.equal(delayedSave.status, 401);
      assert.equal((await request("auth/me", account.cookie)).status, 401);

      const login = await request("auth/login", loggedOut, "POST", {
        email: account.email,
        password: account.password,
      });
      assert.equal(login.status, 200);
      const signedIn = await issuedCookie(login);
      const persisted = await readAnswer(signedIn);
      assert.equal(persisted.optionId, "demo-sql-v1-1");
      assert.equal(persisted.revision, 1);
    } finally {
      if (lockHeld) await locker.query("ROLLBACK");
      locker.release();
      // Releasing the lock must precede waiting for HTTP, including assertion
      // failures. Capture the new guest so after() can remove its own fixture.
      const settled = await Promise.allSettled(
        [logoutRequest, saveRequest].filter(
          (pending): pending is Promise<Response> => !!pending,
        ),
      );
      if (
        logoutRequest &&
        settled[0]?.status === "fulfilled" &&
        settled[0].value.status === 200
      ) {
        const header = settled[0].value.headers.get("set-cookie");
        if (header) {
          const row = (
            await db.query<{ identity_id: string }>(
              "SELECT identity_id FROM browser_session WHERE token_hash=$1",
              [tokenHash(header.split(";")[0])],
            )
          ).rows[0];
          if (row) identities.add(row.identity_id);
        }
      }
    }
  },
);

test("repeated login failures are throttled for the same normalized email", async () => {
  const cookie = await guest();
  const input = credentials();
  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal(
      (await request("auth/login", cookie, "POST", input)).status,
      401,
    );
  }
  const throttled = await request("auth/login", cookie, "POST", {
    ...input,
    email: input.email.toUpperCase(),
  });
  assert.equal(throttled.status, 429);
});
