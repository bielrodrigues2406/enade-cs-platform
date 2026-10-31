import { randomUUID } from "node:crypto";
import { expect, type BrowserContext } from "@playwright/test";

// O início de quem tem conta é o painel de estudo; visitantes veem a página
// pública. Os testes do painel criam uma conta TEST ONLY nesta sessão.
export async function signUp(context: BrowserContext) {
  expect((await context.request.post("/api/session", { data: {} })).status()).toBe(201);
  const response = await context.request.post("/api/auth/register", {
    data: { email: `home-${randomUUID()}@example.invalid`, password: "Painel teste 2026!" },
  });
  expect(response.status()).toBe(201);
}
