import * as Sentry from "@sentry/nextjs";

// Cloudflare Workers 上（OpenNext のミドルウェア/エッジランタイム）で動く分。
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
