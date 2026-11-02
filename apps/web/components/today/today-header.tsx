import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Settings } from "lucide-react";
import { addDays } from "@zumi/types";
import { formatDayLabel } from "@/lib/date-label";
import type { DayMode } from "@/lib/today";

const TITLES: Record<DayMode, string> = {
  today: "今日",
  past: "過去の記録",
  future: "予定の確認",
};

const dayHref = (date: string, today: string) => (date === today ? "/app" : `/app?date=${date}`);

const roundButton =
  "flex shrink-0 items-center justify-center rounded-full border border-zumi-line bg-zumi-card text-zumi-soft";

/**
 * 今日タブの見出し（モックの Main / MainPast / MainFuture の topbar）。
 * 日付ナビとタイトルが一体で、右端に設定の歯車。今日以外では「今日へ戻る」を出す。
 */
export function TodayHeader({ date, today, mode }: { date: string; today: string; mode: DayMode }) {
  return (
    <>
      <header className="flex items-center justify-between gap-2.5 px-[22px] pb-1.5 pt-[26px]">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Link
            href={dayHref(addDays(date, -1), today)}
            aria-label="前の日"
            className={`${roundButton} size-8`}
          >
            <ChevronLeft className="size-3.5" strokeWidth={2} aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] tracking-[.02em] text-zumi-soft">{formatDayLabel(date)}</p>
            <h1 className="mt-0.5 text-[22px] font-bold">{TITLES[mode]}</h1>
          </div>
          <Link
            href={dayHref(addDays(date, 1), today)}
            aria-label="次の日"
            className={`${roundButton} size-8`}
          >
            <ChevronRight className="size-3.5" strokeWidth={2} aria-hidden />
          </Link>
        </div>
        <Link href="/app/settings" aria-label="設定" className={`${roundButton} size-[38px]`}>
          <Settings className="size-[18px]" strokeWidth={1.6} aria-hidden />
        </Link>
      </header>
      {mode !== "today" && (
        <Link
          href="/app"
          className="mx-[22px] mt-3 inline-flex w-fit items-center gap-1 rounded-[20px] border border-zumi-line bg-zumi-card px-3 py-1.5 text-xs font-bold text-zumi-shu"
        >
          <Clock className="size-3" strokeWidth={1.8} aria-hidden />
          今日へ戻る
        </Link>
      )}
    </>
  );
}
