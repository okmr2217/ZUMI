import * as Sentry from "@sentry/nextjs";

// Next.js 16 の proxy は Node.js ランタイム固定で、OpenNext Cloudflare も
// Edge ランタイムをサポートしないため、サーバー側の初期化は nodejs の分だけ行う。
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

// Server Component・Route Handler・proxy で投げられたエラーを Sentry に送る。
export const onRequestError = Sentry.captureRequestError;
