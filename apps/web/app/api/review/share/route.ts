import { NextResponse } from "next/server";
import { getWeekRange, toLocalDate } from "@zumi/types";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getUserCalendar } from "@/lib/duties";
import { unauthorized } from "@/lib/duty-api";
import { isLocalDate } from "@/lib/log-input";
import { getReviewWeekRange } from "@/lib/review";
import { issueShareToken, shareImagePath } from "@/lib/share";

export const dynamic = "force-dynamic";

/**
 * 週次サマリーのシェア画像を発行する。本文は `{ week: "YYYY-MM-DD" }`（週の初日）。
 * 振り返りタブで開ける週（`getReviewWeekRange`）だけを受け付け、画像の URL を返す。
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const body: unknown = await request.json().catch(() => null);
  const week = typeof body === "object" && body !== null && "week" in body ? body.week : undefined;
  if (typeof week !== "string" || !isLocalDate(week)) return invalidInput();

  const db = getDb();
  const calendar = await getUserCalendar(db, session.user.id);
  const today = toLocalDate(new Date(), calendar.timeZone);
  const range = getReviewWeekRange(today, calendar.weekStart);
  if (getWeekRange(week, calendar.weekStart).start !== week) return invalidInput();
  if (week < range.oldest || week > range.current) return invalidInput();

  const { token } = await issueShareToken(db, session.user.id, week, today, calendar);
  return NextResponse.json({ token, imageUrl: shareImagePath(token) }, { status: 201 });
}

function invalidInput() {
  return NextResponse.json({ error: "invalid_input" }, { status: 400 });
}
