import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // NEXT_PUBLIC_* はサーバーのバンドルにもビルド時に埋め込まれる。埋め込まれなければ
  // 実行時の値（OpenNext が wrangler.toml の [vars] から process.env に入れる）を読む
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.SENTRY_DSN),
});
