"use client";

import { useEffect, useRef, useState } from "react";
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
 * 押印・取り消しは楽観的に表示を変え、失敗したらサーバーで確定していた状態に戻す。
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
  /** サーバーで確定した状態。失敗したときは、ここに戻る */
  const [confirmed, setConfirmed] = useState<Logs>(() => toLogs(items));
  const [prevItems, setPrevItems] = useState(items);
  /** 送信中のリクエストによる楽観的な表示。その Duty の最後のリクエストが終わったら外す */
  const [pending, setPending] = useState<Logs>({});
  /** この画面で記録した Duty。元の位置に残す */
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const [doneOpen, setDoneOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const queues = useRef(new Map<string, Promise<unknown>>());
  /** Duty ごとの最後のリクエストの番号。古いリクエストの完了で新しい表示を上書きしないため */
  const latest = useRef(new Map<string, number>());
  const toastTimer = useRef<number | null>(null);

  // 再取得（対象日の変更の後）で届いた値に合わせる。送信中の表示（pending）はそのまま
  if (items !== prevItems) {
    setPrevItems(items);
    setConfirmed(toLogs(items));
  }
  const logs: Logs = { ...confirmed, ...pending };

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  function showToast(message: string) {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }

  /** 同じ Duty のリクエストは前のものが終わってから送る（連打しても届く順が入れ替わらない） */
  function enqueue<T>(id: string, task: () => Promise<T>): Promise<T> {
    const queued = (queues.current.get(id) ?? Promise.resolve()).then(task);
    queues.current.set(id, queued);
    return queued;
  }

  /**
   * 表示を `next` に変えてからリクエストを送る。
   * `keep` なら、この画面にいる間は元の位置（セクション）に残す
   */
  function mutate(
    id: string,
    next: TodayLog | null,
    keep: boolean,
    request: () => Promise<LogApiResult>,
  ) {
    const seq = (latest.current.get(id) ?? 0) + 1;
    latest.current.set(id, seq);
    setPending((prev) => ({ ...prev, [id]: next }));
    if (keep) setKept((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    void enqueue(id, async () => {
      const result = await request();
      if (result.ok) setConfirmed((prev) => ({ ...prev, [id]: next }));
      else showToast(logErrorMessage(result.error));
      if (latest.current.get(id) === seq) {
        setPending((prev) => {
          const rest = { ...prev };
          delete rest[id];
          return rest;
        });
      }
    });
  }

  const unstamp = (item: TodayItem) =>
    mutate(item.id, null, true, () => deleteLogRequest(item.id, date));

  // ワンタップではメモを送らず、既存のメモは API 側でそのまま残る
  const stamp = (item: TodayItem) =>
    mutate(item.id, { status: "DONE", note: logs[item.id]?.note ?? null }, true, () =>
      recordLogRequest(item.id, date, { status: "DONE" }),
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
    // 別の日への記録・付け替えは、その日のセクション（週の残回数・前回からの日数）も変えうるので再取得する。
    // 送信中の押印・取り消しより先に届くと付け替え元が食い違うため、同じ列に並べる
    const result = await enqueue(item.id, () => recordLogRequest(item.id, targetDate, input));
    if (result.ok) {
      setDetailId(null);
      showToast(`「${item.name}」を${formatShortDate(targetDate)}の分として記録しました`);
      router.refresh();
    }
    return result;
  }

  // 進捗はセクションに出る Duty だけで数える（期日でない日の記録は分母にも分子にも入れない）
  const scheduled = items.filter((item) => item.section !== null);
  const doneCount = scheduled.filter((item) => logs[item.id]?.status === "DONE").length;
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
        <div className="flex justify-between text-[13px] text-zumi-soft">
          <span>{text.progress}</span>
          <span>
            {doneCount} / {scheduled.length}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={text.progress}
          aria-valuemin={0}
          aria-valuemax={scheduled.length}
          aria-valuenow={doneCount}
          className="h-1.5 overflow-hidden rounded bg-zumi-line"
        >
          <div
            className={cn(
              "h-full rounded transition-[width] duration-300",
              mode === "future" ? "bg-zumi-soft opacity-40" : "bg-zumi-shu",
            )}
            style={{
              width: scheduled.length === 0 ? 0 : `${(doneCount / scheduled.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-[22px] px-[22px] pt-2">
        {!hasDuties ? (
          <div className="mt-2 rounded-2xl border border-dashed border-zumi-line px-4 py-8 text-center text-[13px] leading-relaxed text-zumi-soft">
            まだ Duty がありません。
            <br />
            <Link href="/app/duties" className="font-bold text-zumi-shu">
              Duty タブ
            </Link>
            から、定期的にやることを登録しましょう。
          </div>
        ) : items.length === 0 ? (
          <p className="mt-2 py-6 text-center text-[13px] text-zumi-soft">{text.empty}</p>
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
                  className="flex w-full items-center justify-between px-1 py-3 text-[13px] font-medium text-zumi-soft"
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
            <h2 className="mb-2.5 text-xs font-bold tracking-[.08em] text-zumi-soft">
              {text.list}
            </h2>
            <ul className="flex flex-col gap-2.5">{items.map(row)}</ul>
            {text.hint && (
              <p className="pb-[18px] pt-3.5 text-center text-[11.5px] text-zumi-soft">
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
          className="fixed inset-x-0 bottom-[calc(66px+max(12px,env(safe-area-inset-bottom))+12px)] z-30 mx-auto w-[calc(100%-44px)] max-w-[386px] rounded-2xl bg-zumi-ink px-4 py-3 text-[13px] text-white shadow-[0_8px_24px_rgba(30,26,20,.25)]"
        >
          {toast}
        </p>
      )}
    </>
  );
}
