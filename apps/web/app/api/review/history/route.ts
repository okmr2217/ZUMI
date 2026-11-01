import { NextResponse } from "next/server";
import { toLocalDate } from "@zumi/types";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getUserCalendar } from "@/lib/duties";
import { unauthorized } from "@/lib/duty-api";
import { isLocalDate } from "@/lib/log-input";
import { loadHistory } from "@/lib/review";

export const dynamic = "force-dynamic";

/**
 * 振り返りタブの履歴（無限スクロールの続き・Duty での絞り込み）。
 * `?before=YYYY-MM-DD` より前を `HISTORY_PAGE_DAYS` 日分返す。`?duty=<id>` で絞り込む。
 * 無料プランの範囲（直近3ヶ月）より前は返さない。
 */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const params = new URL(request.url).searchParams;
  const before = params.get("before") ?? undefined;
  const dutyId = params.get("duty") ?? undefined;
  if (before !== undefined && !isLocalDate(before)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const db = getDb();
  const { timeZone } = await getUserCalendar(db, session.user.id);
  const today = toLocalDate(new Date(), timeZone);
  return NextResponse.json(
    await loadHistory(db, session.user.id, { today, before, dutyId }, timeZone),
  );
}
