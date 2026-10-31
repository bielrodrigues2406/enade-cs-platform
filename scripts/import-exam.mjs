// Processa um lote de importação de prova (IMP-1), fora da requisição HTTP:
// lê o texto do PDF, separa as questões, lê o gabarito e propõe a caixa de
// cada questão. Nada é publicado aqui; a pessoa confere na tela.
//   node scripts/import-exam.mjs <id do lote>
import "dotenv/config";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import pg from "pg";
import {
  classify,
  cropBoxes,
  detectGraphics,
  pageBands,
  parseAnswerKey,
  parseBboxHtml,
  parsePgm,
  segmentQuestions,
} from "./lib/question-extraction.mjs";

const run = promisify(execFile);
const RENDER_DPI = 100; // só para detectar figuras; o recorte final é 200 dpi
// Avisos do extrator em frases para quem confere a caixa na tela.
const WARNINGS = {
  figura: "Tem figura: confira se a caixa pega a figura inteira.",
  tabela: "Tem tabela: confira se a caixa pega todas as linhas.",
  codigo: "Tem código: confira se nenhuma linha ficou de fora.",
  "texto-ilegivel": "Parte do texto não foi lida; confira na página.",
  "numero-repetido": "Número repetido na prova: confira se é a questão certa.",
};
const archive = (sha) =>
  path.join(process.env.SOURCE_ARCHIVE_DIR || path.resolve(".local/sources"), `${sha}.pdf`);

async function graphicsByPage(file, pages, work) {
  const result = new Map();
  for (let p = 1; p <= pages.length; p++) {
    const prefix = path.join(work, `page-${p}`);
    await run("pdftoppm", ["-gray", "-r", String(RENDER_DPI), "-f", String(p), "-l", String(p), "-singlefile", file, prefix]);
    const image = parsePgm(await readFile(`${prefix}.pgm`));
    result.set(p, detectGraphics({ ...image, scale: RENDER_DPI / 72 }, pages[p - 1].words, pageBands(pages[p - 1])));
  }
  return result;
}

/**
 * Confere o lote antes da pessoa: o que não bate vira aviso e, quando o
 * gabarito tem um número que não apareceu no PDF, um item vazio para ela
 * desenhar a caixa. Nada é corrigido por suposição.
 */
export function checkBatch(items, answers, definitive) {
  const issues = [];
  const counts = new Map();
  for (const item of items) counts.set(item.key, (counts.get(item.key) ?? 0) + 1);
  for (const [key, count] of counts)
    if (count > 1) issues.push(`O número ${key.slice(1)} aparece ${count} vezes na prova; ficou só a primeira. Confira as caixas.`);
  const placeholders = [];
  for (const [key, answer] of answers) {
    if (!/^Q\d+$/.test(key) || answer === "DISCURSIVA" || counts.has(key)) continue;
    issues.push(`A questão ${key.slice(1)} está no gabarito mas não foi encontrada no PDF: desenhe a caixa dela.`);
    placeholders.push({ key, number: Number(key.slice(1)), kind: "OBJECTIVE", answer: /^[A-E]$|^ANULADA$/.test(answer) ? answer : null,
      boxes: [], prompt: "", options: [], warnings: ["Não encontrada automaticamente: desenhe a caixa na página certa."] });
  }
  for (const item of items)
    if (item.kind === "OBJECTIVE" && !item.answer) issues.push(`A questão ${item.number} não tem letra no gabarito.`);
  const annulled = [...answers.values()].filter((a) => a === "ANULADA").length;
  if (annulled) issues.push(`${annulled} questão(ões) anulada(s) pelo Inep: não entram no estudo.`);
  if (!definitive) issues.push("O gabarito não se declara definitivo. Confira no site do Inep se há versão definitiva antes de publicar.");
  return { issues, placeholders };
}

/** Proposta de itens a partir dos dois PDFs; não depende do catálogo fixo. */
export async function propose(examFile, keyFile) {
  const work = await mkdtemp(path.join(tmpdir(), "enade-import-"));
  try {
    const { stdout: html } = await run("pdftotext", ["-bbox", examFile, "-"], { maxBuffer: 64 * 1024 * 1024, timeout: 60000 });
    const pages = parseBboxHtml(html);
    const { stdout: keyText } = await run("pdftotext", ["-layout", keyFile, "-"], { timeout: 30000 });
    const { answers, definitive } = parseAnswerKey(keyText);
    const questions = segmentQuestions(pages, {});
    for (const question of questions)
      if (answers.get(question.key) === "DISCURSIVA") question.kind = "DISCURSIVE";
    const graphics = await graphicsByPage(examFile, pages, work);
    const items = classify(questions, { answers, definitive, graphicsByPage: graphics, symbolPages: new Set(), keyAvailable: true });
    const proposed = questions.map((question, index) => {
        const item = items[index];
        const answer = answers.get(question.key);
        return {
          key: question.key,
          number: question.number,
          kind: question.kind === "DISCURSIVE" ? "DISCURSIVE" : "OBJECTIVE",
          answer: answer === "ANULADA" || /^[A-E]$/.test(answer ?? "") ? answer : null,
          boxes: cropBoxes(question, pages, graphics).map(({ page, x0, y0, x1, y1 }) => ({ page, x0, y0, x1, y1 })),
          prompt: item.prompt ?? "",
          options: item.options ?? [],
          warnings: [
            ...(answer ? [] : ["Gabarito não encontrado para este número."]),
            ...(question.lines.map((l) => l.page).some((p, _, all) => p !== all[0]) ? ["A questão continua em outra página: confira as caixas em cada uma."] : []),
            ...(item.flags ?? []).flatMap((flag) => (WARNINGS[flag] ? [WARNINGS[flag]] : [])),
          ],
        };
      });
    const { issues, placeholders } = checkBatch(proposed, answers, definitive);
    return {
      pageSizes: pages.map((page) => ({ width: page.width, height: page.height })),
      definitive,
      issues,
      items: [...proposed, ...placeholders],
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function main(id) {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const batch = (await db.query("SELECT exam_sha256,key_sha256 FROM exam_import WHERE id=$1 AND state='PROCESSING'", [id])).rows[0];
    if (!batch) throw new Error("Lote não encontrado ou já processado.");
    try {
      const proposal = await propose(archive(batch.exam_sha256), archive(batch.key_sha256));
      if (!proposal.items.length) throw new Error("Nenhuma questão encontrada. O PDF tem texto selecionável?");
      await db.query("BEGIN");
      for (const item of proposal.items)
        await db.query(
          `INSERT INTO exam_import_item(import_id,question_key,number,kind,answer,key_answer,boxes,prompt,options,warnings)
           VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,$9) ON CONFLICT (import_id,question_key) DO NOTHING`,
          [id, item.key, item.number, item.kind, item.answer, JSON.stringify(item.boxes), item.prompt,
            JSON.stringify(item.options), item.warnings],
        );
      await db.query(
        "UPDATE exam_import SET state='READY',page_count=$2,page_sizes=$3,issues=$4,updated_at=now() WHERE id=$1",
        [id, proposal.pageSizes.length, JSON.stringify(proposal.pageSizes), JSON.stringify(proposal.issues)],
      );
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK").catch(() => undefined);
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      await db.query("UPDATE exam_import SET state='FAILED',failure=$2,updated_at=now() WHERE id=$1", [id, message]);
      throw error;
    }
  } finally {
    await db.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2] ?? "";
  if (!/^[a-f0-9-]{36}$/.test(id)) {
    console.error("Uso: node scripts/import-exam.mjs <id do lote>");
    process.exitCode = 1;
  } else {
    await main(id).catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  }
}
