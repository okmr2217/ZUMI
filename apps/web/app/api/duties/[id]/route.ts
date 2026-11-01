import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { updateDuty } from "@/lib/duties";
import { dutyResultResponse, parseDutyInput, unauthorized } from "@/lib/duty-api";

export const dynamic = "force-dynamic";

/** 名前・アイコン・繰り返し・前夜通知・メモ欄を更新する（編集フォームは全項目を送る） */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const parsed = await parseDutyInput(request);
  if (!parsed.ok) return parsed.response;

  const { id } = await params;
  return dutyResultResponse(await updateDuty(getDb(), session.user.id, id, parsed.input));
}
