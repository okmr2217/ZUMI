import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { needsOnboarding } from "@/lib/onboarding";
import { TimezoneSync } from "@/components/app/timezone-sync";
import { ServiceWorkerRegister } from "@/components/app/service-worker-register";
import { TabBar } from "@/components/app/tab-bar";

// `getCloudflareContext` はリクエストスコープでのみ使えるため、
// `/app` 配下は静的プリレンダリング対象から外す。
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  // オンボーディングの通知の時刻のステップ（3）を終えるか飛ばすまでは、`/app` を開くたびにオンボーディングへ送る（docs/03）
  if (await needsOnboarding(session.user.id)) {
    redirect("/onboarding");
  }

  // 各タブの見出しはページ側で持つ。下端はタブバー（66px + セーフエリア）に覆われるため余白を空ける
  return (
    <div className="min-h-dvh bg-zumi-bg font-zumi text-zumi-ink">
      <TimezoneSync />
      <ServiceWorkerRegister />
      <div className="mx-auto max-w-[430px] pb-[calc(96px+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <TabBar />
      {/* 今日タブの歯車から開く設定モーダル（`@modal/(.)settings`） */}
      {modal}
    </div>
  );
}
