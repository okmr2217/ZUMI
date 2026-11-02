import Link from "next/link";
import { X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { getSettingsPanelData } from "@/lib/settings-page-data";

/**
 * `/app/settings` を直接開いた（再読み込みした）ときの設定。ふだんは今日タブの歯車から
 * モーダル（`@modal/(.)settings`）で開くので、同じ中身をページとして出す。
 */
export default async function SettingsPage() {
  const data = await getSettingsPanelData();

  return (
    <main>
      <PageHeader
        title="設定"
        action={
          <Link
            href="/app"
            aria-label="閉じる"
            className="flex size-[30px] items-center justify-center rounded-full bg-zumi-card text-zumi-soft"
          >
            <X className="size-3.5" strokeWidth={1.8} aria-hidden />
          </Link>
        }
      />
      <div className="px-[22px] pt-4">
        <SettingsPanel {...data} />
      </div>
    </main>
  );
}
