import { createApp, db } from "./main.js";
try {
  const app = await createApp();
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000), "127.0.0.1");
  for (const event of ["SIGTERM", "SIGINT"] as const)
    process.once(event, async () => {
      await app.close();
      await db.end();
    });
} catch {
  console.error(
    "Não foi possível iniciar a API. Confira banco e configuração.",
  );
  process.exitCode = 1;
}
