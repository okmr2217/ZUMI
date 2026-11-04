import { SettingsModal } from "@/components/settings/settings-modal";

/**
 * 設定モーダルの枠。データ（セッション・通知設定）を待たずにシートを開くため、枠はここに置き、
 * 中身は `loading.tsx`（読み込み中の仮の中身）から `page.tsx` に差し替える。
 * 枠をページ側に置くと、サーバーの応答が返るまで歯車を押してもシートが出ない。
 */
export default function SettingsModalLayout({ children }: { children: React.ReactNode }) {
  return <SettingsModal>{children}</SettingsModal>;
}
