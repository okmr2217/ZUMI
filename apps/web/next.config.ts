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
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
});
