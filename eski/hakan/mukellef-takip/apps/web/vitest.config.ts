import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Web birim testleri (jsdom): API istemcisi, içerik tutarlılığı, kabuk yardımcıları.
// Sayfaların gerçek tarayıcıda çalışma anı ve duyarlılık testleri: e2e/ (Playwright).
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
  },
});
