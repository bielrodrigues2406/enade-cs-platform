import { expect, type Page } from "@playwright/test";

/** A mesma ação funciona no índice lateral e no painel do celular. */
/** O app liga logo depois do evento load: espera o Menu (celular) ou o índice (computador). */
async function studyEntry(page: Page) {
  const trigger = page.getByRole("button", { name: "Menu", exact: true });
  const nav = page.getByRole("navigation", { name: "Estudo", exact: true });
  await expect(trigger.or(nav).first()).toBeVisible();
  return { trigger, nav };
}

export async function navigateTo(page: Page, label: string) {
  const { trigger, nav } = await studyEntry(page);
  if (await trigger.isVisible() && !await page.locator(".navigation-drawer[open]").count()) await trigger.click();
  await expect(nav).toBeVisible();
  const link = nav.getByRole("link", { name: label, exact: true });
  if (["Biblioteca", "Conquistas", "Aulas"].includes(label) && !await link.isVisible()) await nav.getByText("Apoio", { exact: true }).click();
  await link.click();
}
export async function openAccountMenu(page: Page) {
  if (!await page.locator("#account-menu:popover-open").count()) await page.getByRole("button", { name: /^Abrir conta,/ }).click();
}
export async function openProfile(page: Page) {
  await openAccountMenu(page);
  await page.getByRole("button", { name: "Meu perfil", exact: true }).click();
}
export async function logout(page: Page) {
  await openAccountMenu(page);
  await page.getByRole("button", { name: "Sair da conta", exact: true }).click();
}

/** No celular a saída é o botão Menu; no computador, o destino do índice. */
export async function navigationControl(page: Page, label: string) {
  const { trigger } = await studyEntry(page);
  return await trigger.isVisible()
    ? trigger
    : page.getByRole("navigation", { name: "Estudo", exact: true }).getByRole("link", { name: label, exact: true });
}
