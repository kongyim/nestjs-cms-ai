import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60000,
  use: {
    baseURL: process.env.WEB_URL ?? "http://localhost:3000",
    headless: true,
    actionTimeout: 10000,
    trace: "retain-on-failure",
  },
  reporter: "list",
});
