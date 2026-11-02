import { ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// 寸法は画面モック（Settings.dc.html）のグループ・行に合わせている（通知フォームと同じ）。

export function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-zumi-soft text-[11.5px] font-bold tracking-[.06em]">{title}</h2>
      <div className="border-zumi-line bg-zumi-card overflow-hidden rounded-2xl border">
        {children}
      </div>
    </section>
  );
}

const ROW =
  "border-zumi-line flex w-full items-center justify-between gap-3 border-b px-[15px] py-3 text-left last:border-b-0";

function RowText({ label, sub }: { label: string; sub?: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[13.5px] font-semibold">{label}</span>
      {sub && <span className="text-zumi-soft mt-0.5 block text-[11px]">{sub}</span>}
    </span>
  );
}

/** 左にラベル、右に値や操作を置く行 */
export function SettingsRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={ROW}>
      <RowText label={label} sub={sub} />
      {children && (
        <span className="text-zumi-soft flex shrink-0 items-center gap-1.5 text-[12.5px]">
          {children}
        </span>
      )}
    </div>
  );
}

/**
 * タップで次の画面（シート）を開く行。右端にシェブロンを出す。
 * `href` を渡すと別タブでページを開くリンクになる（ホーム画面アプリでも戻れるように、アプリの画面は置き換えない）
 */
export function SettingsLinkRow({
  label,
  sub,
  value,
  onClick,
  href,
  disabled = false,
  tone = "default",
}: {
  label: string;
  sub?: string;
  value?: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener" className={ROW}>
        <RowText label={label} sub={sub} />
        <ExternalLink className="text-zumi-soft size-3.5 shrink-0" strokeWidth={1.8} aria-hidden />
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(ROW, tone === "danger" && "text-zumi-shu-deep", "disabled:cursor-default")}
    >
      <RowText label={label} sub={sub} />
      <span className="text-zumi-soft flex shrink-0 items-center gap-1.5 text-[12.5px]">
        {value}
        {!disabled && <ChevronRight className="size-3.5" strokeWidth={1.8} aria-hidden />}
      </span>
    </button>
  );
}

/** 時刻ピルと同じ見た目のピル（週の始まりの選択など） */
export const SETTINGS_PILL =
  "rounded-[20px] bg-zumi-base py-1 pl-2.5 pr-[9px] text-[11.5px] font-bold text-zumi-ink";
