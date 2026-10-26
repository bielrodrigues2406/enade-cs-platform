import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: { baseURL: "http://localhost:4200", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
          args: ["--no-sandbox"],
        },
      },
    },
  ],
  webServer: [
    {
      command: "npm run dev:api",
      url: "http://127.0.0.1:3000/api/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev:web",
      timeout: 120000,
      url: "http://localhost:4200",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
