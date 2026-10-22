import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { fail } from "./api-error.js";
const params = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
let activeDerivations = 0;
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  // Bound peak memory to ~256 MiB of scrypt working sets for this API process.
  if (activeDerivations >= 2)
    fail("O acesso está ocupado. Tente novamente em instantes.", 503);
  activeDerivations++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(password, salt, 32, params, (err, key) =>
        err ? reject(err) : resolve(key),
      ),
    );
  } finally {
    activeDerivations--;
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$131072$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored?: string) {
  // Unknown accounts perform the same derivation and return the same error message.
  const parts = stored?.split("$");
  const salt =
    parts?.length === 6 ? Buffer.from(parts[4], "hex") : Buffer.alloc(16);
  const expected =
    parts?.length === 6 ? Buffer.from(parts[5], "hex") : Buffer.alloc(32);
  const key = await derive(password, salt);
  return timingSafeEqual(key, expected) && !!stored;
}
