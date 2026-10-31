import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as pollDelay } from "node:timers/promises";
import { createApp, db } from "../apps/api/src/main.js";

type Actor = { cookie: string; identityId: string };
type AccountActor = Actor & { email: string; password: string };
type Content = {
  title: string;
  topic: string;
  prompt: string;
  authorCredit: string;
  explanation: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
};
type Version = Content & {
  id: string;
  questionId: string;
  editorialStatus: "DRAFT" | "IN_REVIEW" | "REJECTED" | "PUBLISHED";
  revision: number;
  sequence: number;
  currentVersionId: string | null;
  canReview: boolean;
  isAuthor: boolean;
  origin: string;
  reviewNote: string | null;
};
let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
let author: AccountActor;
let reviewer: AccountActor;
let student: AccountActor;
let guest: Actor;
const identities = new Set<string>();
const questionIds = new Set<string>();

function request(path: string, cookie = "", method = "GET", body?: unknown) {
  return fetch(`${base}/api/${path}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
}

async function actor(response: Response): Promise<Actor> {
  const header = response.headers.get("set-cookie");
  assert.ok(header, "the test session must be issued by the server");
  const cookie = header.split(";")[0];
  const tokenHash = createHash("sha256")
    .update(cookie.slice("enade_session=".length))
    .digest("hex");
  const identity = (
    await db.query<{ identity_id: string }>(
      "SELECT identity_id FROM browser_session WHERE token_hash=$1",
      [tokenHash],
    )
  ).rows[0];
  assert.ok(identity, "a test session must have a persisted identity");
  identities.add(identity.identity_id);
  return { cookie, identityId: identity.identity_id };
}

async function createGuest() {
  const response = await request("session", "", "POST", {});
  assert.equal(response.status, 201);
  return actor(response);
}

async function createAccount(extra: Record<string, unknown> = {}) {
  const original = await createGuest();
  const email = `curation-${randomUUID()}@example.invalid`;
  const password = `test-only-${randomUUID()}`;
  const response = await request("auth/register", original.cookie, "POST", {
    email,
    password,
    name: "Pessoa Teste",
    ...extra,
  });
  assert.equal(response.status, 201);
  return { ...(await actor(response)), email, password };
}

before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  author = await createAccount();
  reviewer = await createAccount();
  // Unknown public signup fields must not confer administrative privileges.
  student = await createAccount({ role: "CURATOR", canCurate: true });
  guest = await createGuest();
  await db.query("INSERT INTO curator_role(identity_id) VALUES($1),($2)", [
    author.identityId,
    reviewer.identityId,
  ]);
});

after(async () => {
  try {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      if (questionIds.size) {
        const ids = [...questionIds];
        await client.query(
          "DELETE FROM answer WHERE question_id IN (SELECT id FROM question_version WHERE question_id=ANY($1::text[]))",
          [ids],
        );
        // Whole-parent deletion is the supported maintenance cleanup path; it
        // cascades only this file's versions/options/events, including published ones.
        await client.query(
          "DELETE FROM editorial_question WHERE id=ANY($1::text[])",
          [ids],
        );
      }
      if (identities.size) {
        const ids = [...identities];
        await client.query(
          "DELETE FROM answer WHERE owner_id=ANY($1::uuid[])",
          [ids],
        );
        await client.query(
          "DELETE FROM browser_session WHERE identity_id=ANY($1::uuid[])",
          [ids],
        );
        await client.query(
          "DELETE FROM curator_role WHERE identity_id=ANY($1::uuid[])",
          [ids],
        );
        await client.query(
          "DELETE FROM account WHERE identity_id=ANY($1::uuid[])",
          [ids],
        );
        await client.query(
          "DELETE FROM study_identity WHERE id=ANY($1::uuid[])",
          [ids],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await app?.close();
    await db.end();
  }
});

function content(override: Partial<Content> = {}): Content {
  return {
    title: `Questão autoral de integração ${randomUUID()}`,
    topic: "Algoritmos",
    prompt:
      "Um vetor ordenado é pesquisado descartando metade do intervalo a cada comparação. Qual expressão descreve o crescimento do número de comparações?",
    authorCredit: "Equipe de testes — questão autoral de integração",
    explanation:
      "Reduzir o intervalo pela metade a cada etapa resulta em crescimento logarítmico no pior caso. Conteúdo autoral usado somente neste teste.",
    options: [
      { id: "choice-a", text: "Crescimento logarítmico." },
      { id: "choice-b", text: "Crescimento quadrático." },
    ],
    correctOptionId: "choice-a",
    ...override,
  };
}

async function createQuestion(input = content(), as = author) {
  const response = await request(
    "curation/questions",
    as.cookie,
    "POST",
    input,
  );
  if (response.status === 201) {
    const version = (await response.json()) as Version;
    questionIds.add(version.questionId);
    return version;
  }
  assert.equal(response.status, 201);
  throw new Error("the editorial fixture could not be created");
}

async function detail(versionId: string, as = author) {
  const response = await request(`curation/versions/${versionId}`, as.cookie);
  assert.equal(response.status, 200);
  return response.json() as Promise<Version>;
}

function editable(version: Version, override: Partial<Content> = {}): Content {
  return {
    title: version.title,
    topic: version.topic,
    prompt: version.prompt,
    authorCredit: version.authorCredit,
    explanation: version.explanation,
    options: version.options,
    correctOptionId: version.correctOptionId,
    ...override,
  };
}

async function submit(version: Version, as = author) {
  const response = await request(
    `curation/versions/${version.id}/submit`,
    as.cookie,
    "POST",
    { baseRevision: version.revision },
  );
  assert.equal(response.status, 200);
  return response.json() as Promise<Version>;
}

function reviewBody(version: Version, decision = "PUBLISH") {
  return {
    baseRevision: version.revision,
    decision,
    note: "Conteúdo, alternativa e crédito conferidos nesta revisão de teste.",
    ...(decision === "PUBLISH"
      ? { checklist: { content: true, answer: true, credit: true } }
      : {}),
  };
}

async function publish(version: Version) {
  const submitted = await submit(version);
  const response = await request(
    `curation/versions/${version.id}/review`,
    reviewer.cookie,
    "POST",
    reviewBody(submitted),
  );
  assert.equal(response.status, 200);
  return response.json() as Promise<Version>;
}

async function catalogFor(title: string) {
  const response = await request(
    "questions?" + new URLSearchParams({ q: title }),
    student.cookie,
  );
  assert.equal(response.status, 200);
  return response.json() as Promise<
    Array<{
      id: string;
      answered: boolean;
      origin: string;
      versionNumber: number;
    }>
  >;
}

test("editorial access is granted only through an existing account's curator role", async () => {
  for (const as of [guest, student]) {
    assert.deepEqual(
      await (await request("curation/access", as.cookie)).json(),
      { canCurate: false },
    );
    assert.equal((await request("curation/questions", as.cookie)).status, 403);
    const response = await request(
      "curation/questions",
      as.cookie,
      "POST",
      content(),
    );
    if (response.status === 201)
      questionIds.add((await response.json()).questionId);
    assert.equal(response.status, 403);
  }
  assert.equal((await request("curation/questions")).status, 401);
  assert.deepEqual(
    await (await request("curation/access", author.cookie)).json(),
    { canCurate: true },
  );
  assert.equal(
    (
      await db.query(
        "SELECT identity_id FROM curator_role WHERE identity_id=$1",
        [student.identityId],
      )
    ).rowCount,
    0,
  );
});

test("drafts remain private and publication requires a curator independent of the author and editor", async () => {
  const draft = await createQuestion();
  assert.equal(draft.editorialStatus, "DRAFT");
  assert.equal(draft.sequence, 1);
  assert.equal(draft.revision, 1);
  assert.equal(draft.origin, "AUTHOR_CREATED");
  assert.equal((await detail(draft.id)).isAuthor, true);
  assert.equal(
    (await request(`questions/${draft.id}`, student.cookie)).status,
    404,
  );
  assert.deepEqual(await catalogFor(draft.title), []);
  const pending = await submit(draft);
  assert.equal(pending.editorialStatus, "IN_REVIEW");
  assert.equal((await detail(draft.id, reviewer)).canReview, true);
  assert.equal((await detail(draft.id)).canReview, false);
  assert.equal(
    (
      await request(
        `curation/versions/${draft.id}/review`,
        author.cookie,
        "POST",
        reviewBody(pending),
      )
    ).status,
    403,
  );
  assert.equal(
    (await request(`questions/${draft.id}`, student.cookie)).status,
    404,
  );
  const response = await request(
    `curation/versions/${draft.id}/review`,
    reviewer.cookie,
    "POST",
    reviewBody(pending),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).editorialStatus, "PUBLISHED");
  assert.deepEqual(
    (await catalogFor(draft.title)).map((row) => row.id),
    [draft.id],
  );
  const publicResponse = await request(`questions/${draft.id}`, student.cookie);
  assert.equal(publicResponse.status, 200);
  const publicVersion = await publicResponse.json();
  assert.equal(publicVersion.origin, "AUTHOR_CREATED");
  assert.equal(publicVersion.authorCredit, draft.authorCredit);
  assert.equal(publicVersion.correctOptionId, undefined);
  assert.equal(publicVersion.explanation, undefined);

  const editedByReviewer = await createQuestion();
  const edit = await request(
    `curation/versions/${editedByReviewer.id}`,
    reviewer.cookie,
    "PUT",
    {
      ...editable(editedByReviewer, {
        prompt: "Uma redação autoral revisada pelo segundo curador.",
      }),
      baseRevision: editedByReviewer.revision,
    },
  );
  assert.equal(edit.status, 200);
  const submitted = await submit(await edit.json());
  for (const as of [author, reviewer]) {
    assert.equal(
      (
        await request(
          `curation/versions/${submitted.id}/review`,
          as.cookie,
          "POST",
          reviewBody(submitted),
        )
      ).status,
      403,
    );
  }
});

test("rejected content is editable with revision checks and must pass a new review", async () => {
  const original = await createQuestion();
  const pending = await submit(original);
  const rejection = await request(
    `curation/versions/${pending.id}/review`,
    reviewer.cookie,
    "POST",
    reviewBody(pending, "REJECT"),
  );
  assert.equal(rejection.status, 200);
  const rejected = (await rejection.json()) as Version;
  assert.equal(rejected.editorialStatus, "REJECTED");
  assert.ok(rejected.reviewNote && rejected.reviewNote.length >= 10);
  const body = {
    ...editable(rejected, {
      explanation:
        "Explicação autoral ajustada após a revisão, preservando o caráter de integração deste conteúdo.",
    }),
    baseRevision: rejected.revision,
  };
  const update = await request(
    `curation/versions/${rejected.id}`,
    author.cookie,
    "PUT",
    body,
  );
  assert.equal(update.status, 200);
  const edited = (await update.json()) as Version;
  assert.equal(edited.editorialStatus, "DRAFT");
  assert.equal(edited.revision, rejected.revision + 1);
  assert.equal(
    (
      await request(
        `curation/versions/${rejected.id}`,
        author.cookie,
        "PUT",
        body,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        `curation/versions/${rejected.id}/review`,
        reviewer.cookie,
        "POST",
        reviewBody(edited),
      )
    ).status,
    409,
  );
  const published = await publish(edited);
  assert.equal(published.editorialStatus, "PUBLISHED");
  assert.equal(
    (
      await request(`curation/versions/${published.id}`, author.cookie, "PUT", {
        ...editable(published),
        baseRevision: published.revision,
      })
    ).status,
    409,
  );
});

test("a newer draft never replaces the published pointer or rewrites historical feedback", async () => {
  const first = await publish(await createQuestion());
  const saved = await request(
    `questions/${first.id}/answer`,
    student.cookie,
    "PUT",
    { optionId: "choice-a", baseRevision: 0 },
  );
  assert.equal(saved.status, 200);
  const firstFeedback = await saved.json();
  assert.equal(firstFeedback.correct, true);
  const cloneResponse = await request(
    `curation/questions/${first.questionId}/versions`,
    author.cookie,
    "POST",
    { baseCurrentVersionId: first.id },
  );
  assert.equal(cloneResponse.status, 201);
  const clone = (await cloneResponse.json()) as Version;
  assert.equal(clone.sequence, 2);
  assert.equal(clone.editorialStatus, "DRAFT");
  assert.equal(clone.currentVersionId, first.id);
  assert.equal(
    (
      await request(
        `curation/questions/${first.questionId}/versions`,
        author.cookie,
        "POST",
        { baseCurrentVersionId: first.id },
      )
    ).status,
    409,
  );
  const update = await request(
    `curation/versions/${clone.id}`,
    author.cookie,
    "PUT",
    {
      ...editable(clone, {
        correctOptionId: "choice-b",
        explanation:
          "Explicação autoral diferente na segunda versão, usada para verificar preservação do histórico.",
      }),
      baseRevision: clone.revision,
    },
  );
  assert.equal(update.status, 200);
  const pending = await submit(await update.json());
  assert.deepEqual(
    (await catalogFor(first.title)).map((row) => row.id),
    [first.id],
  );
  assert.equal(
    (await request(`questions/${clone.id}`, student.cookie)).status,
    404,
  );
  const review = await request(
    `curation/versions/${pending.id}/review`,
    reviewer.cookie,
    "POST",
    reviewBody(pending),
  );
  assert.equal(review.status, 200);
  const current = (await review.json()) as Version;
  assert.equal(current.currentVersionId, clone.id);
  const catalog = await catalogFor(first.title);
  assert.deepEqual(
    catalog.map((row) => row.id),
    [clone.id],
  );
  assert.equal(catalog[0].versionNumber, 2);
  assert.equal(catalog[0].answered, false);
  const oldVersion = await (
    await request(`questions/${first.id}`, student.cookie)
  ).json();
  assert.deepEqual(oldVersion.answer, firstFeedback);
  assert.equal(oldVersion.answer.correctOptionId, "choice-a");
  assert.equal(
    (await (await request(`questions/${clone.id}`, student.cookie)).json())
      .answer,
    null,
  );
  assert.equal(
    (
      await request(
        `curation/questions/${first.questionId}/versions`,
        author.cookie,
        "POST",
        { baseCurrentVersionId: first.id },
      )
    ).status,
    409,
  );
});

test("concurrent review has one audit event and published content is immutable in PostgreSQL", async () => {
  const pending = await submit(await createQuestion());
  // Independent session rows avoid obtaining a false concurrency guarantee from
  // the credential lock. The parent/version lock must serialize these reviews.
  const anotherBrowser = await createGuest();
  const login = await request("auth/login", anotherBrowser.cookie, "POST", {
    email: reviewer.email,
    password: reviewer.password,
  });
  assert.equal(login.status, 200);
  const secondSession = await actor(login);
  const beforeCount = Number(
    (
      await db.query(
        "SELECT count(*) AS count FROM editorial_event WHERE version_id=$1",
        [pending.id],
      )
    ).rows[0].count,
  );
  const results = await Promise.all(
    [reviewer, secondSession].map((as) =>
      request(
        `curation/versions/${pending.id}/review`,
        as.cookie,
        "POST",
        reviewBody(pending),
      ),
    ),
  );
  assert.deepEqual(
    results.map((response) => response.status).sort(),
    [200, 409],
  );
  const afterCount = Number(
    (
      await db.query(
        "SELECT count(*) AS count FROM editorial_event WHERE version_id=$1",
        [pending.id],
      )
    ).rows[0].count,
  );
  assert.equal(afterCount, beforeCount + 1);
  const immutable = (error: unknown) =>
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23514";
  await assert.rejects(
    db.query(
      "UPDATE question_version SET prompt='Alteração proibida' WHERE id=$1",
      [pending.id],
    ),
    immutable,
  );
  await assert.rejects(
    db.query(
      "UPDATE question_option SET text='Alteração proibida' WHERE question_id=$1 AND id='choice-b'",
      [pending.id],
    ),
    immutable,
  );
  await assert.rejects(
    db.query(
      "DELETE FROM question_option WHERE question_id=$1 AND id='choice-b'",
      [pending.id],
    ),
    immutable,
  );
  assert.equal((await detail(pending.id)).prompt, pending.prompt);
});

test(
  "an option insert waiting behind publication cannot mutate the newly published version",
  { timeout: 30000 },
  async () => {
    const pending = await submit(await createQuestion());
    const publisher = await db.connect();
    const inserter = await db.connect();
    let publisherTransaction = false;
    let inserterTransaction = false;
    let insertion: Promise<unknown> | undefined;
    try {
      await publisher.query("BEGIN");
      publisherTransaction = true;
      const publisherPid = (
        await publisher.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0].pid;
      await publisher.query(
        "SELECT id FROM question_version WHERE id=$1 FOR UPDATE",
        [pending.id],
      );
      await inserter.query("BEGIN");
      inserterTransaction = true;
      await inserter.query("SET LOCAL statement_timeout='10s'");
      const inserterPid = (
        await inserter.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0].pid;
      insertion = inserter.query(
        "INSERT INTO question_option(question_id,id,text,position) VALUES($1,'late-choice','Alternativa autoral concorrente de integração.',99)",
        [pending.id],
      );
      void insertion.catch(() => {});

      const deadline = performance.now() + 5000;
      let observedWait = false;
      do {
        const waiting = (
          await db.query<{ waiting: boolean }>(
            "SELECT state='active' AND wait_event_type='Lock' AND $2::integer=ANY(pg_blocking_pids(pid)) AS waiting FROM pg_stat_activity WHERE pid=$1",
            [inserterPid, publisherPid],
          )
        ).rows[0];
        if (waiting?.waiting) {
          observedWait = true;
          break;
        }
        await pollDelay(10);
      } while (performance.now() < deadline);
      assert.ok(
        observedWait,
        "the option insert must be waiting on the publisher's version lock",
      );

      // This is a direct PostgreSQL invariant test. The publication metadata meets
      // the same independent-review constraint as the HTTP review workflow.
      await publisher.query(
        "UPDATE question_version SET editorial_status='PUBLISHED',reviewed_by=$2,reviewed_at=clock_timestamp(),editorial_revision=editorial_revision+1 WHERE id=$1",
        [pending.id, reviewer.identityId],
      );
      await publisher.query(
        "UPDATE editorial_question SET current_version_id=$2 WHERE id=$1",
        [pending.questionId, pending.id],
      );
      await publisher.query("COMMIT");
      publisherTransaction = false;
      await assert.rejects(
        insertion,
        (error) =>
          !!error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23514",
      );
      assert.equal(
        (
          await db.query(
            "SELECT id FROM question_option WHERE question_id=$1 AND id='late-choice'",
            [pending.id],
          )
        ).rowCount,
        0,
      );
    } finally {
      // Unlock publication before settling the blocked INSERT on either path.
      if (publisherTransaction) await publisher.query("ROLLBACK");
      await Promise.allSettled(insertion ? [insertion] : []);
      if (inserterTransaction) await inserter.query("ROLLBACK");
      publisher.release();
      inserter.release();
      await db.query("DELETE FROM editorial_question WHERE id=$1", [
        pending.questionId,
      ]);
      questionIds.delete(pending.questionId);
    }
  },
);

test("editorial validation rejects invalid contracts and unsupported official origins", async () => {
  const large = content({
    prompt: "á".repeat(6000),
    explanation: "ç".repeat(4000),
    authorCredit: "ã".repeat(160),
    options: Array.from({ length: 5 }, (_, i) => ({
      id: `choice-${i}`,
      text: "é".repeat(1000),
    })),
    correctOptionId: "choice-0",
  });
  const size = Buffer.byteLength(JSON.stringify(large));
  assert.ok(
    size > 16 * 1024 && size < 64 * 1024,
    "the valid accented fixture must exercise the larger editorial body allowance",
  );
  const largeDraft = await createQuestion(large);
  assert.equal(largeDraft.prompt, large.prompt);
  assert.equal(largeDraft.explanation, large.explanation);
  assert.deepEqual(largeDraft.options, large.options);
  const overLimit = await request(
    "curation/questions",
    author.cookie,
    "POST",
    content({ prompt: "á".repeat(40000) }),
  );
  assert.equal(overLimit.status, 413);
  const valid = content();
  const invalid = [
    { ...valid, title: "" },
    { ...valid, topic: "x".repeat(81) },
    { ...valid, prompt: "x".repeat(6001) },
    { ...valid, explanation: "x".repeat(4001) },
    { ...valid, authorCredit: "x".repeat(161) },
    { ...valid, options: valid.options.slice(0, 1) },
    {
      ...valid,
      options: Array.from({ length: 6 }, (_, i) => ({
        id: `choice-${i}`,
        text: "Alternativa de teste.",
      })),
    },
    { ...valid, options: [valid.options[0], valid.options[0]] },
    {
      ...valid,
      options: [
        { id: "unsafe id", text: "Alternativa de teste." },
        valid.options[1],
      ],
    },
    { ...valid, correctOptionId: "missing-option" },
    { ...valid, origin: "OFFICIAL" },
  ];
  for (const body of invalid) {
    const response = await request(
      "curation/questions",
      author.cookie,
      "POST",
      body,
    );
    if (response.status === 201)
      questionIds.add((await response.json()).questionId);
    assert.equal(response.status, 400);
  }
  const pending = await submit(await createQuestion());
  assert.equal(
    (
      await request(
        `curation/versions/${pending.id}/review`,
        reviewer.cookie,
        "POST",
        { ...reviewBody(pending), note: "curto" },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `curation/versions/${pending.id}/review`,
        reviewer.cookie,
        "POST",
        {
          ...reviewBody(pending),
          checklist: { content: true, answer: false, credit: true },
        },
      )
    ).status,
    400,
  );
  assert.equal((await detail(pending.id)).editorialStatus, "IN_REVIEW");
});

test("role revocation and session expiry are checked before editorial mutations", async () => {
  const pending = await submit(await createQuestion());
  await db.query("DELETE FROM curator_role WHERE identity_id=$1", [
    reviewer.identityId,
  ]);
  try {
    assert.deepEqual(
      await (await request("curation/access", reviewer.cookie)).json(),
      { canCurate: false },
    );
    assert.equal(
      (
        await request(
          `curation/versions/${pending.id}/review`,
          reviewer.cookie,
          "POST",
          reviewBody(pending),
        )
      ).status,
      403,
    );
  } finally {
    await db.query(
      "INSERT INTO curator_role(identity_id) VALUES($1) ON CONFLICT DO NOTHING",
      [reviewer.identityId],
    );
  }
  const tokenHash = createHash("sha256")
    .update(reviewer.cookie.slice("enade_session=".length))
    .digest("hex");
  const original = (
    await db.query<{ expires_at: Date }>(
      "SELECT expires_at FROM browser_session WHERE token_hash=$1",
      [tokenHash],
    )
  ).rows[0];
  await db.query(
    "UPDATE browser_session SET expires_at=now()-interval '1 minute' WHERE token_hash=$1",
    [tokenHash],
  );
  try {
    assert.equal(
      (
        await request(
          `curation/versions/${pending.id}/review`,
          reviewer.cookie,
          "POST",
          reviewBody(pending),
        )
      ).status,
      401,
    );
  } finally {
    await db.query(
      "UPDATE browser_session SET expires_at=$2 WHERE token_hash=$1",
      [tokenHash, original.expires_at],
    );
  }
  assert.equal((await detail(pending.id)).editorialStatus, "IN_REVIEW");
});
