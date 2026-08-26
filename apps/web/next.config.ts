import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

// Cloudflare Workers 上でのローカル開発時に `getCloudflareContext` 等が
// 使えるよう、@opennextjs/cloudflare の dev バインディング初期化を行う。
// 本番ビルドには影響しない（dev 時のみ動作）。
initOpenNextCloudflareForDev();

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    // Sentryへアップロード後、ビルド成果物からソースマップを削除する。
    // 削除しないと .open-next/assets 経由で本番サイトから .js.map が
    // 誰でも閲覧できる状態でホスティングされてしまう。
    deleteSourcemapsAfterUpload: true,
  },
});
