"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays } from "@zumi/types";
import { getDayMode, type DayData, type TodayLog } from "@/lib/today";
import { TodayHeader } from "./today-header";
import { TodayView } from "./today-view";
import { useSwipeNav } from "./use-swipe-nav";

/** 表示日の前後、この日数ぶんを先に取っておく */
const PREFETCH_DAYS = 3;
/** 先読みしたデータをこの時間より長く使い回さない（他の端末の記録を取りこぼさないため）。表示中の日は対象外 */
const STALE_MS = 2 * 60 * 1000;

const dayHref = (date: string, today: string) => (date === today ? "/app" : `/app?date=${date}`);

type Days = Record<string, DayData>;

/**
 * 今日タブの日付の移動（docs/04-screens.md「4-1. 今日」の「日付の移動」）。
 * 最初の1日だけサーバーで描画し、前後の日は `/api/today` でまとめて先読みして、移動はクライアントだけで済ませる
 * （移動のたびにサーバーへ往復すると、通信の遅い環境では2秒ほど待たされたため）。
 * URL（`?date=`）は `history.replaceState` で追従させる。リロード・共有・振り返りからの遷移は従来どおり動く。
 */
export function TodayPager({
  initial,
  today,
  vapidPublicKey,
}: {
  initial: DayData;
  today: string;
  vapidPublicKey: string | null;
}) {
  const [date, setDate] = useState(initial.date);
  const [days, setDays] = useState<Days>({ [initial.date]: initial });
  /** 先読みの取得に失敗した（表示中の日が空のときだけ画面に出す） */
  const [failed, setFailed] = useState(false);
  /** 無効化のたびに増やす。先読みの効果を取り直し、古い応答を捨てる */
  const [epoch, setEpoch] = useState(0);

  // サーバーから新しい初期データが届いたら（router.refresh の後）、先読みを捨てて合わせる
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setDate(initial.date);
    setDays({ [initial.date]: initial });
    setEpoch((n) => n + 1);
  }

  const fetchedAt = useRef(new Map<string, number>());
  const inflight = useRef(new Set<string>());
  const daysRef = useRef(days);
  const epochRef = useRef(epoch);
  const dateRef = useRef(date);
  useEffect(() => {
    daysRef.current = days;
    epochRef.current = epoch;
    dateRef.current = date;
  });

  const load = useCallback(async (dates: string[]) => {
    const forEpoch = epochRef.current;
    dates.forEach((d) => inflight.current.add(d));
    try {
      const response = await fetch(`/api/today?dates=${dates.join(",")}`);
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { days: DayData[] };
      if (forEpoch !== epochRef.current) return;
      const now = Date.now();
      setDays((prev) => {
        const next = { ...prev };
        for (const day of body.days) {
          // 表示中の日は、画面側の状態（押印など）を持っているので差し替えない
          if (day.date === dateRef.current && prev[day.date]) continue;
          next[day.date] = day;
          fetchedAt.current.set(day.date, now);
        }
        return next;
      });
      setFailed(false);
    } catch {
      if (forEpoch === epochRef.current) setFailed(true);
    } finally {
      dates.forEach((d) => inflight.current.delete(d));
    }
  }, []);

  // 表示日の前後を先読みする（足りない日と、古くなった日だけ）。近い日から取る
  useEffect(() => {
    const now = Date.now();
    const want: string[] = [];
    for (let i = 0; i <= PREFETCH_DAYS; i++) {
      for (const offset of i === 0 ? [0] : [i, -i]) {
        const d = addDays(date, offset);
        if (inflight.current.has(d)) continue;
        const missing = !daysRef.current[d];
        // 表示中の日は、画面側の状態を持っているので古くても取り直さない
        const stale = offset !== 0 && now - (fetchedAt.current.get(d) ?? 0) > STALE_MS;
        if (missing || stale) want.push(d);
      }
    }
    if (want.length > 0) void load(want);
  }, [date, epoch, load]);

  const go = useCallback(
    (target: string) => {
      setDate(target);
      setFailed(false);
      window.history.replaceState(null, "", dayHref(target, today));
    },
    [today],
  );

  /** 押印の結果を、先読みしたその日のデータにも反映する（戻ってきたときに食い違わないため） */
  const onLogChanged = useCallback((id: string, log: TodayLog | null) => {
    const key = dateRef.current;
    setDays((prev) => {
      const day = prev[key];
      if (!day) return prev;
      return {
        ...prev,
        [key]: { ...day, items: day.items.map((i) => (i.id === id ? { ...i, log } : i)) },
      };
    });
    invalidateOthers();
  }, []);

  /**
   * 他の日のセクション（週の残回数・前回からの日数）は、記録で変わりうる。
   * 先読みを捨てて取り直す
   */
  function invalidateOthers() {
    const keep = dateRef.current;
    setDays((prev) => (prev[keep] ? { [keep]: prev[keep] } : {}));
    fetchedAt.current.clear();
    setEpoch((n) => n + 1);
  }

  const swipeRef = useSwipeNav((dir) => go(addDays(dateRef.current, dir)), true);

  const day = days[date];
  const mode = day?.mode ?? getDayMode(date, today);

  return (
    <>
      <TodayHeader date={date} today={today} mode={mode} onNavigate={go} />
      <div ref={swipeRef} className="touch-pan-y">
        {day ? (
          /* 日付ごとに作り直し、前の日の楽観的な状態や送信中のリクエストを持ち越さない */
          <TodayView
            key={day.date}
            {...day}
            today={today}
            vapidPublicKey={day.mode === "today" ? vapidPublicKey : null}
            onLogChanged={onLogChanged}
            onInvalidate={invalidateOthers}
          />
        ) : (
          <DaySkeleton failed={failed} onRetry={() => void load([date])} />
        )}
      </div>
    </>
  );
}

function DaySkeleton({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  if (failed) {
    return (
      <div className="px-[22px] py-10 text-center text-[13px] text-zumi-soft">
        <p>読み込めませんでした。</p>
        <button type="button" onClick={onRetry} className="mt-3 font-bold text-zumi-shu">
          もう一度読み込む
        </button>
      </div>
    );
  }
  return (
    <div
      aria-busy="true"
      aria-label="読み込み中"
      className="flex animate-pulse flex-col gap-2.5 px-[22px] pt-5"
    >
      <div className="h-1.5 rounded bg-zumi-line" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[62px] rounded-2xl bg-zumi-line/60" />
      ))}
    </div>
  );
}
