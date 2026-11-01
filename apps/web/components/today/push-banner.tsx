"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { usePushSubscription } from "@/lib/use-push-subscription";

const DISMISSED_KEY = "zumi:push-banner-dismissed";

/**
 * 通知の許可を促すバナー（docs/04「4-1. 今日」、docs/02「iOS への対応」）。この端末が未購読（`off`）の
 * ときだけ出す。iOS ではホーム画面アプリで再ログインした後の、通知許可の実質的な入口になる。
 * 閉じたらこの端末では出さない（オンにするかは設定からいつでも選べる）。
 */
export function PushBanner({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const { status, busy, error, subscribe } = usePushSubscription(vapidPublicKey);
  // 読めるまでは出さない（サーバーの描画と食い違わないよう、マウント後に読む）
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let value = false;
    try {
      value = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // ストレージが使えない環境では毎回出す
    }
    // マウント時にブラウザの保存値を読むだけで、外部への書き込みはしない。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(value);
  }, []);

  if (status !== "off" || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // 保存できなくても、この表示中は閉じる
    }
  }

  return (
    <section
      aria-label="通知の許可"
      className="border-zumi-line bg-zumi-card mx-[22px] mt-3 flex items-start gap-3 rounded-2xl border p-3.5"
    >
      <span className="bg-zumi-tint text-zumi-shu flex size-9 shrink-0 items-center justify-center rounded-full">
        <Bell className="size-[18px]" strokeWidth={1.8} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <p className="text-[13.5px] font-bold">通知をオンにしませんか</p>
          <p className="text-zumi-soft mt-0.5 text-[11.5px] leading-relaxed">
            その日の Duty と、まだ済んでいないものをお知らせします。
          </p>
        </div>
        <button
          type="button"
          onClick={subscribe}
          disabled={busy}
          className="bg-zumi-shu w-fit rounded-[20px] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {busy ? "設定中…" : "通知をオンにする"}
        </button>
        {error && (
          <p role="alert" className="text-zumi-shu-deep text-[11.5px] font-semibold">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="閉じる"
        className="text-zumi-soft -m-1.5 flex size-8 shrink-0 items-center justify-center rounded-full"
      >
        <X className="size-4" strokeWidth={1.8} aria-hidden />
      </button>
    </section>
  );
}
