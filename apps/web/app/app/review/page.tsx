import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ReviewHeatmap } from "@/components/review/review-heatmap";
import { ReviewHistory } from "@/components/review/review-history";
import { ReviewTabs } from "@/components/review/review-tabs";
import { ShareButton } from "@/components/review/share-button";
import { WeeklySummaryCard } from "@/components/review/weekly-summary-card";
import { getReviewPageData } from "@/lib/review-page-data";

/**
 * 振り返りタブ（docs/04「4-2. 振り返り」）。上の切り替えボタンで、週次サマリー・ヒートマップ・履歴の
 * どれか1つを表示する（モック `ReviewSummary` / `ReviewHeatmap` / `ReviewHistory`）。表示は `?view=` で決まる。
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await getReviewPageData(await searchParams);

  return (
    <main>
      <PageHeader title="振り返り" />
      <ReviewTabs current={data.view} />
      <div className="px-[22px] pt-[18px]">
        {data.view === "summary" && (
          <section aria-labelledby="weekly-summary-heading">
            <div className="mb-2.5 flex items-center justify-between">
              <h2
                id="weekly-summary-heading"
                className="text-xs font-bold tracking-[.08em] text-zumi-soft"
              >
                週次サマリー
              </h2>
              <div className="flex items-center gap-1">
                <WeekLink href={data.previousWeekHref} label="前の週">
                  <ChevronLeft className="size-4" strokeWidth={1.8} aria-hidden />
                </WeekLink>
                <WeekLink href={data.nextWeekHref} label="次の週">
                  <ChevronRight className="size-4" strokeWidth={1.8} aria-hidden />
                </WeekLink>
                {/* 週を送ったら、前の週の「もう一度」などの状態を持ち越さない */}
                <ShareButton key={data.summary.weekStart} week={data.summary.weekStart} />
              </div>
            </div>
            <WeeklySummaryCard summary={data.summary} />
          </section>
        )}
        {data.view === "heatmap" && (
          <section aria-label="月次ヒートマップ">
            <ReviewHeatmap
              heatmap={data.heatmap}
              today={data.today}
              weekStart={data.weekStart}
              dutyOptions={data.dutyOptions}
              dutyId={data.dutyId}
              previousMonthHref={data.previousMonthHref}
              nextMonthHref={data.nextMonthHref}
              currentMonth={data.today.slice(0, 7)}
            />
          </section>
        )}
        {data.view === "history" && (
          <section aria-label="履歴">
            <ReviewHistory initialPage={data.history} dutyOptions={data.dutyOptions} />
          </section>
        )}
      </div>
    </main>
  );
}

function WeekLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const className = "flex size-7 items-center justify-center rounded-full";
  if (href === null) {
    return (
      <span className={`${className} text-zumi-line`} aria-hidden>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className={`${className} text-zumi-soft hover:bg-zumi-pill`}
    >
      {children}
    </Link>
  );
}
