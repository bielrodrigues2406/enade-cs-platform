import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Revisão do Codex (R1): na imagem Docker não existe apps/web/public; as figuras
// ficam em WEB_DIST. Este teste reproduz esse layout: muda para uma pasta sem a
// árvore de fontes, aponta WEB_DIST para uma cópia dos arquivos públicos e
// carrega as questões geradas e as lições como o servidor faria.

const repo = process.cwd();
const runtime = mkdtempSync(path.join(tmpdir(), "enade-runtime-"));
const web = path.join(runtime, "web");
cpSync(path.join(repo, "apps/web/public/figures"), path.join(web, "figures"), { recursive: true });
cpSync(path.join(repo, "apps/web/public/illustrations"), path.join(web, "illustrations"), { recursive: true });
process.env.WEB_DIST = web;
process.env.STUDY_CONTENT_DIR = path.join(repo, "data");
process.chdir(runtime);

test("figures and lessons load from WEB_DIST when the source tree is absent", async (t) => {
  t.after(() => { process.chdir(repo); rmSync(runtime, { recursive: true, force: true }); });
  const { publicAssetExists } = await import("../apps/api/src/public-assets.js");
  assert.ok(publicAssetExists("/figures/gen-alg-abb-degenerada.svg"));
  assert.ok(publicAssetExists("/illustrations/MET-05.webp"));
  assert.ok(!publicAssetExists("/figures/nao-existe.svg"));

  const { parseGeneratedFile } = await import("../apps/api/src/generated-publication.js");
  const algorithms = JSON.parse(readFileSync(path.join(repo, "data/generated-questions/algoritmos.json"), "utf8"));
  assert.ok(parseGeneratedFile(algorithms, "algoritmos.json").questions.some((q) => q.figure));

  const { loadCore } = await import("../apps/api/src/core-concepts.js");
  const { loadLessons } = await import("../apps/api/src/core-lessons.js");
  const lessons = await loadLessons((await loadCore()).areas);
  assert.equal(lessons.get("algoritmos")?.lessons.get("alg-busca")?.figure?.src, "/illustrations/MET-05.webp");
});
