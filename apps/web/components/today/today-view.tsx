"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { TodaySection } from "@zumi/types";
import type { LogInput } from "@/lib/log-input";
import type { DayMode, TodayItem, TodayLog } from "@/lib/today";
import { formatShortDate } from "@/lib/schedule-text";
import { cn } from "@/lib/utils";
import {
  deleteLogRequest,
  logErrorMessage,
  recordLogRequest,
  type LogApiResult,
} from "./log-api-client";
import { LogSheet } from "./log-sheet";
import { PushBanner } from "./push-banner";
import { TodayRow } from "./today-row";

type Logs = Record<string, TodayLog | null>;

const TOAST_MS = 4000;

const SECTIONS: { section: TodaySection; label: string }[] = [
  { section: "TODAY", label: "今日" },
  { section: "SOON", label: "そろそろ" },
  { section: "THIS_WEEK", label: "今週" },
];

const TEXT: Record<DayMode, { progress: string; list: string; empty: string; hint?: string }> = {
  today: { progress: "今日の進捗", list: "", empty: "今日の Duty はありません。" },
  past: {
    progress: "この日の進捗",
    list: "この日の Duty",
    empty: "この日の Duty はありません。",
    hint: "タップして、この日の分を後から記録できます",
  },
  future: {
    progress: "この日の予定",
    list: "この日の予定",
    empty: "この日の予定はありません。",
    hint: "先の予定です。「済」にできるのは、その日になってから",
  },
};

const toLogs = (items: readonly TodayItem[]): Logs =>
  Object.fromEntries(items.map((item) => [item.id, item.log]));

/**
 * 今日タブの本体（docs/04-screens.md「4-1. 今日」、モックの Main / MainPast / MainFuture）。
 *
 * 押印・取り消しは楽観的に表示を変え、失敗したら直前に確定していた状態に戻す。
 * この画面で記録した Duty は、朱印を付けたまま元の位置に残す（次に開いたときに「済んだもの」へ入る）。
 * 押した瞬間に行が消えると、下の行が指の下に来て続けて誤タップしやすいため。
 * 同じ Duty へのリクエストは順番に送り、連打しても届く順が入れ替わらないようにする。
 * セクションは当日のログより前の状態で決まるため（docs/03「当日のログの扱い」）、
 * 押印しても再取得は要らない。対象日を変えたときだけ、他の日の状態が変わるため再取得する。
 */
export function TodayView({
  date,
  today,
  mode,
  items,
  hasDuties,
  vapidPublicKey,
}: {
  date: string;
  today: string;
  mode: DayMode;
  items: TodayItem[];
  hasDuties: boolean;
  vapidPublicKey: string | null;
}) {
  const router = useRouter();
  const [logs, setLogs] = useState<Logs>(() => toLogs(items));
  const [prevItems, setPrevItems] = useState(items);
  /** この画面で記録した Duty。元の位置に残す */
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const [doneOpen, setDoneOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /** サーバーで確定した状態。失敗したときの戻し先 */
  const confirmed = useRef<Logs>(toLogs(items));
  const queues = useRef(new Map<string, Promise<unknown>>());
  const toastTimer = useRef<number | null>(null);

  // 再取得（対象日の変更の後）で届いた値に合わせる
  if (items !== prevItems) {
    setPrevItems(items);
    setLogs(toLogs(items));
  }
  useEffect(() => {
    confirmed.current = toLogs(items);
  }, [items]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback((next: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  /**
   * 表示を `next` に変えてからリクエストを送る。同じ Duty のリクエストは前のものが終わってから送る。
   * `keep` なら、この画面にいる間は元の位置（セクション）に残す
   */
  const mutate = useCallback(
    (id: string, next: TodayLog | null, keep: boolean, request: () => Promise<LogApiResult>) => {
      setLogs((prev) => ({ ...prev, [id]: next }));
      if (keep) setKept((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
      const run = async () => {
        const result = await request();
        if (result.ok) {
          confirmed.current = { ...confirmed.current, [id]: next };
          setLogs((prev) => ({ ...prev, [id]: next }));
        } else {
          setLogs((prev) => ({ ...prev, [id]: confirmed.current[id] ?? null }));
          showToast(logErrorMessage(result.error));
        }
      };
      const queued = (queues.current.get(id) ?? Promise.resolve()).then(run);
      queues.current.set(id, queued);
    },
    [showToast],
  );

  const unstamp = useCallback(
    (item: TodayItem) => mutate(item.id, null, true, () => deleteLogRequest(item.id, date)),
    [mutate, date],
  );

  const stamp = useCallback(
    (item: TodayItem) => {
      // ワンタップではメモを送らず、既存のメモは API 側でそのまま残る
      mutate(item.id, { status: "DONE", note: logs[item.id]?.note ?? null }, true, () =>
        recordLogRequest(item.id, date, { status: "DONE" }),
      );
    },
    [mutate, date, logs],
  );

  /** 記録済みで「済んだもの」に入るか（この画面で記録したものは元の位置に残す） */
  const handled = (item: TodayItem) => logs[item.id] != null && !kept.has(item.id);

  const detailItem = items.find((item) => item.id === detailId) ?? null;

  async function submitDetail(targetDate: string, input: LogInput): Promise<LogApiResult> {
    const item = detailItem!;
    if (targetDate === date && !input.moveFrom) {
      setDetailId(null);
      mutate(
        item.id,
        {
          status: input.status,
          note:
            input.note === undefined ? (logs[item.id]?.note ?? null) : input.note?.trim() || null,
        },
        // 「済んだもの」から開いたものは、そのまま「済んだもの」に置く
        !handled(item),
        () => recordLogRequest(item.id, date, input),
      );
      return { ok: true };
    }
    // 別の日への記録・付け替えは、その日のセクション（週の残回数・前回からの日数）も変えうるので再取得する
    const result = await recordLogRequest(item.id, targetDate, input);
    if (result.ok) {
      setDetailId(null);
      showToast(`「${item.name}」を${formatShortDate(targetDate)}の分として記録しました`);
      router.refresh();
    }
    return result;
  }

  const doneCount = items.filter((item) => logs[item.id]?.status === "DONE").length;
  const text = TEXT[mode];

  const row = (item: TodayItem) => (
    <li key={item.id}>
      <TodayRow
        item={item}
        log={logs[item.id] ?? null}
        mode={mode}
        stamped={kept.has(item.id)}
        onStamp={() => stamp(item)}
        onUnstamp={() => unstamp(item)}
        onOpenDetail={() => setDetailId(item.id)}
      />
    </li>
  );

  const doneItems = mode === "today" ? items.filter(handled) : [];

  return (
    <>
      {mode === "today" && <PushBanner vapidPublicKey={vapidPublicKey} />}

      <div className="flex flex-col gap-2 px-[22px] pb-1 pt-3.5">
        <div className="text-zumi-soft flex justify-between text-[13px]">
          <span>{text.progress}</span>
          <span>
            {doneCount} / {items.length}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={text.progress}
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={doneCount}
          className="bg-zumi-line h-1.5 overflow-hidden rounded"
        >
          <div
            className={cn(
              "h-full rounded transition-[width] duration-300",
              mode === "future" ? "bg-zumi-soft opacity-40" : "bg-zumi-shu",
            )}
            style={{ width: items.length === 0 ? 0 : `${(doneCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-[22px] px-[22px] pt-2">
        {!hasDuties ? (
          <div className="border-zumi-line text-zumi-soft mt-2 rounded-2xl border border-dashed px-4 py-8 text-center text-[13px] leading-relaxed">
            まだ Duty がありません。
            <br />
            <Link href="/app/duties" className="text-zumi-shu font-bold">
              Duty タブ
            </Link>
            から、定期的にやることを登録しましょう。
          </div>
        ) : items.length === 0 ? (
          <p className="text-zumi-soft mt-2 py-6 text-center text-[13px]">{text.empty}</p>
        ) : mode === "today" ? (
          <>
            {SECTIONS.map(({ section, label }) => {
              const sectionItems = items.filter(
                (item) => item.section === section && !handled(item),
              );
              if (sectionItems.length === 0) return null;
              return (
                <section key={section}>
                  <h2
                    className={cn(
                      "mb-2.5 text-xs font-bold tracking-[.08em]",
                      section === "SOON" ? "text-zumi-warn" : "text-zumi-soft",
                    )}
                  >
                    {label}
                  </h2>
                  <ul className="flex flex-col gap-2.5">{sectionItems.map(row)}</ul>
                </section>
              );
            })}
            {doneItems.length > 0 && (
              <section>
                <button
                  type="button"
                  aria-expanded={doneOpen}
                  onClick={() => setDoneOpen((open) => !open)}
                  className="text-zumi-soft flex w-full items-center justify-between px-1 py-3 text-[13px] font-medium"
                >
                  <span>済んだもの {doneItems.length}件</span>
                  <ChevronDown
                    className={cn("size-4 transition-transform", doneOpen && "rotate-180")}
                    strokeWidth={1.8}
                    aria-hidden
                  />
                </button>
                {doneOpen && <ul className="flex flex-col gap-2.5">{doneItems.map(row)}</ul>}
              </section>
            )}
          </>
        ) : (
          <section>
            <h2 className="text-zumi-soft mb-2.5 text-xs font-bold tracking-[.08em]">
              {text.list}
            </h2>
            <ul className="flex flex-col gap-2.5">{items.map(row)}</ul>
            {text.hint && (
              <p className="text-zumi-soft pb-[18px] pt-3.5 text-center text-[11.5px]">
                {text.hint}
              </p>
            )}
          </section>
        )}
      </div>

      <LogSheet
        item={detailItem}
        log={detailItem ? (logs[detailItem.id] ?? null) : null}
        date={date}
        today={today}
        onClose={() => setDetailId(null)}
        onSubmit={submitDetail}
        onUndo={() => {
          if (detailItem) unstamp(detailItem);
          setDetailId(null);
        }}
      />

      {/* 失敗・別の日への記録のお知らせ。タブバー（66px + セーフエリア）の上に出す */}
      {toast && (
        <p
          role="status"
          className="bg-zumi-ink fixed inset-x-0 bottom-[calc(66px+max(12px,env(safe-area-inset-bottom))+12px)] z-30 mx-auto w-[calc(100%-44px)] max-w-[386px] rounded-2xl px-4 py-3 text-[13px] text-white shadow-[0_8px_24px_rgba(30,26,20,.25)]"
        >
          {toast}
        </p>
      )}
    </>
  );
}
