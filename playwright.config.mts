import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser", testMatch: "**/*.spec.ts", fullyParallel: false, workers: 1,
  use: { baseURL: "http://127.0.0.1:43179", browserName: "chromium", channel: process.env.PLINGER_BROWSER_CHANNEL === "chrome" ? "chrome" : undefined, viewport: { width: 1280, height: 900 }, screenshot: "only-on-failure" },
  webServer: { command: "node node_modules/vite/bin/vite.js --config tests/browser/vite.config.mts", url: "http://127.0.0.1:43179", reuseExistingServer: false, timeout: 60_000 },
  outputDir: "tmp/referral-browser-results",
});
