import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { fail } from "./api-error.js";
const params = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const MAX_CONCURRENT = 2;
const MAX_QUEUED = 16;
const QUEUE_TIMEOUT_MS = 5000;
let activeDerivations = 0;
const waitQueue: Array<{ resume: () => void; reject: (err: unknown) => void }> = [];

async function acquireSlot(): Promise<void> {
  if (activeDerivations < MAX_CONCURRENT) {
    activeDerivations++;
    return;
  }
  if (waitQueue.length >= MAX_QUEUED) {
    fail("O acesso está ocupado. Tente novamente em instantes.", 503);
  }
  await new Promise<void>((resolve, reject) => {
    const entry = {
      resume: () => {
        clearTimeout(timer);
        resolve();
      },
      reject,
    };
    const timer = setTimeout(() => {
      const idx = waitQueue.indexOf(entry);
      if (idx !== -1) waitQueue.splice(idx, 1);
      try {
        fail("O acesso está ocupado. Tente novamente em instantes.", 503);
      } catch (err) {
        reject(err);
      }
    }, QUEUE_TIMEOUT_MS);
    timer.unref?.();
    waitQueue.push(entry);
  });
}

function releaseSlot() {
  const next = waitQueue.shift();
  if (next) {
    next.resume();
  } else {
    activeDerivations--;
  }
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  // Limita o pico de memória do scrypt a ~256 MiB neste processo, enfileirando picos curtos de turma.
  await acquireSlot();
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(password, salt, 32, params, (err, key) =>
        err ? reject(err) : resolve(key),
      ),
    );
  } finally {
    releaseSlot();
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
