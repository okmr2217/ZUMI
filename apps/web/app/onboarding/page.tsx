import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { needsOnboarding } from "@/lib/onboarding";
import { getNotificationSettings } from "@/lib/notification-settings";
import { getTemplatePageData } from "@/lib/duty-page-data";
import { getVapidPublicKey } from "@/lib/vapid";
import { DEFAULT_EVENING_AT, DEFAULT_MORNING_AT } from "@/lib/notification-defaults";
import { TimezoneSync } from "@/components/app/timezone-sync";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

// `getCloudflareContext` はリクエストスコープでのみ使えるため、静的プリレンダリング対象から外す。
export const dynamic = "force-dynamic";

/**
 * オンボーディング（docs/03「オンボーディング（2026/11 再設計）」）。タブバーを出さないため
 * `/app` のレイアウトの外に置く。`onboardedAt` が記録済みなら今日タブへ送る。
 */
export default async function OnboardingPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!(await needsOnboarding(session.user.id))) redirect("/app");

  const [{ calendar }, settings] = await Promise.all([
    getTemplatePageData(),
    getNotificationSettings(session.user.id),
  ]);

  return (
    <div className="min-h-dvh bg-zumi-bg font-zumi text-zumi-ink">
      <TimezoneSync />
      <OnboardingFlow
        calendar={calendar}
        initialTimes={{
          // docs/03 の初期値。設定済みの時刻があればそれを使う
          morningNotifyAt: settings.morningNotifyAt ?? DEFAULT_MORNING_AT,
          eveningNotifyAt: settings.eveningNotifyAt ?? DEFAULT_EVENING_AT,
          weeklySummaryAt: settings.weeklySummaryAt,
        }}
        vapidPublicKey={getVapidPublicKey()}
      />
    </div>
  );
}
