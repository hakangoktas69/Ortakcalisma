import { defineConfig, devices } from "@playwright/test";

// Arayüz regresyon testleri: çalışan yığına (Caddy) karşı, dört ekran boyutunda.
// Yerelde: npm run test:ui -w web (UI_BASE_URL, varsayılan http://localhost:8080). CI/`npm run verify`: Playwright container'ı.
const baseURL = process.env.UI_BASE_URL ?? "http://localhost:8080";

export const VIEWPORTS = {
  telefon: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1366, height: 768 },
  "buyuk-ekran": { width: 1920, height: 1080 },
} as const;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 60_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "./playwright-report" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    storageState: "./test-results/.auth/demo.json",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "telefon", use: { ...devices["iPhone 13"], viewport: VIEWPORTS.telefon, defaultBrowserType: "chromium" } },
    { name: "tablet", use: { viewport: VIEWPORTS.tablet, hasTouch: true } },
    { name: "laptop", use: { viewport: VIEWPORTS.laptop } },
    { name: "buyuk-ekran", use: { viewport: VIEWPORTS["buyuk-ekran"] } },
  ],
});
