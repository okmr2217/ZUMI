import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ReviewHistory } from "@/components/review/review-history";
import { ShareButton } from "@/components/review/share-button";
import { WeeklySummaryCard } from "@/components/review/weekly-summary-card";
import { getReviewPageData } from "@/lib/review-page-data";

/**
 * 振り返りタブ（docs/04「4-2. 振り返り」）。上から週次サマリーカード、履歴の順に1スクロールで並べる。
 * モックにある「週次サマリー / ヒートマップ / 履歴」の切り替えは、ヒートマップが MVP 対象外のため置かない。
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { week } = await searchParams;
  const data = await getReviewPageData(typeof week === "string" ? week : undefined);

  return (
    <main>
      <PageHeader title="振り返り" />
      <section className="px-[22px] pt-[18px]" aria-labelledby="weekly-summary-heading">
        <div className="mb-2.5 flex items-center justify-between">
          <h2
            id="weekly-summary-heading"
            className="text-zumi-soft text-xs font-bold tracking-[.08em]"
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
            <ShareButton week={data.summary.weekStart} />
          </div>
        </div>
        <WeeklySummaryCard summary={data.summary} />
      </section>

      <section className="px-[22px] pt-7" aria-labelledby="history-heading">
        <h2
          id="history-heading"
          className="text-zumi-soft mb-2.5 text-xs font-bold tracking-[.08em]"
        >
          履歴
        </h2>
        <ReviewHistory initialPage={data.history} dutyOptions={data.dutyOptions} />
      </section>
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
