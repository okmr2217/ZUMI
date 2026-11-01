import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { completeOnboarding, onboardingInputSchema } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

/**
 * オンボーディングのステップ2を終えた（または飛ばした）ときに呼ぶ。値を保存して
 * `onboardedAt` を記録し、以後 `/app` からオンボーディングへリダイレクトしない（docs/03）。
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = onboardingInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid settings" }, { status: 400 });
  }

  await completeOnboarding(session.user.id, parsed.data, new Date());
  return new NextResponse(null, { status: 204 });
}
