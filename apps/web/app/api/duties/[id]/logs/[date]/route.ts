import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getUserCalendar } from "@/lib/duties";
import { unauthorized } from "@/lib/duty-api";
import { isLocalDate, logInputSchema } from "@/lib/log-input";
import { deleteLog, recordLog, type LogError, type LogResult } from "@/lib/logs";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; date: string }> };

const ERROR_STATUS: Record<LogError, number> = {
  not_found: 404,
  invalid_state: 409,
  invalid_date: 400,
  already_logged: 409,
};

const invalidInput = () => NextResponse.json({ error: "invalid_input" }, { status: 400 });

function logResultResponse(result: LogResult) {
  return result.ok
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: result.error }, { status: ERROR_STATUS[result.error] });
}

/**
 * `:date`（`YYYY-MM-DD`）に済・スキップを記録する。同じ日のログは上書きする（冪等）。
 * body は `{ status, note?, moveFrom? }`（`logInputSchema`）。今日・未来日の判定は
 * ユーザーのタイムゾーン（`user_settings.timezone`）で行う。
 */
export async function PUT(request: Request, { params }: Params) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const { id, date } = await params;
  if (!isLocalDate(date)) return invalidInput();
  const body: unknown = await request.json().catch(() => null);
  const parsed = logInputSchema.safeParse(body);
  if (!parsed.success) return invalidInput();

  const db = getDb();
  const { timeZone } = await getUserCalendar(db, session.user.id);
  return logResultResponse(
    await recordLog(db, session.user.id, id, date, parsed.data, new Date(), timeZone),
  );
}

/** `:date` の記録を取り消す。ログがなくても 204 */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const { id, date } = await params;
  if (!isLocalDate(date)) return invalidInput();
  return logResultResponse(await deleteLog(getDb(), session.user.id, id, date));
}
