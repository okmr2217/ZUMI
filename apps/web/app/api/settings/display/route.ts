import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { displaySettingsPatchSchema, updateWeekStart } from "@/lib/user-settings";

export const dynamic = "force-dynamic";

/** 設定モーダルの「表示」（週の始まり）を更新する。 */
export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = displaySettingsPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid settings" }, { status: 400 });
  }

  await updateWeekStart(session.user.id, parsed.data.weekStart);
  return NextResponse.json(parsed.data);
}
