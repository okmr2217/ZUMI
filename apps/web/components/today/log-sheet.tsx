"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/app/bottom-sheet";
import { isLocalDate, NOTE_MAX_LENGTH, type LogInput } from "@/lib/log-input";
import type { TodayItem, TodayLog } from "@/lib/today";
import { formatShortDate } from "@/lib/schedule-text";
import { logErrorMessage, type LogApiResult } from "./log-api-client";

const fieldLabel = "text-zumi-soft mb-2 block text-[11.5px] font-bold tracking-[.06em]";
const field =
  "border-zumi-line bg-zumi-card w-full rounded-[14px] border px-3.5 py-[13px] text-[14.5px] font-semibold outline-none focus:border-zumi-shu";

/**
 * 長押しの詳細モーダル（docs/03「記録操作」）。対象日の変更・スキップ・メモ（`noteEnabled` のときだけ）。
 * モックに専用のアートボードはないため、DutyEdit と同じボトムシートの部品で組む。
 */
export function LogSheet({
  item,
  log,
  date,
  today,
  onClose,
  onSubmit,
  onUndo,
}: {
  item: TodayItem | null;
  log: TodayLog | null;
  /** 開いている日 */
  date: string;
  today: string;
  onClose: () => void;
  /** 記録する。失敗したらエラーコードを返す（シートは開いたまま） */
  onSubmit: (targetDate: string, input: LogInput) => Promise<LogApiResult>;
  onUndo: () => void;
}) {
  return (
    <BottomSheet open={item !== null} onClose={onClose} title={item?.name ?? ""}>
      {item && (
        <LogSheetForm
          key={item.id}
          item={item}
          log={log}
          date={date}
          today={today}
          onSubmit={onSubmit}
          onUndo={onUndo}
        />
      )}
    </BottomSheet>
  );
}

function LogSheetForm({
  item,
  log,
  date,
  today,
  onSubmit,
  onUndo,
}: {
  item: TodayItem;
  log: TodayLog | null;
  date: string;
  today: string;
  onSubmit: (targetDate: string, input: LogInput) => Promise<LogApiResult>;
  onUndo: () => void;
}) {
  const [targetDate, setTargetDate] = useState(date);
  const [note, setNote] = useState(log?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(status: LogInput["status"]) {
    if (!isLocalDate(targetDate) || targetDate > today || targetDate < item.createdDate) {
      setError(logErrorMessage("invalid_date"));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onSubmit(targetDate, {
      status,
      ...(item.noteEnabled ? { note } : {}),
      // この日のログを別の日に付け替える。ログがなければ、選んだ日に記録するだけ
      ...(log && targetDate !== date ? { moveFrom: date } : {}),
    });
    setBusy(false);
    if (!result.ok) setError(logErrorMessage(result.error));
  }

  const status = log ? (log.status === "DONE" ? "済" : "スキップ") : "未記録";

  return (
    <>
      <p className="text-zumi-soft -mt-2 text-xs">
        {formatShortDate(date)}の記録：{status}
      </p>

      <label>
        <span className={fieldLabel}>対象日</span>
        <input
          type="date"
          value={targetDate}
          min={item.createdDate}
          max={today}
          required
          onChange={(event) => setTargetDate(event.target.value)}
          className={field}
        />
      </label>

      {item.noteEnabled && (
        <label>
          <span className={fieldLabel}>メモ</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={NOTE_MAX_LENGTH}
            rows={3}
            placeholder="任意"
            className={`${field} resize-none font-medium`}
          />
        </label>
      )}

      {error && (
        <p role="alert" className="text-zumi-shu-deep text-[12.5px] font-semibold">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => submit("DONE")}
          className="bg-zumi-shu rounded-2xl p-[15px] text-[15px] font-bold text-white disabled:opacity-60"
        >
          済にする
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit("SKIP")}
          className="border-zumi-line bg-zumi-card rounded-2xl border p-[14px] text-[14px] font-bold disabled:opacity-60"
        >
          スキップする
        </button>
        {log && (
          <button
            type="button"
            disabled={busy}
            onClick={onUndo}
            className="text-zumi-soft py-1.5 text-[12.5px] font-semibold disabled:opacity-60"
          >
            記録を取り消す
          </button>
        )}
      </div>
    </>
  );
}
