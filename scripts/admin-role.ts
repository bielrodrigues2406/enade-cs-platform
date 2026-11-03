// Atribui ou remove o papel de administrador, redefine senha ou exclui conta pelo servidor (D14).
// Uso no desenvolvimento ou no contêiner de produção:
//   npm run admin:role -- grant|revoke <e-mail>
//   npm run admin:role -- reset-password <e-mail> [nova-senha]
//   npm run admin:role -- delete-account <e-mail>
import { randomBytes, randomInt } from "node:crypto";
import { db } from "../apps/api/src/database.js";
import { credentials } from "../apps/api/src/auth.js";
import { hashPassword } from "../apps/api/src/password.js";
import { recordActivity } from "../apps/api/src/activity.js";
import { eraseAccountData } from "../apps/api/src/admin-accounts.js";
import { authorize, parseEmail, revoke } from "../apps/api/src/roles.js";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function generateReadablePassword() {
  const chars = Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

const [operation, emailArg, passwordArg, ...extra] = process.argv.slice(2);
const client = await db.connect();
try {
  const validSingleEmailOp =
    (operation === "grant" || operation === "revoke" || operation === "delete-account") &&
    passwordArg === undefined &&
    !extra.length;
  const validResetOp = operation === "reset-password" && !extra.length;
  if (!validSingleEmailOp && !validResetOp) {
    throw new Error(
      "Uso: npm run admin:role -- grant|revoke <e-mail> | reset-password <e-mail> [nova-senha] | delete-account <e-mail>",
    );
  }
  const email = parseEmail(emailArg);

  if (operation === "reset-password") {
    const plain = passwordArg ?? generateReadablePassword();
    const { password } = credentials({ email, password: plain });
    const encoded = await hashPassword(password);
    await client.query("BEGIN");
    const updated = await client.query<{ id: string }>(
      "UPDATE account SET password_hash=$2 WHERE email=$1 RETURNING identity_id AS id",
      [email, encoded],
    );
    if (!updated.rowCount) throw new Error("Não há conta com esse e-mail.");
    const revoked =
      (await client.query("DELETE FROM browser_session WHERE identity_id=$1", [updated.rows[0].id])).rowCount ?? 0;
    await recordActivity(client, {
      category: "ACCOUNT",
      action: "ADMIN_PASSWORD_RESET",
      actorId: null,
      subject: email,
      detail: `Redefinida no servidor (${revoked} sessão(ões) encerrada(s))`,
    });
    await client.query("COMMIT");
    console.log(`Senha redefinida para ${email} (${revoked} sessão(ões) encerrada(s)).`);
    if (passwordArg === undefined) console.log(`Nova senha temporária: ${plain}`);
  } else if (operation === "delete-account") {
    const disabledHash = await hashPassword(randomBytes(32).toString("hex"));
    await client.query("BEGIN");
    const target = (
      await client.query<{ id: string }>("SELECT identity_id AS id FROM account WHERE email=$1 FOR UPDATE", [email])
    ).rows[0];
    if (!target) throw new Error("Não há conta com esse e-mail.");
    const mode = await eraseAccountData(client, target.id, email, disabledHash, null, "Comando no servidor");
    await client.query("COMMIT");
    console.log(
      mode === "DELETED"
        ? `Conta e dados de estudo excluídos: ${email}.`
        : `Dados pessoais e de estudo excluídos (autoria institucional anonimizada): ${email}.`,
    );
  } else {
    await client.query("BEGIN");
    if (operation === "grant") await authorize(client, email, "ADMIN", null);
    else await revoke(client, email, "ADMIN", null);
    await client.query("COMMIT");
    console.log(operation === "grant" ? `Administrador: ${email}.` : `Acesso de administrador removido: ${email}.`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(error instanceof Error ? error.message : "Não foi possível concluir o comando.");
  process.exitCode = 1;
} finally {
  client.release();
  await db.end();
}
