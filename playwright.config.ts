import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  workers: 1,
  timeout: 120000,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  reporter: "list",
  webServer: {
    command: "node --import tsx tests/ui-server.ts",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
