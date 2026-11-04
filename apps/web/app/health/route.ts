import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

/** D1 が応答しないとき、外形監視のタイムアウトより先に 503 を返すための待ち時間 */
const DB_TIMEOUT_MS = 3000;

/**
 * 外形監視（UptimeRobot など）から叩くヘルスチェック。Worker が動いていることに加え、
 * D1 に `SELECT 1` が通ることを確かめる。ログイン不要で誰でも叩けるため、
 * エラーの中身や設定値は返さず、詳しい原因は Sentry とログで追う。
 * notify の Cron は Sentry の Cron Monitor で別に見ているため、ここでは扱わない。
 */
export async function GET() {
  const db = await checkDb();
  const ok = db === "ok";
  return NextResponse.json(
    { status: ok ? "ok" : "error", checks: { db } },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

/** 監視サービスが HEAD で叩いてもステータスだけ返す */
export async function HEAD() {
  const response = await GET();
  return new NextResponse(null, { status: response.status, headers: response.headers });
}

async function checkDb(): Promise<"ok" | "error"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { env } = getCloudflareContext();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`D1 did not respond in ${DB_TIMEOUT_MS}ms`)),
        DB_TIMEOUT_MS,
      );
    });
    await Promise.race([env.DB.prepare("SELECT 1").first(), timeout]);
    return "ok";
  } catch (error) {
    console.error("health check: D1 failed", error);
    return "error";
  } finally {
    clearTimeout(timer);
  }
}
