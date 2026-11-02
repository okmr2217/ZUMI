import * as Sentry from "@sentry/nextjs";

// ブラウザ側の Sentry 初期化。Turbopack ビルドでは `sentry.client.config.ts` が
// 読み込まれないため、Next.js の `instrumentation-client.ts` で行う。
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // ビルド時に埋め込まれる（本番は deploy.yml のビルドの env で "production" を渡す）。
  // 未設定のビルドを本番のエラーと混ぜないよう、Sentry の既定の "production" には任せない
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
