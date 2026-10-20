import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Satış ekranı birim testleri (jsdom): API istemcisi ve biçimlendirme yardımcıları.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
  },
});
