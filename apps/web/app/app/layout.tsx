import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { TimezoneSync } from "@/components/app/timezone-sync";
import { TabBar } from "@/components/app/tab-bar";

// `getCloudflareContext` はリクエストスコープでのみ使えるため、
// `/app` 配下は静的プリレンダリング対象から外す。
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  // 各タブの見出しはページ側で持つ。下端はタブバー（66px + セーフエリア）に覆われるため余白を空ける
  return (
    <div className="bg-zumi-bg font-zumi text-zumi-ink min-h-dvh">
      <TimezoneSync />
      <div className="mx-auto max-w-[430px] pb-[calc(96px+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <TabBar />
    </div>
  );
}
