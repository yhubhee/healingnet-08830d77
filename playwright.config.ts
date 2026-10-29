import { defineConfig, devices } from "@playwright/test";
import "./e2e/env";

// The tests run against the live Supabase project, so they run one at a time:
// several tests share the same patient, doctor and hospital accounts.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: "e2e/results/results.json" }], ["html", { open: "never", outputFolder: "e2e/results/html" }]],
  outputDir: "e2e/results/artifacts",
  use: {
    baseURL: "http://localhost:8080",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Booking asks for location; deny it so runs are repeatable.
    permissions: [],
    timezoneId: "Africa/Lagos",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 }, hasTouch: true },
    },
  ],
});
