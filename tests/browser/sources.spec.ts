import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from "@playwright/test";

// Every PDF, URL, source row and question in these tests is an isolated synthetic
// fixture. No fixture claims to reproduce a real official question or document.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const archiveDirectory =
  process.env.SOURCE_ARCHIVE_DIR || path.resolve(".local/sources");
const password = "Fontes teste 2026!";
type FixtureSource = {
  id: string;
  title: string;
  officialUrl: string;
  sha256: string;
  file: string;
  bytes: Buffer;
  pageCount: number;
  retrievalUrl: string | null;
};
type Fixtures = {
  provision: (context: BrowserContext) => Promise<string>;
  source: (
    importer: string,
    kind?: "EXAM" | "ANSWER_KEY",
    acquisition?: { mirror?: boolean; shared?: boolean },
  ) => Promise<FixtureSource>;
  questions: Set<string>;
};
function syntheticPdf(label: string, count: number) {
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${count} /Kids [${Array.from({ length: count }, (_, i) => `${3 + i * 2} 0 R`).join(" ")}] >>`,
  ];
  const fontId = 3 + count * 2;
  for (let page = 0; page < count; page++) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${4 + page * 2} 0 R >>`,
    );
    const stream = `BT /F1 12 Tf 50 720 Td (Synthetic source fixture - NOT official content) Tj 0 -20 Td (${label} - page ${page + 1}) Tj ET`;
    objects.push(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n% Synthetic test fixture\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
const test = base.extend<Fixtures>({
  questions: async ({}, use) => {
    await use(new Set<string>());
  },
  provision: async ({}, use) => {
    const identities = new Set<string>();
    await use(async (context) => {
      expect(
        (await context.request.post("/api/session", { data: {} })).status(),
      ).toBe(201);
      const email = `source-browser-${randomUUID()}@example.invalid`;
      expect(
        (
          await context.request.post("/api/auth/register", {
            data: { email, password },
          })
        ).status(),
      ).toBe(201);
      const identity = (
        await pool.query("SELECT identity_id FROM account WHERE email=$1", [
          email,
        ])
      ).rows[0].identity_id;
      identities.add(identity);
      await pool.query("INSERT INTO curator_role(identity_id) VALUES($1)", [
        identity,
      ]);
      return identity;
    });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const identity of identities) {
        await client.query("DELETE FROM answer WHERE owner_id=$1", [identity]);
        await client.query("DELETE FROM browser_session WHERE identity_id=$1", [
          identity,
        ]);
        await client.query("DELETE FROM curator_role WHERE identity_id=$1", [
          identity,
        ]);
        await client.query("DELETE FROM account WHERE identity_id=$1", [
          identity,
        ]);
        await client.query("DELETE FROM study_identity WHERE id=$1", [
          identity,
        ]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
  source: async ({ provision, questions }, use) => {
    void provision; // Account teardown runs only after source/question teardown.
    const sources: FixtureSource[] = [];
    await use(async (importer, kind = "EXAM", acquisition = {}) => {
      const id = randomUUID();
      const pageCount = kind === "EXAM" ? 3 : 2;
      const bytes = syntheticPdf(id, pageCount);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const file = path.join(archiveDirectory, sha256 + ".pdf");
      const title = `${kind === "EXAM" ? "Prova" : "Gabarito"} sintético de teste ${id.slice(0, 8)}`;
      const officialUrl = `https://download.inep.gov.br/enade/test-fixtures/${id}.pdf`;
      const retrievalUrl = acquisition.mirror
        ? `https://raw.githubusercontent.com/test/synthetic/${"a".repeat(40)}/${id}.pdf`
        : null;
      await mkdir(archiveDirectory, { recursive: true });
      await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
      const result = {
        id,
        title,
        officialUrl,
        sha256,
        file,
        bytes,
        pageCount,
        retrievalUrl,
      };
      sources.push(result);
      await pool.query(
        "INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,imported_by,last_editor_id,acquisition_method,retrieval_url) VALUES($1,$2,$3,$4,2021,'Ciência da Computação (fixture)',$9,$5,$6,$7,$8,$8,$10,$11)",
        [
          id,
          title,
          officialUrl,
          kind,
          sha256,
          bytes.length,
          pageCount,
          importer,
          acquisition.shared ? "COMUM" : "BACHARELADO",
          acquisition.mirror ? "MIRROR" : "DIRECT",
          retrievalUrl,
        ],
      );
      return result;
    });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const question of questions) {
        await client.query(
          "DELETE FROM answer WHERE question_id IN (SELECT id FROM question_version WHERE question_id=$1)",
          [question],
        );
        await client.query("DELETE FROM editorial_question WHERE id=$1", [
          question,
        ]);
      }
      for (const fixture of sources)
        await client.query("DELETE FROM source_document WHERE id=$1", [
          fixture.id,
        ]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    for (const fixture of sources)
      await unlink(fixture.file).catch((err) => {
        if (err.code !== "ENOENT") throw err;
      });
  },
});
test.afterAll(async () => {
  await pool.end();
});

async function sourceQueue(page: Page) {
  await page.getByRole("button", { name: "Curadoria", exact: true }).click();
  await page.getByRole("button", { name: "Fontes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fontes oficiais", level: 1 }),
  ).toBeVisible();
}
async function checkSource(page: Page, key = false) {
  await page
    .getByRole("checkbox", {
      name: "Conferi que o endereço e o documento são de origem oficial.",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Conferi ano, área e modalidade no documento.",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Conferi a integridade e a leitura do PDF arquivado.",
      exact: true,
    })
    .check();
  await page
    .getByLabel("Parecer sobre a fonte", { exact: true })
    .fill("Parecer sintético de teste: conferência da fixture de procedência.");
  if (key) {
    await expect(
      page.getByRole("button", { name: "Verificar fonte", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("checkbox", {
        name: "Conferi que este é o gabarito definitivo.",
        exact: true,
      })
      .check();
  }
}

test("source verification enables official provenance while the definitive key remains hidden until answering", async ({
  page,
  context,
  browser,
  provision,
  source,
  questions,
}) => {
  test.setTimeout(120000);
  const importer = await provision(context);
  const exam = await source(importer, "EXAM", { mirror: true, shared: true });
  const key = await source(importer, "ANSWER_KEY", { shared: true });
  const reviewerContext = await browser.newContext({
    baseURL: "http://localhost:4200",
  });
  const studentContext = await browser.newContext({
    baseURL: "http://localhost:4200",
  });
  try {
    await provision(reviewerContext);
    const reviewer = await reviewerContext.newPage();
    await page.goto("/");
    await sourceQueue(page);
    await page
      .getByRole("button", {
        name: `Conferir fonte: ${exam.title}`,
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Arquivo obtido como cópia em repositório público.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Consultar a cópia identificada pelo commit",
      }),
    ).toHaveAttribute("href", exam.retrievalUrl!);
    await expect(
      page.getByText(
        "Caderno compartilhado: contém blocos de cursos diferentes.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/Quem importou ou editou os metadados não pode verificar/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Verificar fonte", exact: true }),
    ).toHaveCount(0);
    const editedExamTitle = exam.title + " conferência";
    await page
      .getByLabel("Título do documento", { exact: true })
      .fill(editedExamTitle);
    await page
      .getByRole("button", { name: "Salvar metadados", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Metadados salvos.");

    await reviewer.goto("/");
    await sourceQueue(reviewer);
    for (const width of [320, 390, 768, 1440]) {
      await reviewer.setViewportSize({ width, height: 900 });
      expect(
        await reviewer.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await reviewer.screenshot({
        path: `test-results/sources-queue-${width}.png`,
        fullPage: true,
      });
    }
    await reviewer
      .getByRole("button", {
        name: `Conferir fonte: ${editedExamTitle}`,
        exact: true,
      })
      .click();
    await expect(
      reviewer.getByRole("link", { name: "Baixar PDF arquivado" }),
    ).toHaveAttribute("href", `/api/curation/sources/${exam.id}/file`);
    const archived = await reviewerContext.request.get(
      `/api/curation/sources/${exam.id}/file`,
    );
    expect(archived.status()).toBe(200);
    expect(
      createHash("sha256")
        .update(await archived.body())
        .digest("hex"),
    ).toBe(exam.sha256);
    await checkSource(reviewer);
    await reviewer.route(`**/api/curation/sources/${exam.id}/review`, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Não foi possível confirmar a fonte agora.",
        }),
      }),
    );
    await reviewer
      .getByRole("button", { name: "Verificar fonte", exact: true })
      .click();
    await expect(reviewer.getByRole("alert")).toContainText(
      "Não foi possível confirmar a fonte agora.",
    );
    await expect(
      reviewer.getByLabel("Parecer sobre a fonte", { exact: true }),
    ).toHaveValue(/Parecer sintético de teste/);
    await reviewer.unroute(`**/api/curation/sources/${exam.id}/review`);
    await reviewer
      .getByRole("button", { name: "Verificar fonte", exact: true })
      .click();
    await expect(reviewer.getByRole("status")).toContainText(
      "Fonte verificada.",
    );
    await expect(
      reviewer.getByLabel("Título do documento", { exact: true }),
    ).toHaveCount(0);
    await reviewer.setViewportSize({ width: 320, height: 900 });
    await reviewer.screenshot({
      path: "test-results/source-verified-320.png",
      fullPage: true,
    });
    await reviewer.getByRole("button", { name: "Voltar às fontes" }).click();
    await reviewer
      .getByRole("button", {
        name: `Conferir fonte: ${key.title}`,
        exact: true,
      })
      .click();
    await checkSource(reviewer, true);
    await reviewer
      .getByRole("button", { name: "Verificar fonte", exact: true })
      .click();
    await expect(reviewer.getByRole("status")).toContainText(
      "Fonte verificada.",
    );

    await page.getByRole("button", { name: "Questões", exact: true }).click();
    await page
      .getByRole("button", { name: "Nova questão oficial", exact: true })
      .click();
    await page
      .getByLabel("Prova oficial verificada", { exact: true })
      .selectOption(exam.id);
    await page
      .getByLabel("Gabarito definitivo verificado", { exact: true })
      .selectOption(key.id);
    await page.getByLabel("Página da questão", { exact: true }).fill("2");
    await page.getByLabel("Número na prova", { exact: true }).fill("1");
    await page.getByLabel("Página do gabarito", { exact: true }).fill("1");
    const title = `Questão de procedência sintética ${randomUUID().slice(0, 8)}`;
    await page.getByLabel("Título", { exact: true }).fill(title);
    await page
      .getByLabel("Assunto", { exact: true })
      .fill("Procedência de teste");
    await page
      .getByLabel("Enunciado", { exact: true })
      .fill(
        "Fixture sintética de teste de procedência. Não reproduz uma questão oficial. Marque a alternativa E para testar cinco alternativas.",
      );
    await page
      .getByRole("button", { name: "Adicionar alternativa", exact: true })
      .click();
    for (const letter of "ABCDE")
      await page
        .getByLabel(`Alternativa ${letter}`, { exact: true })
        .fill(`Alternativa ${letter} da fixture`);
    await page
      .getByRole("radio", {
        name: "Definir alternativa E como correta",
        exact: true,
      })
      .check();
    await page
      .getByLabel("Crédito da explicação editorial", { exact: true })
      .fill("Comentário editorial sintético de teste");
    await page
      .getByLabel("Explicação do gabarito", { exact: true })
      .fill(
        "Esta fixture valida a preservação do gabarito por identidade e a procedência do documento, sem reproduzir conteúdo oficial.",
      );
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/official-editor-${width}.png`,
        fullPage: true,
      });
    }
    const savedResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/curation/questions"),
    );
    await page
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .click();
    const saved = await savedResponse;
    expect(saved.status()).toBe(201);
    const draft = await saved.json();
    questions.add(draft.questionId);
    await page
      .getByRole("button", { name: "Enviar para revisão", exact: true })
      .click();
    await expect(
      page.getByText("Versão enviada para revisão independente.", {
        exact: true,
      }),
    ).toBeVisible();
    await reviewer
      .getByRole("button", { name: "Questões", exact: true })
      .click();
    await reviewer
      .getByRole("button", { name: `Abrir: ${title}`, exact: true })
      .click();
    await reviewer
      .getByRole("checkbox", {
        name: "Conferi o enunciado e as alternativas.",
        exact: true,
      })
      .check();
    await reviewer
      .getByRole("checkbox", {
        name: "Conferi o gabarito e a explicação.",
        exact: true,
      })
      .check();
    await reviewer
      .getByRole("checkbox", {
        name: "Conferi o crédito de autoria.",
        exact: true,
      })
      .check();
    await reviewer
      .getByLabel("Parecer da revisão", { exact: true })
      .fill(
        "Parecer sintético de teste para conferir o vínculo de fontes e as cinco alternativas.",
      );
    await expect(
      reviewer.getByRole("button", { name: "Publicar versão", exact: true }),
    ).toBeDisabled();
    await reviewer
      .getByRole("checkbox", {
        name: "Conferi a questão e o gabarito nos documentos oficiais indicados.",
        exact: true,
      })
      .check();
    await reviewer
      .getByRole("button", { name: "Publicar versão", exact: true })
      .click();
    await reviewer
      .getByRole("button", { name: "Confirmar publicação", exact: true })
      .click();
    await expect(
      reviewer.getByText("Versão publicada.", { exact: true }),
    ).toBeVisible();

    expect(
      (
        await studentContext.request.post("/api/session", { data: {} })
      ).status(),
    ).toBe(201);
    const beforeAnswer = await studentContext.request.get(
      `/api/questions/${draft.id}`,
    );
    expect(beforeAnswer.status()).toBe(200);
    const payload = await beforeAnswer.json();
    expect(payload.provenance.exam.id).toBe(exam.id);
    expect(payload.answer).toBeNull();
    expect(JSON.stringify(payload)).not.toContain(key.id);
    expect(JSON.stringify(payload)).not.toContain(key.officialUrl);
    expect(JSON.stringify(payload)).not.toContain(key.sha256);
    const student = await studentContext.newPage();
    await student.setViewportSize({ width: 320, height: 900 });
    await student.goto("/");
    await student
      .getByRole("button", { name: `Resolver: ${title}`, exact: true })
      .click();
    await expect(
      student.locator(".resolution .metadata").first(),
    ).toContainText("Oficial · Inep");
    await expect(student.locator(".question-provenance")).toContainText(
      "Edição 2021",
    );
    await expect(student.locator(".question-provenance")).toContainText(
      "Caderno compartilhado",
    );
    await expect(
      student.getByRole("link", {
        name: `Prova oficial: ${editedExamTitle}`,
        exact: true,
      }),
    ).toHaveAttribute("href", exam.officialUrl);
    await expect(student.locator(`a[href="${key.officialUrl}"]`)).toHaveCount(
      0,
    );
    await expect(student.locator(".option .letter").nth(4)).toHaveText("E");
    expect(
      await student.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await student.screenshot({
      path: "test-results/official-question-320.png",
      fullPage: true,
    });
    await student
      .getByRole("radio", { name: "Alternativa E da fixture", exact: true })
      .focus();
    await student.keyboard.press("Space");
    await student
      .getByRole("button", { name: "Confirmar resposta", exact: true })
      .click();
    await expect(student.locator(".feedback")).toContainText("Você acertou.");
    await expect(student.locator(".feedback")).toContainText(
      "Comentário editorial sintético de teste",
    );
    await expect(
      student.getByRole("link", {
        name: `Gabarito definitivo: ${key.title}`,
        exact: true,
      }),
    ).toHaveAttribute("href", key.officialUrl);
    await student.screenshot({
      path: "test-results/official-feedback-320.png",
      fullPage: true,
    });
  } finally {
    await reviewerContext.close();
    await studentContext.close();
  }
});

test("a missing archived source keeps the review pending and allows retry after restoring the fixture", async ({
  page,
  context,
  browser,
  provision,
  source,
}) => {
  const importer = await provision(context);
  const fixture = await source(importer);
  const reviewerContext = await browser.newContext({
    baseURL: "http://localhost:4200",
  });
  try {
    await provision(reviewerContext);
    const reviewer = await reviewerContext.newPage();
    await reviewer.goto("/");
    await sourceQueue(reviewer);
    await reviewer
      .getByRole("button", {
        name: `Conferir fonte: ${fixture.title}`,
        exact: true,
      })
      .click();
    await checkSource(reviewer);
    await unlink(fixture.file);
    await reviewer
      .getByRole("button", { name: "Verificar fonte", exact: true })
      .click();
    await expect(reviewer.getByRole("alert")).toContainText(
      "Arquivo da fonte indisponível",
    );
    await expect(
      reviewer.getByLabel("Parecer sobre a fonte", { exact: true }),
    ).toHaveValue(/Parecer sintético de teste/);
    await expect(
      reviewer.getByRole("checkbox", {
        name: "Conferi a integridade e a leitura do PDF arquivado.",
        exact: true,
      }),
    ).toBeChecked();
    await writeFile(fixture.file, fixture.bytes, { flag: "wx", mode: 0o600 });
    await reviewer
      .getByRole("button", { name: "Verificar fonte", exact: true })
      .click();
    await expect(reviewer.getByRole("status")).toContainText(
      "Fonte verificada.",
    );
  } finally {
    await reviewerContext.close();
  }
});

test("source metadata conflicts preserve edits until explicit reopen", async ({
  page,
  context,
  provision,
  source,
}) => {
  const importer = await provision(context);
  const fixture = await source(importer);
  await page.goto("/");
  await sourceQueue(page);
  await page
    .getByRole("button", {
      name: `Conferir fonte: ${fixture.title}`,
      exact: true,
    })
    .click();
  const remote = await context.request.put(
    `/api/curation/sources/${fixture.id}`,
    {
      data: {
        baseRevision: 1,
        title: "Metadados atualizados em outra aba",
        kind: "EXAM",
        year: 2021,
        area: "Ciência da Computação (fixture)",
        modality: "BACHARELADO",
      },
    },
  );
  expect(remote.status()).toBe(200);
  await page
    .getByLabel("Título do documento", { exact: true })
    .fill("Título local ainda não salvo");
  await page
    .getByRole("button", { name: "Salvar metadados", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("A fonte mudou");
  await expect(
    page.getByLabel("Título do documento", { exact: true }),
  ).toHaveValue("Título local ainda não salvo");
  await page
    .getByRole("button", { name: "Reabrir fonte", exact: true })
    .click();
  await expect(
    page.getByLabel("Título do documento", { exact: true }),
  ).toHaveValue("Metadados atualizados em outra aba");
});
