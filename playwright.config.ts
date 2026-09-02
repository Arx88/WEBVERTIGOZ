import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3005",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3005",
    url: "http://localhost:3005",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
