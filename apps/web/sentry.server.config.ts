import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // NEXT_PUBLIC_* はサーバーのバンドルにもビルド時に埋め込まれる。本番は deploy.yml の
  // ビルドの env で "production" を渡す（wrangler.toml の [vars] の値は頼らない）
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.SENTRY_DSN),
});
