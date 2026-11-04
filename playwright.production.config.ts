import { defineConfig } from "@playwright/test";
import path from "node:path";

// O navegador usa o build otimizado servido pela própria API, com a CSP real.
// HTTP local permite exercitar a sessão sem o proxy HTTPS da implantação.
export default defineConfig({
  testDir: "./tests/production",
  workers: 1,
  reporter: process.env.CI ? [["dot"], ["github"]] : [["list"]],
  use: {
    baseURL: "http://localhost:4300", trace: "retain-on-failure", viewport: { width: 1440, height: 960 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] },
  },
  webServer: {
    command: "npm run dev:api",
    url: "http://127.0.0.1:4300/api/health",
    reuseExistingServer: false,
    env: { NODE_ENV: "test", PORT: "4300", HOST: "127.0.0.1", APP_ORIGIN: "http://localhost:4300", WEB_DIST: path.resolve("dist/web/browser") },
  },
});
