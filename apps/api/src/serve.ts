import { ConfigError, createApp, db } from "./main.js";
import { grantConfiguredAdmins } from "./roles.js";
try {
  const app = await createApp();
  // ADMIN_EMAILS: contas já existentes recebem o papel de administrador.
  await grantConfiguredAdmins();
  app.enableShutdownHooks();
  // Loopback por padrão; em contêiner, HOST=0.0.0.0 atrás do proxy do provedor.
  await app.listen(
    Number(process.env.PORT || 3000),
    process.env.HOST || "127.0.0.1",
  );
  for (const event of ["SIGTERM", "SIGINT"] as const)
    process.once(event, async () => {
      await app.close();
      await db.end();
    });
} catch (err) {
  console.error(
    err instanceof ConfigError
      ? err.message
      : "Não foi possível iniciar a API. Confira banco e configuração.",
  );
  process.exitCode = 1;
}
