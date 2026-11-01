"use client";

import { useState } from "react";
import type { DutyLog, DutyPause, DutyStatus, ScheduleConfig } from "@zumi/types";
import { presetIconNameSchema } from "@zumi/types";
import { BottomSheet } from "@/components/app/bottom-sheet";
import { draftFromConfig } from "@/lib/schedule-draft";
import { DutyFormFields } from "./duty-form-fields";
import { toDutyInput, type DutyDraft, type DutyFormContext } from "./duty-draft";
import { changeDutyStatusRequest, errorMessage, updateDutyRequest } from "./duty-api-client";
import type { DutyCalendar } from "./duty-create-sheet";

/** 編集シートに渡す Duty（一覧画面がサーバーから受け取った値） */
export interface EditableDuty {
  id: string;
  name: string;
  icon: string;
  scheduleConfig: ScheduleConfig;
  notifyPrevNight: boolean;
  noteEnabled: boolean;
  status: DutyStatus;
  createdAt: Date;
  /** 次の期日のプレビュー用（一時停止期間と最近のログ） */
  pauses: Pick<DutyPause, "startDate" | "endDate">[];
  logs: Pick<DutyLog, "targetDate" | "status">[];
}

/**
 * Duty 編集シート（モックの DutyEdit）。名前・アイコン・繰り返し・前夜通知・メモ欄を編集し、
 * 下部の文字リンクで一時停止（一時停止中なら再開）・アーカイブする。
 */
export function DutyEditSheet({
  duty,
  onClose,
  onChanged,
  calendar,
}: {
  duty: EditableDuty | null;
  onClose: () => void;
  onChanged: () => void;
  calendar: DutyCalendar;
}) {
  return (
    <BottomSheet open={duty !== null} onClose={onClose} title="Dutyを編集">
      {duty && <EditForm key={duty.id} duty={duty} calendar={calendar} onChanged={onChanged} />}
    </BottomSheet>
  );
}

function EditForm({
  duty,
  calendar,
  onChanged,
}: {
  duty: EditableDuty;
  calendar: DutyCalendar;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<DutyDraft>(() => {
    // 一覧から外したアイコンが残っている場合は、選び直してもらうまでプリセットの先頭を選んでおく
    const icon = presetIconNameSchema.safeParse(duty.icon);
    return {
      name: duty.name,
      icon: icon.success ? icon.data : "sparkles",
      schedule: draftFromConfig(duty.scheduleConfig, calendar.today),
      notifyPrevNight: duty.notifyPrevNight,
      noteEnabled: duty.noteEnabled,
    };
  });
  const [context] = useState<DutyFormContext>(() => ({
    ...calendar,
    createdAt: duty.createdAt,
    logs: duty.logs,
    pauses: duty.pauses,
  }));
  const [pending, setPending] = useState<"save" | "pause" | "resume" | "archive" | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = toDutyInput(draft);

  async function run(
    kind: NonNullable<typeof pending>,
    request: () => ReturnType<typeof updateDutyRequest>,
  ) {
    if (pending) return;
    setPending(kind);
    setError(null);
    const result = await request();
    setPending(null);
    if (result.ok) onChanged();
    else setError(errorMessage(result.error));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (input) void run("save", () => updateDutyRequest(duty.id, input));
      }}
      className="flex flex-col gap-[18px]"
    >
      <DutyFormFields value={draft} onChange={setDraft} context={context} />
      {error && (
        <p
          role="alert"
          className="bg-zumi-pill rounded-xl px-[13px] py-2.5 text-[12.5px] font-semibold"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!input || pending !== null}
        className="bg-zumi-shu w-full rounded-2xl p-[15px] text-[15px] font-bold text-white disabled:opacity-40"
      >
        {pending === "save" ? "保存しています…" : "保存する"}
      </button>

      {confirmingArchive ? (
        <div className="border-zumi-line bg-zumi-card rounded-[14px] border p-[15px]">
          <p className="text-[13.5px] font-semibold">「{duty.name}」をアーカイブしますか？</p>
          <p className="text-zumi-soft mt-1 text-[11.5px]">
            今日の一覧と通知から外れます。これまでの記録は残ります。
          </p>
          <div className="mt-3 flex justify-end gap-[22px] text-[12.5px] font-semibold">
            <button
              type="button"
              onClick={() => setConfirmingArchive(false)}
              className="text-zumi-soft"
            >
              やめる
            </button>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => run("archive", () => changeDutyStatusRequest(duty.id, "archive"))}
              className="text-zumi-shu-deep disabled:opacity-40"
            >
              {pending === "archive" ? "アーカイブしています…" : "アーカイブする"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center gap-[22px] pt-0.5 text-[12.5px] font-semibold">
          {duty.status === "PAUSED" ? (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => run("resume", () => changeDutyStatusRequest(duty.id, "resume"))}
              className="text-zumi-soft disabled:opacity-40"
            >
              {pending === "resume" ? "再開しています…" : "再開する"}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => run("pause", () => changeDutyStatusRequest(duty.id, "pause"))}
              className="text-zumi-soft disabled:opacity-40"
            >
              {pending === "pause" ? "一時停止しています…" : "一時停止する"}
            </button>
          )}
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => setConfirmingArchive(true)}
            className="text-zumi-shu-deep disabled:opacity-40"
          >
            アーカイブする
          </button>
        </div>
      )}
    </form>
  );
}
