import { NextResponse } from "next/server";
import { toLocalDate } from "@zumi/types";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getUserCalendar } from "@/lib/duties";
import { unauthorized } from "@/lib/duty-api";
import { isLocalDate } from "@/lib/log-input";
import { loadDays, MAX_DAYS_PER_REQUEST } from "@/lib/today-days";

export const dynamic = "force-dynamic";

/**
 * 今日タブの複数日ぶん。`?dates=YYYY-MM-DD,YYYY-MM-DD,…`（最大 `MAX_DAYS_PER_REQUEST` 日）。
 * 日付の移動を待たせないため、画面が表示日の前後をまとめて先読みするのに使う。
 */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const raw = new URL(request.url).searchParams.get("dates") ?? "";
  const dates = [...new Set(raw.split(",").filter(Boolean))];
  if (
    dates.length === 0 ||
    dates.length > MAX_DAYS_PER_REQUEST ||
    !dates.every((date) => isLocalDate(date))
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const db = getDb();
  const calendar = await getUserCalendar(db, session.user.id);
  const today = toLocalDate(new Date(), calendar.timeZone);
  return NextResponse.json({
    today,
    days: await loadDays(db, session.user.id, dates, today, calendar),
  });
}
