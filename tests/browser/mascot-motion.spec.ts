import { test, expect, type Locator, type Route } from "@playwright/test";

/** Amostra o movimento real do navegador sem depender do instante da captura. */
async function sampleGesture(image: Locator) {
  return image.evaluate(el => {
    const animation = el.getAnimations().find((item): item is CSSAnimation => item instanceof CSSAnimation);
    if (!animation?.effect) throw new Error("O gesto não começou depois de carregar a imagem.");
    animation.pause();
    const timing = animation.effect.getComputedTiming();
    const footprintBefore = el.parentElement!.getBoundingClientRect().toJSON();
    animation.currentTime = Number(timing.duration) / 2;
    const moving = getComputedStyle(el).transform;
    const footprintDuring = el.parentElement!.getBoundingClientRect().toJSON();
    animation.currentTime = Number(timing.duration);
    const resting = getComputedStyle(el).transform;
    // Mantém o gesto em andamento para exercitar teclado e redução de movimento.
    animation.currentTime = Number(timing.duration) / 2;
    return { iterations: timing.iterations, duration: Number(timing.duration), moving, resting,
      restingIsIdentity: new DOMMatrix(resting).isIdentity, footprintBefore, footprintDuring };
  });
}

test("Dudu waits for every layer, waves, nods and blinks without blocking the form", async ({ page }) => {
  let pendingImage: Route | undefined;
  await page.route("**/mascot/articulated/head.webp", route => { pendingImage = route; });
  await page.goto("/questoes");
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  const figure = page.locator("app-account app-dudu-figure");
  const wing = figure.locator(".wing-left");
  await expect.poll(() => !!pendingImage).toBe(true);
  await expect(figure.locator(".fallback")).toBeVisible();
  expect(await figure.locator(".layers").evaluate(el => getComputedStyle(el).opacity)).toBe("0");
  expect(await wing.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  const email = page.getByRole("textbox", { name: "E-mail", exact: true });
  await email.focus();
  await page.keyboard.type("aluno@example.invalid");
  await expect(email).toHaveValue("aluno@example.invalid");
  await pendingImage!.continue();
  await expect(figure).toHaveClass(/ready/);
  await expect(figure.locator(".fallback")).toBeHidden();
  const gesture = await sampleGesture(wing);
  expect(gesture.iterations).toBe(1);
  expect(gesture.duration).toBeGreaterThanOrEqual(1000);
  expect(gesture.duration).toBeLessThanOrEqual(1200);
  expect(gesture.moving).not.toBe(gesture.resting);
  expect(gesture.restingIsIdentity).toBe(true);
  expect(gesture.footprintDuring).toEqual(gesture.footprintBefore);
  const nod = await sampleGesture(figure.locator(".head-group"));
  expect(nod.moving).not.toBe(nod.resting);
  await figure.evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => {
    if (!(animation instanceof CSSAnimation)) return;
    animation.pause(); animation.currentTime = Number(animation.effect!.getComputedTiming().duration) * 0.7;
  }));
  expect(await figure.locator(".eyes-open").evaluate(el => getComputedStyle(el).opacity)).toBe("0");
  expect(await figure.locator(".eyes-closed").evaluate(el => getComputedStyle(el).opacity)).toBe("1");
  expect(await figure.locator(".eyes-closed").evaluate(el => {
    const box = el.getBoundingClientRect();
    const topImage = document.elementsFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      .find(candidate => candidate instanceof HTMLImageElement && el.closest("app-dudu-figure")!.contains(candidate));
    return !!topImage?.closest(".eyes-closed");
  })).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await figure.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await figure.locator(".eyes-open").evaluate(el => getComputedStyle(el).opacity)).toBe("1");
  expect(await figure.locator(".eyes-closed").evaluate(el => getComputedStyle(el).opacity)).toBe("0");
  await expect(email).toHaveValue("aluno@example.invalid");
});

test("a missing layer preserves the static duck and the account controls", async ({ page }) => {
  await page.route("**/mascot/articulated/left-wing.webp", route => route.fulfill({ status: 503, body: "" }));
  await page.goto("/questoes");
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  const figure = page.locator("app-account app-dudu-figure");
  await expect(figure.locator(".fallback")).toBeVisible();
  await expect(figure).not.toHaveClass(/ready/);
  expect(await figure.locator(".layers").evaluate(el => getComputedStyle(el).opacity)).toBe("0");
  await page.getByRole("textbox", { name: "E-mail", exact: true }).fill("teste@example.invalid");
  await expect(page.getByRole("button", { name: "Entrar", exact: true }).last()).toBeEnabled();
});

test("hidden Dudu does not request the articulated layers", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => { if (request.url().includes("/mascot/articulated/")) requests.push(request.url()); });
  await page.goto("/questoes");
  await page.getByRole("button", { name: "Ocultar Dudu", exact: true }).click();
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Entrar", exact: true })).toBeVisible();
  await expect(page.locator("app-dudu-figure")).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("Dudu celebrates once and immediately stops when reduced motion is enabled", async ({ page }) => {
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
  expect(gesture.duration).toBeGreaterThanOrEqual(1000);
  expect(gesture.duration).toBeLessThanOrEqual(1200);
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
  expect((await context.request.post("/api/session", { data: {} })).status()).toBe(201);
  expect((await context.request.put("/api/me/goal", { data: { dailyTarget: 1 } })).ok()).toBe(true);
  await page.goto("/questoes");
  await page.getByRole("button", { name: "Resolver: Quando uma transação falha" }).click();
  await page.getByRole("radio", { name: /Atomicidade/ }).check();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  const toast = page.locator(".toast");
  await expect(toast).toContainText("Meta do dia batida");
  const figure = toast.locator("app-dudu-figure");
  await expect(figure).toHaveClass(/ready/);
  for (const selector of [".wing-left", ".wing-right", ".layers"]) {
    const gesture = await sampleGesture(figure.locator(selector));
    expect(gesture.iterations).toBe(1);
    expect(gesture.moving).not.toBe(gesture.resting);
  }
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
