import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { canonicalizeTimeZone, syncUserTimezone } from "@/lib/user-settings";

export const dynamic = "force-dynamic";

/**
 * アプリを開いたときにブラウザのタイムゾーンを保存する（`TimezoneSync` から呼ぶ）。
 * 「今日」の判定と通知の配信時刻がこの値を前提にする。
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const raw = body && typeof body === "object" && "timezone" in body ? body.timezone : undefined;
  const timezone = typeof raw === "string" && raw.length <= 64 ? canonicalizeTimeZone(raw) : null;
  if (!timezone) {
    return NextResponse.json({ error: "invalid timezone" }, { status: 400 });
  }

  await syncUserTimezone(session.user.id, timezone);
  return new NextResponse(null, { status: 204 });
}
