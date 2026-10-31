// Atribui ou remove o papel de administrador pelo servidor (D14). Uso único
// para o primeiro administrador; os demais papéis são dados pela tela.
//   npm run admin:role -- grant|revoke pessoa@exemplo.edu.br
import { db } from "../apps/api/src/database.js";
import { authorize, parseEmail, revoke } from "../apps/api/src/roles.js";

const [operation, emailArg, ...extra] = process.argv.slice(2);
const client = await db.connect();
try {
  if (!["grant", "revoke"].includes(operation) || extra.length)
    throw new Error("Uso: npm run admin:role -- grant|revoke <e-mail da conta>");
  const email = parseEmail(emailArg);
  await client.query("BEGIN");
  if (operation === "grant") await authorize(client, email, "ADMIN", null);
  else await revoke(client, email, "ADMIN", null);
  await client.query("COMMIT");
  console.log(operation === "grant" ? `Administrador: ${email}.` : `Acesso de administrador removido: ${email}.`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(error instanceof Error ? error.message : "Não foi possível alterar o papel.");
  process.exitCode = 1;
} finally {
  client.release();
  await db.end();
}
