import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    include: ["{app,components,lib}/**/*.test.{ts,tsx}"],
    // DB を使うテストはファイルごとに Miniflare（workerd）を1つ立ち上げる。turbo で notify・db の
    // テストと並列に回ると CPU を取り合い、起動だけで十数秒かかることがあるため、同時に立ち上げる
    // 数を CPU の半分に抑え、準備とテスト本体のタイムアウトにも余裕を持たせる
    maxWorkers: "50%",
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
});
