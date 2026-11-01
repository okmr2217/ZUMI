import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import {
  deletePushSubscription,
  deleteSubscriptionBodySchema,
  savePushSubscription,
  saveSubscriptionBodySchema,
} from "@/lib/push-subscriptions";

export const dynamic = "force-dynamic";

/** この端末の Web Push 購読を保存する（同じ endpoint なら更新）。 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = saveSubscriptionBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  await savePushSubscription(session.user.id, parsed.data.subscription, parsed.data.oldEndpoint);
  return new NextResponse(null, { status: 204 });
}

/** この端末の購読を消す（通知をオフにしたとき・ログアウト時）。自分の購読だけが対象。 */
export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = deleteSubscriptionBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid endpoint" }, { status: 400 });
  }

  await deletePushSubscription(session.user.id, parsed.data.endpoint);
  return new NextResponse(null, { status: 204 });
}
