import { test, expect, type Locator, type Route } from "@playwright/test";
import { signUp } from "./session-helpers";

/** Amostra o movimento real do navegador sem depender do instante da captura. */
async function sampleGesture(image: Locator) {
  return image.evaluate(el => {
    const animation = el.getAnimations()[0];
    if (!animation?.effect) throw new Error("O gesto não começou depois de carregar a imagem.");
    animation.pause();
    const timing = animation.effect.getComputedTiming();
    animation.currentTime = Number(timing.duration) / 2;
    const moving = getComputedStyle(el).transform;
    animation.currentTime = Number(timing.duration);
    const resting = getComputedStyle(el).transform;
    return { iterations: timing.iterations, duration: Number(timing.duration), moving, resting,
      restingIsIdentity: new DOMMatrix(resting).isIdentity };
  });
}

test("Dudu waits for a slow image, greets once and leaves the form usable", async ({ page }) => {
  let pendingImage: Route | undefined;
  await page.route("**/mascot/acenando.webp", route => { pendingImage = route; });
  await page.goto("/questoes");
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  const image = page.locator("app-account app-mascot img");
  await expect.poll(() => !!pendingImage).toBe(true);
  expect(await image.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await pendingImage!.continue();
  await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => image.evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
  const email = page.getByRole("textbox", { name: "E-mail", exact: true });
  const before = await email.boundingBox();
  const gesture = await sampleGesture(image);
  expect(gesture.iterations).toBe(1);
  expect(gesture.duration).toBeLessThanOrEqual(700);
  expect(gesture.moving).not.toBe(gesture.resting);
  expect(gesture.restingIsIdentity).toBe(true);
  expect(await email.boundingBox()).toEqual(before);
  await email.focus();
  await page.keyboard.type("aluno@example.invalid");
  await expect(email).toHaveValue("aluno@example.invalid");
});

test("Dudu celebrates once and immediately stops when reduced motion is enabled", async ({ page, context }) => {
  await signUp(context);
  await page.goto("/questoes");
  await page.getByRole("button", { name: "Resolver: Quando uma transação falha" }).click();
  await expect(page.locator("article app-mascot:not([hidden])")).toHaveCount(0);
  await page.getByRole("radio", { name: /Atomicidade/ }).check();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  const toast = page.locator(".toast");
  await expect(toast).toContainText("Primeiro passo");
  const image = toast.locator("app-mascot img");
  await expect.poll(() => image.evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
  const gesture = await sampleGesture(image);
  expect(gesture.iterations).toBe(1);
  expect(gesture.duration).toBeLessThanOrEqual(700);
  expect(gesture.moving).not.toBe(gesture.resting);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await image.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await toast.getByRole("button", { name: "Fechar aviso" }).focus();
  await page.keyboard.press("Enter");
  await expect(toast).toHaveCount(0);
});

test("the loading duck floats only while waiting and respects reduced motion", async ({ page }) => {
  let session: Route | undefined;
  await page.route("**/api/session", route => { session = route; });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Preparando seu caderno…", { exact: true })).toBeVisible();
  const image = page.locator("app-mascot img");
  await expect.poll(() => image.evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
  expect(await image.evaluate(el => el.getAnimations()[0].effect!.getComputedTiming().iterations)).toBe(Infinity);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await image.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  await session!.continue();
  await expect(page.getByText("Preparando seu caderno…", { exact: true })).toHaveCount(0);
  await expect(page.locator('app-mascot img[src$="boiando.webp"]')).toHaveCount(0);
});

test("consecutive medals each get a gesture without losing the close button's keyboard focus", async ({ page, context }) => {
  await signUp(context);
  expect((await context.request.put("/api/me/goal", { data: { dailyTarget: 1 } })).ok()).toBe(true);
  await page.goto("/questoes");
  await page.getByRole("button", { name: "Resolver: Quando uma transação falha" }).click();
  await page.getByRole("radio", { name: /Atomicidade/ }).check();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  const toast = page.locator(".toast");
  await expect(toast).toContainText("Meta do dia batida");
  await toast.getByRole("button", { name: "Fechar aviso" }).click();
  await expect(toast.locator(".toast-title")).toHaveText("Primeiro passo");
  const firstDuck = await toast.locator("app-mascot").elementHandle();
  const close = toast.getByRole("button", { name: "Fechar aviso" });
  await close.focus();
  await page.keyboard.press("Enter");
  await expect(toast.locator(".toast-title")).toHaveText("Meta do dia");
  expect(await firstDuck!.evaluate(el => el.isConnected)).toBe(false);
  await expect(close).toBeFocused();
  const image = toast.locator("app-mascot img");
  await expect.poll(() => image.evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
  expect((await sampleGesture(image)).iterations).toBe(1);
  await page.keyboard.press("Enter");
  await expect(toast).toHaveCount(0);
});
