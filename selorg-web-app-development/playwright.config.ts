import { defineConfig, devices } from "@playwright/test";

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:3333";
const WEB_BASE = process.env.WEB_BASE_URL || "http://127.0.0.1:3000";

/**
 * Automation audit suite — hits the real selorg-service + Next.js webapp.
 * Does not start servers; expects both to already be running.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/playwright-report.json" }],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  outputDir: "test-results/artifacts",
  use: {
    baseURL: WEB_BASE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    extraHTTPHeaders: {
      Accept: "application/json",
    },
  },
  projects: [
    {
      name: "api",
      testMatch: /api\/.*\.spec\.ts/,
      use: {
        baseURL: API_BASE,
      },
    },
    {
      name: "e2e-chromium",
      testMatch: /flows\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: WEB_BASE,
      },
    },
  ],
  metadata: {
    apiBaseUrl: API_BASE,
    webBaseUrl: WEB_BASE,
    customerPrefix: "/api/v1/customer",
  },
});
