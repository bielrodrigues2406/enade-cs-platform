import { ConfigError, createApp, db } from "./main.js";
import { grantConfiguredAdmins } from "./roles.js";
import { purgeOldActivity } from "./activity.js";
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
  // Conexões lentas de propósito (slowloris) não seguram o servidor: cabeçalhos
  // em 20 s e a requisição inteira em 2 min (o envio de PDFs de importação cabe).
  const server = app.getHttpServer();
  server.headersTimeout = 20_000;
  server.requestTimeout = 120_000;
  // Registro de atividades: apaga o que passou do prazo de guarda, ao iniciar e a cada dia.
  await purgeOldActivity();
  setInterval(() => void purgeOldActivity().catch(() => undefined), 24 * 3600_000).unref();
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
