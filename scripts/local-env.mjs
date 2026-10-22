import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
// Local disposable development database only. Never overwrite existing configuration.
if (!existsSync(".env")) {
  const password = randomBytes(24).toString("hex");
  writeFileSync(
    ".env",
    `POSTGRES_PASSWORD=${password}\nDATABASE_URL=postgresql://enade:${password}@127.0.0.1:5432/enade\nAPP_ORIGIN=http://localhost:4200\n`,
    { mode: 0o600, flag: "wx" },
  );
}
