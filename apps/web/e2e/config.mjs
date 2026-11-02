// E2E のサーバーとテストで共有する値。`playwright.config.ts`・`e2e/start-server.mjs`・各テストから読む。

// better-auth の Cookie はポートで分かれないため、開発用の dev サーバー（`<セッション名>.localhost`）と
// 別のホスト名にする（CLAUDE.md「ローカルの dev サーバー」）。Chrome は `*.localhost` を 127.0.0.1 に解決する
export const E2E_HOST = process.env.E2E_HOST ?? "e2e.localhost";
export const E2E_PORT = Number(process.env.E2E_PORT ?? 8790);
export const E2E_BASE_URL = `http://${E2E_HOST}:${E2E_PORT}`;

// テスト専用の値（本番・開発では使わない）。確認メールのトークンをテスト側で同じ鍵で署名する
export const E2E_AUTH_SECRET = "zumi-e2e-only-secret-not-for-production-0123456789";

// 今日・週の区切りがテストの途中で変わりにくいよう、ブラウザのタイムゾーンを固定する
// （`TimezoneSync` がこの値をユーザーのタイムゾーンとして保存する）
export const E2E_TIMEZONE = "Asia/Tokyo";
