"use client";

import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/app/bottom-sheet";

/**
 * 今日タブの歯車（`/app/settings` へのリンク）から開く設定モーダル。
 * `app/app/@modal/(.)settings` がリンクの遷移を横取りして、今日タブの上にこのシートを重ねる。
 * 閉じると履歴を1つ戻り、今日タブに戻る。
 */
export function SettingsModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <BottomSheet open onClose={() => router.back()} title="設定">
      {children}
    </BottomSheet>
  );
}
