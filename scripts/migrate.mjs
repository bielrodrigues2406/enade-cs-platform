import "dotenv/config";
import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(67124301)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migration (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    // O hash ignora o tipo de quebra de linha: um checkout no Windows (CRLF)
    // não pode parecer uma migration alterada.
    const sql = (await readFile("migrations/" + name, "utf8")).replace(/\r\n/g, "\n");
    const checksum = sha256(sql);
    const existing = await client.query(
      "SELECT checksum FROM schema_migration WHERE name=$1",
      [name],
    );
    if (existing.rowCount) {
      const stored = existing.rows[0].checksum;
      if (stored === checksum) continue;
      // Banco migrado antes desta regra a partir de arquivos com CRLF: mesmo
      // conteúdo, só as quebras mudam. Atualiza o hash guardado e segue.
      if (stored === sha256(sql.replace(/\n/g, "\r\n"))) {
        await client.query("UPDATE schema_migration SET checksum=$2 WHERE name=$1", [name, checksum]);
        continue;
      }
      throw new Error("Migration aplicada foi alterada: " + name);
    }
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migration(name,checksum) VALUES ($1,$2)",
      [name, checksum],
    );
    console.log("Migration aplicada:", name);
  }
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  throw err;
} finally {
  await client.end();
}
