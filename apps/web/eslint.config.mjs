import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextCoreWebVitals,
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      // e2e/wrangler.e2e.toml で起動すると e2e/.wrangler にも一時ファイルができる
      "**/.wrangler/**",
      "node_modules/**",
      "next-env.d.ts",
      // Playwright の実行結果（npm run test:e2e）
      "test-results/**",
      "playwright-report/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
