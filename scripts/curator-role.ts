import { db } from "../apps/api/src/database.js";
const [operation, identityId, ...extra] = process.argv.slice(2);
if (
  !["grant", "revoke"].includes(operation) ||
  !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(identityId || "") ||
  extra.length
) {
  console.error(
    "Uso: npm run curator:role -- grant|revoke <identity-uuid>. Atribuição administrativa local, nunca por e-mail não verificado.",
  );
  process.exitCode = 1;
} else {
  try {
    if (operation === "grant") {
      const result = await db.query(
        "INSERT INTO curator_role(identity_id) SELECT identity_id FROM account WHERE identity_id=$1 ON CONFLICT DO NOTHING",
        [identityId],
      );
      const exists = await db.query(
        "SELECT 1 FROM curator_role WHERE identity_id=$1",
        [identityId],
      );
      if (!exists.rowCount) throw new Error("Conta não encontrada.");
      console.log(
        result.rowCount
          ? "Permissão de curadoria atribuída."
          : "A conta já possui permissão de curadoria.",
      );
    } else {
      await db.query("DELETE FROM curator_role WHERE identity_id=$1", [
        identityId,
      ]);
      console.log("Permissão de curadoria revogada.");
    }
  } catch {
    console.error(
      "Não foi possível alterar a permissão. Confira o UUID de uma conta existente e a conexão local.",
    );
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
