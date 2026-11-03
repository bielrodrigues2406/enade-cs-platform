import { test, expect } from "@playwright/test";

test("password visibility works at the top edge, by keyboard and touch without submitting", async ({ page, browser }) => {
  let submissions = 0;
  page.on("request", request => { if (/\/api\/auth\/(login|register)$/.test(request.url())) submissions++; });
  await page.goto("/perfil");
  const input = page.getByLabel("Senha", { exact: true });
  const toggle = page.locator(".password-toggle");
  await input.fill("TEST ONLY password stays intact");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const box = (await toggle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 5);
    await page.mouse.down();
    // Uma pressão humana dura tempo suficiente para aplicar o estado :active.
    await page.waitForTimeout(150);
    await page.mouse.up();
    await expect(input).toHaveAttribute("type", "text");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(input).toHaveAttribute("type", "password");
    await expect(input).toHaveValue("TEST ONLY password stays intact");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(submissions).toBe(0);
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  try {
    const phone = await context.newPage();
    await phone.goto("/perfil");
    await phone.getByLabel("Senha", { exact: true }).fill("TEST ONLY touch password");
    await phone.getByRole("button", { name: "Mostrar", exact: true }).tap();
    await expect(phone.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "text");
    await phone.emulateMedia({ reducedMotion: "reduce" });
    expect(await phone.locator(".account-form-side").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  } finally { await context.close(); }
});
