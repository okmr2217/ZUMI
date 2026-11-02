"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DutyIcon } from "@/components/duty/duty-icon";
import type { HistoryDay, HistoryDutyOption, HistoryEntry, HistoryPage } from "@/lib/review";
import { formatDayLabel } from "@/lib/date-label";
import { cn } from "@/lib/utils";

/**
 * 振り返りタブの履歴（モック `ReviewHistory`）。日付ごとのグループで、下端に近づいたら過去を読み足す。
 * 上の Duty のチップで絞り込む。無料プランの範囲（直近3ヶ月）に達したら、その旨だけを出す。
 */
export function ReviewHistory({
  initialPage,
  dutyOptions,
}: {
  initialPage: HistoryPage;
  dutyOptions: HistoryDutyOption[];
}) {
  const [dutyId, setDutyId] = useState<string | null>(null);
  const [days, setDays] = useState(initialPage.days);
  const [nextBefore, setNextBefore] = useState(initialPage.nextBefore);
  const [reachedLimit, setReachedLimit] = useState(initialPage.reachedLimit);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // 絞り込みを切り替えたら、前の条件で送ったリクエストの結果は捨てる
  const requestId = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(async (filter: string | null, before: string | null) => {
    const id = ++requestId.current;
    setLoading(true);
    setFailed(false);
    const page = await fetchHistory(filter, before);
    if (id !== requestId.current) return;
    setLoading(false);
    if (!page) {
      setFailed(true);
      return;
    }
    setDays((current) => (before === null ? page.days : mergeDays(current, page.days)));
    setNextBefore(page.nextBefore);
    setReachedLimit(page.reachedLimit);
  }, []);

  const selectDuty = (next: string | null) => {
    if (next === dutyId) return;
    setDutyId(next);
    setDays([]);
    setNextBefore(null);
    setReachedLimit(false);
    void load(next, null);
  };

  const canLoadMore = nextBefore !== null && !loading && !failed;
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !canLoadMore) return;
    const observer = new IntersectionObserver(
      (observed) => {
        if (observed.some((entry) => entry.isIntersecting)) void load(dutyId, nextBefore);
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [canLoadMore, dutyId, nextBefore, load]);

  const ended = !loading && !failed && nextBefore === null;

  return (
    <div>
      {dutyOptions.length > 0 && (
        <div
          className="-mx-[22px] mb-3.5 flex gap-2 overflow-x-auto px-[22px] pb-0.5 [scrollbar-width:none]"
          role="group"
          aria-label="Duty で絞り込む"
        >
          <FilterChip selected={dutyId === null} onClick={() => selectDuty(null)}>
            すべて
          </FilterChip>
          {dutyOptions.map((option) => (
            <FilterChip
              key={option.id}
              selected={dutyId === option.id}
              onClick={() => selectDuty(option.id)}
            >
              {option.name}
            </FilterChip>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {days.map((day) => (
          <section key={day.date} className="flex flex-col gap-2">
            <h3 className="mb-0.5 text-xs font-bold text-zumi-soft">{formatDayLabel(day.date)}</h3>
            {day.entries.map((entry) => (
              <HistoryRow key={entry.dutyId} entry={entry} />
            ))}
          </section>
        ))}
      </div>

      <div ref={sentinel} className="py-5 text-center text-xs text-zumi-soft">
        {loading && "読み込み中…"}
        {failed && (
          <span>
            読み込めませんでした。
            <button
              type="button"
              className="font-bold text-zumi-shu underline-offset-2 hover:underline"
              onClick={() => void load(dutyId, days.length === 0 ? null : nextBefore)}
            >
              もう一度読み込む
            </button>
          </span>
        )}
        {ended && days.length === 0 && !reachedLimit && (
          <span>
            {dutyId === null ? "まだ記録がありません" : "この Duty の記録はまだありません"}
          </span>
        )}
        {ended && reachedLimit && <span>無料プランでは、直近3ヶ月の記録まで表示します</span>}
      </div>
    </div>
  );
}

async function fetchHistory(dutyId: string | null, before: string | null) {
  const params = new URLSearchParams();
  if (before) params.set("before", before);
  if (dutyId) params.set("duty", dutyId);
  try {
    const res = await fetch(`/api/review/history?${params}`);
    return res.ok ? ((await res.json()) as HistoryPage) : null;
  } catch {
    return null;
  }
}

/** ページは日付の境目で切れるが、念のため同じ日付が続いたら1つのグループにまとめる */
function mergeDays(current: HistoryDay[], more: HistoryDay[]): HistoryDay[] {
  const last = current.at(-1);
  const [first, ...rest] = more;
  if (!last || !first || last.date !== first.date) return [...current, ...more];
  return [
    ...current.slice(0, -1),
    { ...last, entries: [...last.entries, ...first.entries] },
    ...rest,
  ];
}

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "shrink-0 rounded-[20px] border px-[13px] py-[7px] text-xs font-bold",
        selected
          ? "border-zumi-shu bg-zumi-shu text-white"
          : "border-zumi-line bg-zumi-card text-zumi-ink",
      )}
    >
      {children}
    </button>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] border border-zumi-line bg-zumi-card px-[13px] py-[11px]">
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-zumi-base">
        <DutyIcon name={entry.icon} className="size-[17px]" strokeWidth={1.6} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13.5px] font-bold">{entry.name}</span>
        {entry.note && <span className="truncate text-[11.5px] text-zumi-soft">{entry.note}</span>}
      </span>
      <span className="mr-1 shrink-0 text-[10.5px] text-zumi-soft">{entry.loggedTime}</span>
      {entry.status === "DONE" ? (
        <span className="shrink-0 rounded-[20px] bg-zumi-shu-bg px-[9px] py-[3px] text-[10px] font-bold text-zumi-shu">
          済
        </span>
      ) : (
        <span className="shrink-0 rounded-[20px] bg-zumi-pill px-[9px] py-[3px] text-[10px] font-bold text-zumi-soft">
          スキップ
        </span>
      )}
    </div>
  );
}
