import { Share, SquarePlus, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * iOS の「ホーム画面に追加」の案内（docs/03 のオンボーディング ステップ3、docs/02 の iOS への対応）。
 * iOS の Safari ではホーム画面に追加しないと Web Push を受け取れない。手順は clipnote の案内にならう。
 * ホーム画面のアプリは Safari とログイン状態を共有しないため、ログインし直しが要ることも伝える。
 *
 * - `full`: オンボーディング用。手順ごとにアイコンを付けたカードで描く
 * - `compact`: 設定モーダルの通知の行の下に添える番号付きの手順
 */
const STEPS = [
  { icon: Share, text: "Safari の共有ボタンをタップ" },
  { icon: SquarePlus, text: "「ホーム画面に追加」を選ぶ" },
  { icon: ToggleRight, text: "「Webアプリとして開く」をオンのまま「追加」" },
] as const;

const RELOGIN_NOTE = "ホーム画面のアプリを開いたら、ログインし直してから通知を許可してください。";

export function IosInstallGuide({
  variant = "full",
  className,
}: {
  variant?: "full" | "compact";
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <ol
        className={cn(
          "bg-zumi-bg text-zumi-ink list-decimal space-y-0.5 rounded-xl py-2 pl-7 pr-3 text-[11px] leading-relaxed",
          className,
        )}
      >
        {STEPS.map((step) => (
          <li key={step.text}>{step.text}</li>
        ))}
        <li>ホーム画面のアプリを開き、ログインし直してから通知を許可</li>
      </ol>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ol className="border-zumi-line bg-zumi-card overflow-hidden rounded-2xl border">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <li
              key={step.text}
              className="border-zumi-line flex items-center gap-3 border-b px-[15px] py-3 last:border-b-0"
            >
              <span className="bg-zumi-base flex size-[38px] shrink-0 items-center justify-center rounded-[11px]">
                <Icon className="size-[18px]" strokeWidth={1.7} aria-hidden />
              </span>
              <span className="text-[13.5px] font-semibold">
                <span className="text-zumi-soft mr-1.5 tabular-nums">{index + 1}</span>
                {step.text}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="bg-zumi-pill rounded-xl px-[13px] py-2.5 text-[12.5px] font-semibold leading-relaxed">
        {RELOGIN_NOTE}
      </p>
    </div>
  );
}
