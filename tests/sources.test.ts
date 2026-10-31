import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Synthetic registry records and PDF-magic bytes exercise persistence/integrity
// contracts only. They are not imported Inep documents or official questions.
// Set the archive root before importing the application; each test file process
// owns its temporary directory and never touches the development source archive.
const previousArchiveDir = process.env.SOURCE_ARCHIVE_DIR;
const archiveDir = await mkdtemp(path.join(tmpdir(), "enade-sources-test-"));
process.env.SOURCE_ARCHIVE_DIR = archiveDir;
const { createApp, db } = await import("../apps/api/src/main.js");
const { importDocument, validateOfficialUrl, validateMirrorUrl } = await import(
  "../apps/api/src/source-store.js"
);

type Actor = { cookie: string; identityId: string };
type Source = {
  id: string;
  title: string;
  officialUrl: string;
  kind: "EXAM" | "ANSWER_KEY" | "RESPONSE_STANDARD" | "EXAM_MAP";
  year: number;
  area: string;
  modality: "BACHARELADO" | "LICENCIATURA" | "CST" | "COMUM";
  acquisitionMethod?: "DIRECT" | "MIRROR" | "LOCAL";
  retrievalUrl?: string | null;
  sha256: string;
  byteSize: number;
  pageCount: number;
  status: "IMPORTED" | "VERIFIED" | "REJECTED";
  revision: number;
  isFinal: boolean;
  canReview: boolean;
};
type Fixture = Source & { bytes: Buffer; file: string };
type Provenance = {
  examSourceId: string;
  keySourceId: string;
  page: number;
  questionNumber: number;
  keyPage: number;
};
type OfficialContent = {
  title: string;
  topic: string;
  prompt: string;
  origin: "OFFICIAL";
  authorCredit: string;
  explanation: string;
  explanationCredit: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  provenance: Provenance;
};
type Version = {
  id: string;
  questionId: string;
  revision: number;
  editorialStatus: string;
  origin: string;
  authorCredit: string;
  provenance: Provenance;
};
let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
let author: Actor;
let reviewer: Actor;
let guest: Actor;
const identities = new Set<string>();
const sourceIds = new Set<string>();
const questionIds = new Set<string>();
const immutable = (error: unknown) =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  error.code === "23514";

function request(route: string, cookie = "", method = "GET", body?: unknown) {
  return fetch(`${base}/api/${route}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
}

async function actor(response: Response) {
  const header = response.headers.get("set-cookie");
  assert.ok(header, "a test session must be issued");
  const cookie = header.split(";")[0];
  const tokenHash = createHash("sha256")
    .update(cookie.slice("enade_session=".length))
    .digest("hex");
  const row = (
    await db.query<{ identity_id: string }>(
      "SELECT identity_id FROM browser_session WHERE token_hash=$1",
      [tokenHash],
    )
  ).rows[0];
  assert.ok(row, "a test session must be persisted");
  identities.add(row.identity_id);
  return { cookie, identityId: row.identity_id };
}

async function createGuest() {
  const response = await request("session", "", "POST", {});
  assert.equal(response.status, 201);
  return actor(response);
}

async function createAccount() {
  const initial = await createGuest();
  const response = await request("auth/register", initial.cookie, "POST", {
    email: `sources-${randomUUID()}@example.invalid`,
    password: `test-only-${randomUUID()}`,
    name: "Pessoa Teste",
  });
  assert.equal(response.status, 201);
  return actor(response);
}

before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  author = await createAccount();
  reviewer = await createAccount();
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
        await client.query(
          "DELETE FROM editorial_question WHERE id=ANY($1::text[])",
          [ids],
        );
      }
      if (sourceIds.size)
        await client.query(
          "DELETE FROM source_document WHERE id=ANY($1::uuid[])",
          [[...sourceIds]],
        );
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
    await rm(archiveDir, { recursive: true, force: true });
    if (previousArchiveDir === undefined) delete process.env.SOURCE_ARCHIVE_DIR;
    else process.env.SOURCE_ARCHIVE_DIR = previousArchiveDir;
  }
});

async function fixture(
  override: Partial<
    Pick<Source, "kind" | "year" | "area" | "modality" | "pageCount">
  > = {},
): Promise<Fixture> {
  const id = randomUUID();
  const bytes = Buffer.from(
    `%PDF-1.7\n% TEST ONLY SYNTHETIC FIXTURE ${id}; not an Inep document\n%%EOF\n`,
  );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const record: Fixture = {
    id,
    title: `TEST ONLY synthetic source ${id}`,
    officialUrl: `https://download.inep.gov.br/enade/test-only/${id}.pdf`,
    kind: "EXAM",
    year: 2021,
    area: "Computação — TEST ONLY",
    modality: "BACHARELADO",
    pageCount: 3,
    sha256,
    byteSize: bytes.length,
    status: "IMPORTED",
    revision: 1,
    isFinal: false,
    canReview: false,
    bytes,
    file: path.join(archiveDir, `${sha256}.pdf`),
    ...override,
  };
  await writeFile(record.file, bytes, { mode: 0o600, flag: "wx" });
  await db.query(
    "INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,imported_by,last_editor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)",
    [
      id,
      record.title,
      record.officialUrl,
      record.kind,
      record.year,
      record.area,
      record.modality,
      sha256,
      bytes.length,
      record.pageCount,
      author.identityId,
    ],
  );
  sourceIds.add(id);
  return record;
}

function metadata(source: Source) {
  return {
    title: source.title,
    kind: source.kind,
    year: source.year,
    area: source.area,
    modality: source.modality,
  };
}

function sourceReview(source: Source, decision = "VERIFY") {
  return {
    baseRevision: source.revision,
    decision,
    note: "Fixture sintética conferida exclusivamente para este teste de integração.",
    ...(decision === "VERIFY"
      ? {
          checklist: {
            origin: true,
            edition: true,
            integrity: true,
            ...(source.kind === "ANSWER_KEY" ? { final: true } : {}),
          },
        }
      : {}),
  };
}

async function getSource(id: string, as = author): Promise<Source> {
  const response = await request(`curation/sources/${id}`, as.cookie);
  assert.equal(response.status, 200);
  return response.json();
}

async function verify<T extends Source>(source: T): Promise<T> {
  const response = await request(
    `curation/sources/${source.id}/review`,
    reviewer.cookie,
    "POST",
    sourceReview(source),
  );
  assert.equal(response.status, 200);
  return { ...source, ...(await response.json()) };
}

async function pair() {
  return {
    exam: await verify(await fixture()),
    key: await verify(await fixture({ kind: "ANSWER_KEY" })),
  };
}

function official(
  exam: Source,
  key: Source,
  override: Partial<OfficialContent> = {},
): OfficialContent {
  return {
    title: `TEST ONLY synthetic question ${randomUUID()}`,
    topic: "Algoritmos",
    prompt:
      "Conteúdo fictício de integração. Este enunciado não corresponde a uma questão oficial do Inep.",
    origin: "OFFICIAL",
    authorCredit: "Crédito de teste que deve ser substituído pelo servidor",
    explanation:
      "Explicação autoral sintética para verificar contratos; não é um gabarito ou comentário do Inep.",
    explanationCredit: "Equipe de testes — explicação autoral sintética",
    options: [
      { id: "fixture-a", text: "Alternativa sintética A." },
      { id: "fixture-b", text: "Alternativa sintética B." },
    ],
    correctOptionId: "fixture-a",
    provenance: {
      examSourceId: exam.id,
      keySourceId: key.id,
      page: 2,
      questionNumber: 17,
      keyPage: 1,
    },
    ...override,
  };
}

async function createQuestion(input: OfficialContent): Promise<Version> {
  const response = await request(
    "curation/questions",
    author.cookie,
    "POST",
    input,
  );
  if (response.status === 201) {
    const version = await response.json();
    questionIds.add(version.questionId);
    return version;
  }
  assert.equal(response.status, 201);
  throw new Error("the synthetic editorial fixture could not be created");
}

async function submit(version: Version): Promise<Version> {
  const response = await request(
    `curation/versions/${version.id}/submit`,
    author.cookie,
    "POST",
    { baseRevision: version.revision },
  );
  assert.equal(response.status, 200);
  return response.json();
}

function publication(version: Version) {
  return {
    baseRevision: version.revision,
    decision: "PUBLISH",
    note: "Questão sintética e referências de fixture conferidas neste teste.",
    checklist: { content: true, answer: true, credit: true, source: true },
  };
}

async function publish(version: Version): Promise<Version> {
  const pending = await submit(version);
  const response = await request(
    `curation/versions/${version.id}/review`,
    reviewer.cookie,
    "POST",
    publication(pending),
  );
  assert.equal(response.status, 200);
  return response.json();
}

test("the source registry and archived files are curator-only and have no public import endpoint", async () => {
  const source = await fixture();
  for (const route of [
    "curation/sources",
    `curation/sources/${source.id}`,
    `curation/sources/${source.id}/file`,
  ]) {
    assert.equal((await request(route, guest.cookie)).status, 403);
    assert.equal((await request(route)).status, 401);
  }
  for (const malformed of ["not-a-uuid", "a".repeat(36)]) {
    assert.equal(
      (await request(`curation/sources/${malformed}`, reviewer.cookie)).status,
      404,
    );
  }
  const list = await request("curation/sources", reviewer.cookie);
  assert.equal(list.status, 200);
  assert.ok((await list.json()).some((row: Source) => row.id === source.id));
  assert.equal((await getSource(source.id, reviewer)).canReview, true);
  const file = await request(
    `curation/sources/${source.id}/file`,
    reviewer.cookie,
  );
  assert.equal(file.status, 200);
  assert.match(file.headers.get("content-type") || "", /application\/pdf/);
  const bytes = Buffer.from(await file.arrayBuffer());
  assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256);
  assert.equal(
    (await request("curation/sources", author.cookie, "POST", metadata(source)))
      .status,
    404,
  );
});

test("source conference enforces independent review, revision checks, rejection and final answer keys", async () => {
  const original = await fixture();
  assert.equal(
    (
      await request(
        `curation/sources/${original.id}/review`,
        author.cookie,
        "POST",
        sourceReview(original),
      )
    ).status,
    403,
  );
  const rejected = await request(
    `curation/sources/${original.id}/review`,
    reviewer.cookie,
    "POST",
    sourceReview(original, "REJECT"),
  );
  assert.equal(rejected.status, 200);
  const rejectedSource = (await rejected.json()) as Source;
  assert.equal(rejectedSource.status, "REJECTED");
  const corrected = await request(
    `curation/sources/${original.id}`,
    author.cookie,
    "PUT",
    {
      ...metadata(original),
      title: original.title + " corrected",
      baseRevision: rejectedSource.revision,
    },
  );
  assert.equal(corrected.status, 200);
  const correctedSource = (await corrected.json()) as Source;
  assert.equal(correctedSource.status, "IMPORTED");
  assert.equal(
    (
      await request(`curation/sources/${original.id}`, author.cookie, "PUT", {
        ...metadata(original),
        baseRevision: rejectedSource.revision,
      })
    ).status,
    409,
  );
  const verified = await verify({ ...original, ...correctedSource });
  assert.equal(verified.status, "VERIFIED");
  assert.equal(verified.isFinal, false);
  assert.equal(
    (
      await request(`curation/sources/${verified.id}`, author.cookie, "PUT", {
        ...metadata(verified),
        baseRevision: verified.revision,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        `curation/sources/${verified.id}/review`,
        reviewer.cookie,
        "POST",
        sourceReview(verified),
      )
    ).status,
    409,
  );

  const editedByReviewer = await fixture();
  const update = await request(
    `curation/sources/${editedByReviewer.id}`,
    reviewer.cookie,
    "PUT",
    { ...metadata(editedByReviewer), baseRevision: editedByReviewer.revision },
  );
  assert.equal(update.status, 200);
  const current = (await update.json()) as Source;
  for (const as of [author, reviewer])
    assert.equal(
      (
        await request(
          `curation/sources/${current.id}/review`,
          as.cookie,
          "POST",
          sourceReview(current),
        )
      ).status,
      403,
    );

  const key = await fixture({ kind: "ANSWER_KEY" });
  const notFinal = sourceReview(key);
  notFinal.checklist = {
    origin: true,
    edition: true,
    integrity: true,
    final: false,
  };
  assert.equal(
    (
      await request(
        `curation/sources/${key.id}/review`,
        reviewer.cookie,
        "POST",
        notFinal,
      )
    ).status,
    400,
  );
  const finalKey = await verify(key);
  assert.equal(finalKey.isFinal, true);
});

test("source artifacts and verified metadata are immutable and a digest identifies one registry record", async () => {
  const source = await fixture();
  for (const statement of [
    "UPDATE source_document SET official_url='https://download.inep.gov.br/enade/test-only/different.pdf' WHERE id=$1",
    "UPDATE source_document SET byte_size=byte_size+1 WHERE id=$1",
    "UPDATE source_document SET page_count=page_count+1 WHERE id=$1",
  ])
    await assert.rejects(db.query(statement, [source.id]), immutable);
  const duplicateId = randomUUID();
  sourceIds.add(duplicateId);
  await assert.rejects(
    db.query(
      "INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,imported_by,last_editor_id) SELECT $2,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,imported_by,last_editor_id FROM source_document WHERE id=$1",
      [source.id, duplicateId],
    ),
    (error) =>
      !!error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505",
  );
  const verified = await verify(source);
  await assert.rejects(
    db.query(
      "UPDATE source_document SET title='TEST ONLY changed verified metadata' WHERE id=$1",
      [verified.id],
    ),
    immutable,
  );
  assert.equal((await getSource(source.id)).sha256, source.sha256);
});

test("missing or same-size corrupted archives block source conference and file serving", async () => {
  for (const missing of [true, false]) {
    const source = await fixture();
    if (missing) await rm(source.file);
    else {
      const corrupted = Buffer.from(source.bytes);
      corrupted[corrupted.length - 1] ^= 1;
      await writeFile(source.file, corrupted);
      assert.equal((await readFile(source.file)).length, source.byteSize);
    }
    assert.equal(
      (
        await request(
          `curation/sources/${source.id}/review`,
          reviewer.cookie,
          "POST",
          sourceReview(source),
        )
      ).status,
      409,
    );
    assert.equal(
      (await request(`curation/sources/${source.id}/file`, reviewer.cookie))
        .status,
      409,
    );
    assert.equal((await getSource(source.id)).status, "IMPORTED");
    await writeFile(source.file, source.bytes);
    assert.equal((await verify(source)).status, "VERIFIED");
  }
});

test("reimporting identical bytes repairs archives without changing verified source identity or state", async () => {
  const source = await verify(await fixture());
  const originalEventCount = Number(
    (
      await db.query(
        "SELECT count(*) AS count FROM source_event WHERE source_id=$1",
        [source.id],
      )
    ).rows[0].count,
  );
  for (const missing of [false, true]) {
    if (missing) await rm(source.file);
    else {
      const corrupted = Buffer.from(source.bytes);
      corrupted[corrupted.length - 1] ^= 1;
      await writeFile(source.file, corrupted);
      assert.equal((await readFile(source.file)).length, source.byteSize);
    }
    assert.equal(
      (await request(`curation/sources/${source.id}/file`, reviewer.cookie))
        .status,
      409,
    );

    const restored = await importDocument({
      ...metadata(source),
      officialUrl: source.officialUrl,
      pageCount: source.pageCount,
      bytes: source.bytes,
      actorId: author.identityId,
    });
    assert.equal(restored.id, source.id);
    assert.equal(restored.duplicate, true);
    assert.equal(restored.status, "VERIFIED");
    const archived = await readFile(source.file);
    assert.equal(archived.length, source.byteSize);
    assert.equal(
      createHash("sha256").update(archived).digest("hex"),
      source.sha256,
    );
    const afterRepair = await getSource(source.id);
    assert.equal(afterRepair.status, "VERIFIED");
    assert.equal(afterRepair.revision, source.revision);
    assert.equal(afterRepair.sha256, source.sha256);
    assert.equal(afterRepair.officialUrl, source.officialUrl);
    assert.equal(
      (await request(`curation/sources/${source.id}/file`, reviewer.cookie))
        .status,
      200,
    );
  }
  assert.equal(
    (
      await db.query("SELECT id FROM source_document WHERE sha256=$1", [
        source.sha256,
      ])
    ).rowCount,
    1,
  );
  const finalEventCount = Number(
    (
      await db.query(
        "SELECT count(*) AS count FROM source_event WHERE source_id=$1",
        [source.id],
      )
    ).rows[0].count,
  );
  assert.equal(finalEventCount, originalEventCount);
});

test("official publication requires verified provenance and reveals only the exam before an answer", async () => {
  const { exam, key } = await pair();
  const input = official(exam, key);
  const draft = await createQuestion(input);
  assert.equal(draft.authorCredit, "Inep");
  const pending = await submit(draft);
  const noSourceCheck = publication(pending);
  noSourceCheck.checklist.source = false;
  assert.equal(
    (
      await request(
        `curation/versions/${pending.id}/review`,
        reviewer.cookie,
        "POST",
        noSourceCheck,
      )
    ).status,
    400,
  );
  const accepted = await request(
    `curation/versions/${pending.id}/review`,
    reviewer.cookie,
    "POST",
    publication(pending),
  );
  assert.equal(accepted.status, 200);
  const publicResponse = await request(`questions/${draft.id}`, guest.cookie);
  assert.equal(publicResponse.status, 200);
  const question = await publicResponse.json();
  assert.equal(question.origin, "OFFICIAL");
  assert.equal(question.authorCredit, "Inep");
  assert.deepEqual(question.provenance, {
    exam: {
      id: exam.id,
      title: exam.title,
      officialUrl: exam.officialUrl,
      sha256: exam.sha256,
      year: exam.year,
      area: exam.area,
      modality: exam.modality,
      pageCount: exam.pageCount,
    },
    page: 2,
    questionNumber: 17,
  });
  assert.equal(question.answer, null);
  assert.equal(question.correctOptionId, undefined);
  assert.equal(question.explanation, undefined);
  const beforeAnswer = JSON.stringify(question);
  for (const restricted of [key.id, key.officialUrl, key.sha256])
    assert.ok(
      !beforeAnswer.includes(restricted),
      "the public unanswered question must not contain answer-key metadata",
    );
  assert.equal(
    (await request(`curation/sources/${key.id}/file`, guest.cookie)).status,
    403,
  );
  const saved = await request(
    `questions/${draft.id}/answer`,
    guest.cookie,
    "PUT",
    { optionId: "fixture-a", baseRevision: 0 },
  );
  assert.equal(saved.status, 200);
  const feedback = await saved.json();
  assert.equal(feedback.correct, true);
  assert.equal(feedback.explanationCredit, input.explanationCredit);
  assert.deepEqual(feedback.answerKey, {
    id: key.id,
    title: key.title,
    officialUrl: key.officialUrl,
    sha256: key.sha256,
    page: 1,
    finality: null,
  });
});

test("official provenance rejects mismatched editions, invalid pages and duplicate logical questions", async () => {
  const { exam, key } = await pair();
  const importedExam = await fixture();
  const otherYear = await verify(
    await fixture({ kind: "ANSWER_KEY", year: 2017 }),
  );
  const otherArea = await verify(
    await fixture({ kind: "ANSWER_KEY", area: "Outra área — TEST ONLY" }),
  );
  const otherModality = await verify(
    await fixture({ kind: "ANSWER_KEY", modality: "LICENCIATURA" }),
  );
  const input = official(exam, key);
  const invalid = [
    {
      ...input,
      provenance: { ...input.provenance, examSourceId: importedExam.id },
    },
    ...[otherYear, otherArea, otherModality].map((source) => ({
      ...input,
      provenance: { ...input.provenance, keySourceId: source.id },
    })),
    { ...input, provenance: { ...input.provenance, keySourceId: exam.id } },
    { ...input, provenance: { ...input.provenance, page: 0 } },
    { ...input, provenance: { ...input.provenance, page: exam.pageCount + 1 } },
    {
      ...input,
      provenance: { ...input.provenance, keyPage: key.pageCount + 1 },
    },
    { ...input, provenance: { ...input.provenance, questionNumber: 0 } },
    { ...input, provenance: { ...input.provenance, questionNumber: 1001 } },
    { ...input, explanationCredit: "" },
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
  const original = await createQuestion(input);
  assert.equal(
    (
      await request("curation/questions", author.cookie, "POST", {
        ...input,
        title: "TEST ONLY duplicate logical identity",
      })
    ).status,
    409,
  );
  await assert.rejects(
    db.query("UPDATE question_version SET source_page=0 WHERE id=$1", [
      original.id,
    ]),
    immutable,
  );
  await assert.rejects(
    db.query(
      "UPDATE editorial_question SET official_question_number=official_question_number+1 WHERE id=$1",
      [original.questionId],
    ),
    immutable,
  );
});

test("publication rechecks archived bytes and failed integrity checks do not advance editorial state", async () => {
  const { exam, key } = await pair();
  const draft = await createQuestion(official(exam, key));
  const pending = await submit(draft);
  await rm(key.file);
  assert.equal(
    (
      await request(
        `curation/versions/${pending.id}/review`,
        reviewer.cookie,
        "POST",
        publication(pending),
      )
    ).status,
    409,
  );
  const unchanged = await request(
    `curation/versions/${pending.id}`,
    author.cookie,
  );
  assert.equal(unchanged.status, 200);
  const current = await unchanged.json();
  assert.equal(current.editorialStatus, "IN_REVIEW");
  assert.equal(current.revision, pending.revision);
  assert.equal(
    (await request(`questions/${draft.id}`, guest.cookie)).status,
    404,
  );
  await writeFile(key.file, key.bytes, { mode: 0o600, flag: "wx" });
  assert.equal(
    (
      await request(
        `curation/versions/${pending.id}/review`,
        reviewer.cookie,
        "POST",
        publication(pending),
      )
    ).status,
    200,
  );
});

test("a new final answer-key version preserves historical provenance and feedback", async () => {
  const { exam, key } = await pair();
  const input = official(exam, key);
  const first = await publish(await createQuestion(input));
  const initialAnswer = await request(
    `questions/${first.id}/answer`,
    guest.cookie,
    "PUT",
    { optionId: "fixture-a", baseRevision: 0 },
  );
  assert.equal(initialAnswer.status, 200);
  const originalFeedback = await initialAnswer.json();
  const newKey = await verify(await fixture({ kind: "ANSWER_KEY" }));
  const cloneResponse = await request(
    `curation/questions/${first.questionId}/versions`,
    author.cookie,
    "POST",
    { baseCurrentVersionId: first.id },
  );
  assert.equal(cloneResponse.status, 201);
  const clone = (await cloneResponse.json()) as Version;
  const secondInput = {
    ...input,
    correctOptionId: "fixture-b",
    explanationCredit:
      "Equipe de testes — explicação autoral sintética revisada",
    provenance: { ...input.provenance, keySourceId: newKey.id },
  };
  const editedResponse = await request(
    `curation/versions/${clone.id}`,
    author.cookie,
    "PUT",
    { ...secondInput, baseRevision: clone.revision },
  );
  assert.equal(editedResponse.status, 200);
  const second = await publish(await editedResponse.json());
  const historical = await (
    await request(`questions/${first.id}`, guest.cookie)
  ).json();
  assert.deepEqual(historical.answer, originalFeedback);
  assert.equal(historical.answer.answerKey.id, key.id);
  assert.equal(historical.answer.answerKey.sha256, key.sha256);
  const current = await (
    await request(`questions/${second.id}`, guest.cookie)
  ).json();
  assert.equal(current.answer, null);
  assert.ok(
    !JSON.stringify(current).includes(newKey.id),
    "the new answer key must also remain private before answering",
  );
  const answer = await request(
    `questions/${second.id}/answer`,
    guest.cookie,
    "PUT",
    { optionId: "fixture-b", baseRevision: 0 },
  );
  assert.equal(answer.status, 200);
  const feedback = await answer.json();
  assert.equal(feedback.correct, true);
  assert.equal(feedback.answerKey.id, newKey.id);
  assert.equal(feedback.explanationCredit, secondInput.explanationCredit);
  await assert.rejects(
    db.query(
      "UPDATE source_document SET official_url='https://download.inep.gov.br/enade/test-only/rebound.pdf' WHERE id=$1",
      [key.id],
    ),
    immutable,
  );
});

test("mirror and local imports preserve their acquisition provenance and remain independently reviewable", async () => {
  const officialUrl =
    "https://download.inep.gov.br/download/Enade2008_RNP/COMPUTACAO.pdf";
  const mirror =
    "https://raw.githubusercontent.com/test/fixture/" +
    "a".repeat(40) +
    "/test.pdf";
  for (const method of ["MIRROR", "LOCAL"] as const) {
    const imported = await importDocument({
      title: "Synthetic shared source",
      officialUrl,
      kind: "EXAM",
      year: 2008,
      area: "Computação — TEST ONLY",
      modality: "COMUM",
      pageCount: 1,
      bytes: Buffer.from("%PDF-1.7\nSYNTHETIC " + randomUUID()),
      actorId: author.identityId,
      acquisitionMethod: method,
      ...(method === "MIRROR" ? { retrievalUrl: mirror } : {}),
    });
    sourceIds.add(imported.id);
    const source = await getSource(imported.id, reviewer);
    assert.equal(source.acquisitionMethod, method);
    assert.equal(source.retrievalUrl, method === "MIRROR" ? mirror : null);
    assert.equal(source.status, "IMPORTED");
    assert.equal(source.canReview, true);
    assert.equal((await getSource(imported.id, author)).canReview, false);
    await assert.rejects(
      db.query(
        "UPDATE source_document SET acquisition_method=$2,retrieval_url=NULL WHERE id=$1",
        [source.id, method === "MIRROR" ? "LOCAL" : "DIRECT"],
      ),
      { code: "23514" },
    );
    if (method === "MIRROR")
      await assert.rejects(
        db.query("UPDATE source_document SET retrieval_url=$2 WHERE id=$1", [
          source.id,
          mirror.replace("a".repeat(40), "b".repeat(40)),
        ]),
        { code: "23514" },
      );
    assert.equal((await verify(source)).status, "VERIFIED");
  }
  const map = await fixture({ kind: "EXAM_MAP" });
  assert.equal((await verify(map)).kind, "EXAM_MAP");
});

test("source URLs reject unpinned mirrors and preserve HTTPS for historical Inep paths", () => {
  for (const url of [
    "https://download.inep.gov.br/download/enade/2005/provas/COMPUTACAO.pdf",
    "https://download.inep.gov.br/download/Enade2008_RNP/COMPUTACAO.pdf",
    "https://download.inep.gov.br/educacao_superior/enade/provas/2011/COMPUTACAO.pdf",
    "https://download.inep.gov.br/pnd/provas_e_gabaritos/2025_computacao_PV_1.pdf",
  ])
    assert.equal(validateOfficialUrl(url), url);
  const mirror =
    "https://raw.githubusercontent.com/test/fixture/" +
    "a".repeat(40) +
    "/test.pdf";
  assert.equal(validateMirrorUrl(mirror), mirror);
  for (const url of [
    mirror.replace("a".repeat(40), "main"),
    mirror + "?token=x",
    mirror.replace("https:", "http:"),
    mirror.replace("raw.githubusercontent.com", "evil.example"),
  ])
    assert.throws(() => validateMirrorUrl(url));
  assert.throws(() =>
    validateOfficialUrl("https://download.inep.gov.br/unrelated/file.pdf"),
  );
});
