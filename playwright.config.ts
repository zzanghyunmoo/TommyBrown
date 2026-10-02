import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/desktop",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  timeout: 45_000,
  reporter: [["list"], ["json", { outputFile: "test-results/desktop-report.json" }]],
});
