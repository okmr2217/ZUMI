import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { archiveDuty, getUserCalendar, pauseDuty, resumeDuty } from "@/lib/duties";
import { dutyResultResponse, unauthorized } from "@/lib/duty-api";

export const dynamic = "force-dynamic";

const ACTIONS = { pause: pauseDuty, resume: resumeDuty, archive: archiveDuty } as const;

/**
 * 一時停止・再開・アーカイブ。body は `{ "action": "pause" | "resume" | "archive" }`。
 * `duty_pauses` の日付はユーザーのタイムゾーン（`user_settings.timezone`）での今日にする。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const body: unknown = await request.json().catch(() => null);
  const action = body && typeof body === "object" && "action" in body ? body.action : undefined;
  if (typeof action !== "string" || !Object.hasOwn(ACTIONS, action)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { id } = await params;
  const db = getDb();
  const { timeZone } = await getUserCalendar(db, session.user.id);
  const run = ACTIONS[action as keyof typeof ACTIONS];
  return dutyResultResponse(await run(db, session.user.id, id, new Date(), timeZone));
}
