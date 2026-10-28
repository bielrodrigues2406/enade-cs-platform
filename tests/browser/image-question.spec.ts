import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { test, expect } from "@playwright/test";

// Questão em imagem publicada pelo caminho ASSISTED (CT-1b). Fontes, imagem e
// questão são fixtures sintéticos marcados TEST ONLY; nada aqui reproduz
// conteúdo do Inep.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const assetDirectory =
  process.env.QUESTION_ASSET_DIR || path.resolve(".local/question-assets");
const fixture = {
  exam: randomUUID(),
  key: randomUUID(),
  question: `test-only-image-${randomUUID()}`,
  title: `TEST ONLY · Questão em imagem ${randomUUID().slice(0, 8)}`,
};
const version = `${fixture.question}-v1`;
let asset = { sha256: "", file: "", created: false };

test.beforeAll(async () => {
  const bytes = await readFile("tests/fixtures/test-only-question.webp");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const file = path.join(assetDirectory, sha256.slice(0, 2), `${sha256}.webp`);
  const created = !(await stat(file).catch(() => null));
  if (created) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }
  asset = { sha256, file, created };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [id, kind] of [
      [fixture.exam, "EXAM"],
      [fixture.key, "ANSWER_KEY"],
    ]) {
      const digest = createHash("sha256").update(`TEST ONLY ${id}`).digest("hex");
      await client.query(
        `INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,
           status,verification_origin,assisted_verifier,reviewed_at,is_final,key_finality)
         VALUES($1,$2,$3,$4,2026,'Ciência da Computação (fixture)','BACHARELADO',$5,64,2,
           'VERIFIED','ASSISTED','test-only-reviewer',now(),$6,$7)`,
        [
          id,
          `TEST ONLY ${kind} ${id.slice(0, 8)}`,
          `https://download.inep.gov.br/enade/test-fixtures/${id}.pdf`,
          kind,
          digest,
          kind === "ANSWER_KEY",
          kind === "ANSWER_KEY" ? "ONLY_PUBLISHED" : null,
        ],
      );
    }
    await client.query(
      "INSERT INTO question_asset(sha256,media_type,byte_size,width,height) VALUES($1,'image/webp',$2,760,240) ON CONFLICT DO NOTHING",
      [sha256, bytes.length],
    );
    await client.query(
      "INSERT INTO editorial_question(id,origin,official_exam_id,official_question_number) VALUES($1,'OFFICIAL',$2,7)",
      [fixture.question, fixture.exam],
    );
    await client.query(
      `INSERT INTO question_version(id,question_id,version_number,title,topic,prompt,origin,editorial_status,explanation,
         correct_option_id,author_credit,explanation_credit,exam_source_id,key_source_id,source_page,source_question_number,
         key_page,presentation,review_origin,assisted_extractor,assisted_reviewer)
       VALUES($1,$2,1,$3,'Redes','TEST ONLY: transcrição sintética.','OFFICIAL','DRAFT','','B','Inep','Sem explicação ainda',
         $4,$5,1,7,1,'IMAGE','ASSISTED','test-only-extractor','test-only-reviewer')`,
      [version, fixture.question, fixture.title, fixture.exam, fixture.key],
    );
    for (const [position, id] of ["A", "B", "C", "D", "E"].entries())
      await client.query(
        "INSERT INTO question_option(question_id,id,text,position) VALUES($1,$2,$3,$4)",
        [version, id, `TEST ONLY ${id}`, position],
      );
    await client.query(
      "INSERT INTO question_version_image(version_id,position,asset_sha256,source_page,box,dpi) VALUES($1,1,$2,1,'{30,60,410,186}',200)",
      [version, sha256],
    );
    await client.query(
      "UPDATE question_version SET editorial_status='PUBLISHED',reviewed_at=now() WHERE id=$1",
      [version],
    );
    await client.query(
      "UPDATE editorial_question SET current_version_id=$2 WHERE id=$1",
      [fixture.question, version],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

test.afterAll(async () => {
  try {
    await pool.query("DELETE FROM answer WHERE question_id=$1", [version]);
    await pool.query("DELETE FROM editorial_question WHERE id=$1", [
      fixture.question,
    ]);
    await pool.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])", [
      [fixture.exam, fixture.key],
    ]);
    if (asset.created) {
      await pool.query(
        "DELETE FROM question_asset a WHERE sha256=$1 AND NOT EXISTS(SELECT 1 FROM question_version_image i WHERE i.asset_sha256=a.sha256)",
        [asset.sha256],
      );
      await rm(asset.file, { force: true });
    }
  } finally {
    await pool.end();
  }
});

for (const width of [390, 1440]) {
  test(`image question: answer by letter, zoom and notices at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/questoes");
    await page.getByLabel("Buscar no caderno").fill(fixture.title);
    await page.getByRole("button", { name: "Filtrar", exact: true }).click();
    await page
      .getByRole("button", { name: `Resolver: ${fixture.title}` })
      .click();

    const image = page.getByRole("img", {
      name: "Questão 7 da prova ENADE 2026. O texto está na transcrição automática abaixo.",
    });
    await expect(image).toBeVisible();
    expect(
      await image.evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBe(760);
    await expect(page.getByText(/conferida por agentes; sem revisão humana/)).toBeVisible();

    // A transcrição fica recolhida; as alternativas são só letras.
    await expect(page.getByText("TEST ONLY: transcrição sintética.")).toBeHidden();
    await expect(
      page.getByRole("group", { name: "Marque a alternativa da imagem" }),
    ).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(5);

    // Ampliar abre o diálogo e Esc devolve o foco ao botão.
    const enlarge = page.getByRole("button", { name: "Ampliar" });
    await enlarge.click();
    const dialog = page.getByRole("dialog", { name: "Questão ampliada" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(enlarge).toBeFocused();

    await page.getByRole("radio", { name: "Alternativa C" }).check();
    await page.getByRole("button", { name: "Confirmar resposta" }).click();
    const feedback = page.getByRole("status");
    await expect(feedback).toContainText("Vamos entender este conceito.");
    await expect(feedback).toContainText("Alternativa correta: B");
    await expect(feedback).toContainText(
      "Ainda não há explicação para esta questão.",
    );
    await expect(page.getByText("Correta", { exact: true })).toBeVisible();
    await expect(page.getByText("Sua resposta", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Gabarito publicado pelo Inep:/ }),
    ).toBeVisible();
    await expect(feedback).toContainText(
      "O Inep não indicou este gabarito como definitivo",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    // Desfaz a resposta para a próxima largura começar sem histórico.
    await pool.query("DELETE FROM answer WHERE question_id=$1", [version]);
  });
}
