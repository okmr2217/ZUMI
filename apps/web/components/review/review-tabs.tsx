import Link from "next/link";
import { reviewHref, type ReviewView } from "@/lib/review-page-data";
import { cn } from "@/lib/utils";

const TABS: { view: ReviewView; label: string }[] = [
  { view: "summary", label: "週次サマリー" },
  { view: "heatmap", label: "ヒートマップ" },
  { view: "history", label: "履歴" },
];

/** 振り返りの3つの切り替えボタン（モックの `segmented`）。表示は URL（`?view=`）で決まり、戻るボタンでも元の表示に戻れる */
export function ReviewTabs({ current }: { current: ReviewView }) {
  return (
    <nav aria-label="振り返りの表示" className="flex gap-1.5 px-[22px] pb-1 pt-3.5">
      {TABS.map(({ view, label }) => (
        <Link
          key={view}
          href={reviewHref(view)}
          scroll={false}
          aria-current={view === current ? "page" : undefined}
          className={cn(
            "flex-1 rounded-[20px] border px-1 py-[9px] text-center text-xs font-bold",
            view === current
              ? "border-zumi-shu bg-zumi-shu text-white"
              : "border-zumi-line bg-zumi-card text-zumi-soft",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
