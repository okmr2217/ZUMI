import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT, E2E_TIMEZONE } from "./e2e/config.mjs";

/**
 * 主要フローの E2E（docs/09「横断: QA・リリース準備」）。ルートの `npm run test:e2e` から実行する。
 * サーバーは `e2e/start-server.mjs` が、作り直したローカル D1 と本番と同じビルド（wrangler dev）で起動する。
 */
export default defineConfig({
  testDir: "./e2e",
  // vitest の `*.test.ts` と混ざらないよう、拡張子を分ける
  testMatch: "**/*.e2e.ts",
  // 1つのサーバー・D1 を共有し、ユーザーはテストごとに作る。CI の 2 コアで詰まらないよう並列数を絞る
  workers: process.env.CI ? 1 : 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_BASE_URL,
    locale: "ja-JP",
    timezoneId: E2E_TIMEZONE,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "node e2e/start-server.mjs",
    // Node は `*.localhost` を名前解決できないことがあるため、起動の確認は 127.0.0.1 で行う
    url: `http://127.0.0.1:${E2E_PORT}/login`,
    // ビルド（約1〜2分）を含む
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
  },
});
