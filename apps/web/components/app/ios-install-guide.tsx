import { cn } from "@/lib/utils";

/**
 * iOS の「ホーム画面に追加」の短い手順（docs/02 の iOS への対応）。設定モーダルの通知の行の下に添える。
 * iOS の Safari ではホーム画面に追加しないと Web Push を受け取れない。
 * ホーム画面のアプリは Safari とログイン状態を共有しないため、ログインし直しが要ることも伝える。
 * 環境ごとの詳しい手順は `/install`（`pwa-install-guide.tsx`）。
 */
const STEPS = [
  "Safari の共有ボタンをタップ",
  "「ホーム画面に追加」を選ぶ",
  "「Webアプリとして開く」をオンのまま「追加」",
  "ホーム画面のアプリを開き、ログインし直してから通知を許可",
] as const;

export function IosInstallGuide({ className }: { className?: string }) {
  return (
    <ol
      className={cn(
        "list-decimal space-y-0.5 rounded-xl bg-zumi-bg py-2 pl-7 pr-3 text-[11px] leading-relaxed text-zumi-ink",
        className,
      )}
    >
      {STEPS.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}
