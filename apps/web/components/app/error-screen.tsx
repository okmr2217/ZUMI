import { cn } from "@/lib/utils";

type ErrorAction = { label: string } & ({ href: string } | { onClick: () => void });

/**
 * 404・500 の画面。モックにエラーの画面はないため、タブバーのない単独の画面（ログイン）の構成に合わせる:
 * ブランドの朱印 → 見出し 21px → 補足 13px → 主ボタン → テキストリンク。
 *
 * `fullScreen` は画面全体を生成り地で埋める（ルートの 404・エラー）。`/app` のエラーは
 * タブバーを残したレイアウトの中に出すので、地と高さはレイアウトに任せる。
 */
export function ErrorScreen({
  title,
  description,
  primary,
  secondary,
  fullScreen = true,
}: {
  title: string;
  description: React.ReactNode;
  primary: ErrorAction;
  secondary?: ErrorAction;
  fullScreen?: boolean;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-[430px] flex-col items-center px-7 pb-7 text-center",
        fullScreen
          ? "pt-safe min-h-svh justify-center bg-zumi-bg font-zumi text-zumi-ink"
          : "pt-24",
      )}
    >
      <div className="mb-9 flex flex-col items-center gap-3">
        <span
          aria-hidden
          className="flex size-[52px] rotate-[-6deg] items-center justify-center rounded-full border-[2.4px] border-zumi-shu font-seal text-2xl text-zumi-shu shadow-[inset_0_0_0_1px_rgba(200,64,42,0.25)]"
        >
          済
        </span>
        <span className="text-sm font-black tracking-[0.24em]">ZUMI</span>
      </div>
      <h1 className="text-[21px] font-bold">{title}</h1>
      <p className="mb-8 mt-1.5 text-[13px] leading-relaxed text-zumi-soft">{description}</p>
      <ActionButton
        action={primary}
        className="w-full rounded-2xl bg-zumi-shu p-[15px] text-[15px] font-bold text-white"
      />
      {secondary && (
        <ActionButton
          action={secondary}
          className="mt-5 text-[13px] font-bold text-zumi-shu hover:text-zumi-shu-deep"
        />
      )}
    </main>
  );
}

/**
 * リンクは `<a>` でドキュメントごと開き直す。エラーの画面からソフト遷移すると、壊れたままの状態を
 * 引き継いだり、同じ URL（今日タブで起きたエラーから今日タブへ）では何も起きなかったりするため
 */
function ActionButton({ action, className }: { action: ErrorAction; className: string }) {
  if ("href" in action) {
    return (
      <a href={action.href} className={className}>
        {action.label}
      </a>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}
