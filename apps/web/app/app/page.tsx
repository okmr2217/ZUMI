import Link from "next/link";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";

export default function TodayPage() {
  // フェーズ3で実装: 今日タブ（期日計算ロジック + 3セクション + ワンタップ押印）
  return (
    <main>
      <PageHeader
        title="今日"
        action={
          <Link
            href="/app/settings"
            aria-label="設定"
            className="text-zumi-soft flex size-9 items-center justify-center rounded-full"
          >
            <Settings className="size-5" strokeWidth={1.8} aria-hidden />
          </Link>
        }
      />
    </main>
  );
}
