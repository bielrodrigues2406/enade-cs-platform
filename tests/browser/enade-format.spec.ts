import "dotenv/config";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { test, expect, type Page } from "@playwright/test";
import { formatFixture } from "../enade-format-fixture.js";
import { signUp } from "./session-helpers";

const pool=new Pool({connectionString:process.env.DATABASE_URL});
let fixture:Awaited<ReturnType<typeof formatFixture>>;
const owners=new Set<string>();
test.beforeAll(async()=>{ fixture=await formatFixture(pool); });
test.afterEach(async({page})=>{ await rememberOwner(page); });
test.afterAll(async()=>{ try { await fixture?.cleanup([...owners]); } finally { await pool.end(); } });
async function rememberOwner(page:Page) {
  const cookie=(await page.context().cookies()).find(c=>c.name==="enade_session");
  if (!cookie) return;
  const hash=createHash("sha256").update(cookie.value).digest("hex");
  const row=(await pool.query("SELECT identity_id FROM browser_session WHERE token_hash=$1",[hash])).rows[0];
  if (row) owners.add(row.identity_id);
}

test("student takes the authored format, resumes its own draft and sees the standard only after finishing",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/provas");
  const offer=page.getByRole("region",{name:"Simulado no formato ENADE 2026"});
  await expect(offer).toContainText("Não é a prova oficial de 2026");
  await expect(offer).toContainText("15 objetivas"); await expect(offer).toContainText("30 objetivas + 1 discursiva");
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    await expect(offer.getByRole("button",{name:"Começar simulado no formato 2026"})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/format-offer-${width}.png`,fullPage:true});
  }
  await offer.getByRole("button",{name:"Começar simulado no formato 2026"}).click();
  await page.getByRole("dialog",{name:"Começar o simulado no formato 2026?"}).getByRole("button",{name:"Começar simulado",exact:true}).click();
  await expect(page.getByText(/Questão 1 de 45/)).toBeVisible();
  await expect(page.locator(".practice-clock time")).toHaveText(/^3:59:\d\d$/);
  await rememberOwner(page);
  const saved=page.waitForResponse(r=>r.url().endsWith("/items/1")&&r.request().method()==="PUT");
  await page.locator(".practice-options").getByRole("radio").first().check(); expect((await saved).status()).toBe(200);
  await page.getByRole("button",{name:/^Discursiva \d+$/}).click();
  const draft=page.waitForResponse(r=>r.url().endsWith("/discursive/response")&&r.request().method()==="PUT");
  await page.getByRole("textbox",{name:/Sua resposta para/}).fill("TEST ONLY: explico meu raciocínio nesta tentativa.");
  await expect(page.getByRole("button",{name:"Revisar e finalizar"})).toBeDisabled();
  expect((await draft).status()).toBe(200);
  await expect(page.getByText("Rascunho salvo",{exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Padrão de resposta",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Enviar e ver o padrão de resposta"})).toHaveCount(0);
  await page.getByRole("button",{name:"Pausar simulado",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Simulado pausado"})).toBeVisible();
  await page.getByRole("button",{name:"Continuar simulado",exact:true}).click();
  await page.getByRole("button",{name:/^Discursiva \d+$/}).click();
  await expect(page.getByRole("textbox",{name:/Sua resposta para/})).toHaveValue("TEST ONLY: explico meu raciocínio nesta tentativa.");
  await page.getByRole("button",{name:"Revisar e finalizar"}).click();
  await page.getByRole("dialog",{name:"Finalizar o simulado?"}).getByRole("button",{name:"Finalizar simulado",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Desempenho no simulado"})).toBeVisible();
  await expect(page.locator(".practice-blocks")).toContainText("de 15");
  await expect(page.locator(".practice-blocks")).toContainText("de 30");
  await page.getByRole("button",{name:"Rever a discursiva desta tentativa"}).click();
  await expect(page.locator(".disc-sent")).toHaveText("TEST ONLY: explico meu raciocínio nesta tentativa.");
  await expect(page.getByRole("heading",{name:"Padrão de resposta",exact:true})).toBeVisible();
  await expect(page.getByText(/organize o raciocínio antes de enviar/)).toHaveCount(0);
  await expect(page.getByRole("textbox",{name:/Sua resposta para/})).toHaveCount(0);
  for (const button of await page.getByRole("radio",{name:"Contemplei",exact:true}).all()) await button.click();
  await page.getByRole("button",{name:"Salvar autoavaliação"}).click();
  await expect(page.getByText("Autoavaliação salva: 10,0 de 10.")).toBeVisible();
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    await expect(page.getByRole("heading",{name:"Padrão de resposta",exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/format-result-${width}.png`,fullPage:true});
  }
});

test("unavailable format reports the exact missing blocks and cannot start",async({page})=>{
  let starts=0;
  await page.route("**/api/formats/enade-2026",route=>route.fulfill({json:{
    format:{year:2026,general:15,specific:30,discursive:1,minutes:240},
    counts:{general:8,specific:20,discursive:0},missing:{general:7,specific:10,discursive:1},available:false,lastResult:null,
  }}));
  page.on("request",r=>{ if (r.url().endsWith("/formats/enade-2026/attempts")) starts++; });
  await page.setViewportSize({width:390,height:844}); await page.goto("/provas");
  const offer=page.getByRole("region",{name:"Simulado no formato ENADE 2026"});
  await expect(offer).toContainText("Faltam 7 de Formação Geral, 10 específicas e 1 discursiva específica");
  await expect(offer.getByRole("button",{name:"Começar simulado no formato 2026"})).toBeDisabled();
  await rememberOwner(page);
  expect(starts).toBe(0); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test("an unsaved free-study essay is guarded and never flushed into the guest after logout in another tab",async({page,context})=>{
  await signUp(context);
  const other=await context.newPage(); await other.goto("/");
  await page.clock.install();
  await page.goto("/questoes"); await rememberOwner(page);
  await page.getByRole("button",{name:"Discursivas",exact:true}).first().click();
  await page.getByRole("button",{name:/ENADE 2004 · Discursiva 3/}).click();
  const body=page.getByRole("textbox",{name:/Sua resposta para/});
  await page.route("**/api/discursive/*/response",route=>route.fulfill({status:503,json:{message:"TEST ONLY saving unavailable"}}));
  await body.fill("TEST ONLY private unsaved account essay");
  await page.getByRole("button",{name:"Início",exact:true}).first().click();
  await expect(page.getByRole("alert")).toContainText("TEST ONLY saving unavailable");
  await page.getByRole("button",{name:"Início",exact:true}).first().click();
  const warning=page.getByRole("dialog",{name:"Sair sem guardar o rascunho?"});
  await expect(warning).toBeVisible();
  await warning.getByRole("button",{name:"Continuar escrevendo"}).click();
  await page.unroute("**/api/discursive/*/response");
  expect((await context.request.post("/api/auth/logout",{data:{}})).status()).toBe(200);
  const refreshed=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/session");
  await other.evaluate(()=>{const channel=new BroadcastChannel("enade-identity");channel.postMessage({type:"identity-changed"});channel.close();});
  await refreshed; await page.clock.runFor(1000);
  await expect(page.getByRole("button",{name:"Entrar",exact:true}).first()).toBeVisible();
  const guest=await (await context.request.get(`/api/discursive/${fixture.discursive}`)).json();
  expect(guest.response?.body??"").toBe("");
  await other.close();
});
