"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import type { WeekStart } from "@zumi/types";
import { BottomSheet } from "@/components/app/bottom-sheet";
import { DutyFormFields } from "./duty-form-fields";
import { emptyDutyDraft, toDutyInput, type DutyDraft } from "./duty-draft";
import { LIMIT_MESSAGE, createDutyRequest, errorMessage } from "./duty-api-client";

/** ユーザーの暦。`today` はユーザーのタイムゾーンでの今日 */
export interface DutyCalendar {
  today: string;
  timeZone: string;
  weekStart: WeekStart;
}

/**
 * Duty 追加シート（Duty タブ・テンプレート画面・オンボーディングで共通）。
 * `initialDraft` を渡すとテンプレートの内容が入った状態で開く。即登録はせず、
 * 「追加する」で確定する。繰り返しが未入力（ゴミ出しの曜日など）の間は押せない。
 *
 * - `templatesHref`: 上部の「テンプレートから作成する」リンクの行き先。省略すると出さない
 * - `limitReached`: 上限（10件）に達しているときは、決済には触れず枠の空け方を案内する
 */
export function DutyCreateSheet({
  open,
  onClose,
  onCreated,
  calendar,
  initialDraft,
  templatesHref,
  limitReached = false,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  calendar: DutyCalendar;
  initialDraft?: DutyDraft;
  templatesHref?: string;
  limitReached?: boolean;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Dutyを追加">
      <CreateForm
        calendar={calendar}
        initialDraft={initialDraft ?? emptyDutyDraft(calendar.today)}
        templatesHref={templatesHref}
        limitReached={limitReached}
        onCreated={onCreated}
      />
    </BottomSheet>
  );
}

// シートを開くたびにマウントし直して、前回の入力を残さない
function CreateForm({
  calendar,
  initialDraft,
  templatesHref,
  limitReached,
  onCreated,
}: {
  calendar: DutyCalendar;
  initialDraft: DutyDraft;
  templatesHref?: string;
  limitReached: boolean;
  onCreated: () => void;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(limitReached ? LIMIT_MESSAGE : null);
  // 作成前のプレビューは、作成日時を今・ログと一時停止を空にして計算する
  const [context] = useState(() => ({
    ...calendar,
    createdAt: new Date(),
    logs: [],
    pauses: [],
  }));
  const input = toDutyInput(draft);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await createDutyRequest(input);
    setSubmitting(false);
    if (result.ok) onCreated();
    else setError(errorMessage(result.error));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      {templatesHref && (
        <Link
          href={templatesHref}
          className="-mt-1 flex items-center gap-1.5 self-start text-[12.5px] font-semibold text-zumi-shu-deep"
        >
          <LayoutGrid className="size-3.5" strokeWidth={1.8} aria-hidden />
          テンプレートから作成する
        </Link>
      )}
      <DutyFormFields value={draft} onChange={setDraft} context={context} />
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-zumi-pill px-[13px] py-2.5 text-[12.5px] font-semibold"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!input || submitting || limitReached}
        className="w-full rounded-2xl bg-zumi-shu p-[15px] text-[15px] font-bold text-white disabled:opacity-40"
      >
        {submitting ? "追加しています…" : "追加する"}
      </button>
    </form>
  );
}
