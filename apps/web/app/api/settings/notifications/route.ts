import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import {
  notificationSettingsPatchSchema,
  updateNotificationSettings,
} from "@/lib/notification-settings";

export const dynamic = "force-dynamic";

/**
 * 通知設定（朝/夜/週次の ON/OFF と時刻、タイムゾーンとその自動/手動）を部分更新する。
 * タイムゾーンは保存前に正規化し、不正な値は弾く。期日計算が `Intl` に渡すため、
 * 不正な値が入ると「今日」の判定と通知の配信が RangeError で止まる。
 */
export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = notificationSettingsPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid settings" }, { status: 400 });
  }

  const settings = await updateNotificationSettings(session.user.id, parsed.data);
  return NextResponse.json(settings);
}
