import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    include: ["{app,components,lib}/**/*.test.{ts,tsx}"],
    // Miniflare（D1）の起動に数秒かかるため
    hookTimeout: 30_000,
  },
});
