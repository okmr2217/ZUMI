"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";
import { summarizeSchedule } from "@/lib/schedule-text";
import { DutyIcon } from "./duty-icon";
import { DutyCreateSheet, type DutyCalendar } from "./duty-create-sheet";
import { DutyEditSheet, type EditableDuty } from "./duty-edit-sheet";
import { LIMIT_MESSAGE } from "./duty-api-client";

/**
 * Duty タブ（モックの DutyList）。カードは作成順（`sortOrder`）。DnD の並び替えは v1.1 のため、
 * モックの並び替えハンドルは出さず、カード全体のタップで編集シートを開く。
 * アーカイブ済みは一覧の下に折りたたんで出す（閲覧のみ）。
 */
export function DutyList({
  calendar,
  duties,
  archived,
  limitReached,
}: {
  calendar: DutyCalendar;
  duties: EditableDuty[];
  archived: EditableDuty[];
  limitReached: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditableDuty | null>(null);
  const [showLimit, setShowLimit] = useState(false);

  function handleChanged() {
    setCreating(false);
    setEditing(null);
    setShowLimit(false);
    router.refresh();
  }

  return (
    <main>
      <PageHeader
        title="Duty"
        action={
          <button
            type="button"
            onClick={() => (limitReached ? setShowLimit(true) : setCreating(true))}
            className="flex items-center gap-1.5 rounded-[20px] bg-zumi-shu px-3.5 py-[9px] text-xs font-bold text-white"
          >
            <Plus className="size-[13px]" strokeWidth={2.2} aria-hidden />
            追加
          </button>
        }
      />

      <div className="flex flex-col gap-2.5 px-[22px] pt-4">
        {showLimit && (
          <p
            role="alert"
            className="rounded-xl bg-zumi-pill px-[13px] py-2.5 text-[12.5px] font-semibold"
          >
            {LIMIT_MESSAGE}
          </p>
        )}

        {duties.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zumi-line px-4 py-8 text-center text-[13px] text-zumi-soft">
            まだ Duty がありません。
            <br />
            「追加」から、定期的にやることを登録しましょう。
          </div>
        )}

        <ul className="flex flex-col gap-2.5">
          {duties.map((duty) => (
            <li key={duty.id}>
              <DutyCard
                duty={duty}
                weekStart={calendar.weekStart}
                onClick={() => setEditing(duty)}
              />
            </li>
          ))}
        </ul>

        {archived.length > 0 && (
          <details className="group mt-4">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-bold tracking-[.08em] text-zumi-soft [&::-webkit-details-marker]:hidden">
              アーカイブ済み（{archived.length}）
              <ChevronDown
                className="size-3.5 transition-transform group-open:rotate-180"
                strokeWidth={2}
                aria-hidden
              />
            </summary>
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {archived.map((duty) => (
                <li key={duty.id}>
                  <DutyCard duty={duty} weekStart={calendar.weekStart} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <DutyCreateSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={handleChanged}
        calendar={calendar}
        templatesHref="/app/duties/templates"
        limitReached={limitReached}
      />
      <DutyEditSheet
        duty={editing}
        onClose={() => setEditing(null)}
        onChanged={handleChanged}
        calendar={calendar}
      />
    </main>
  );
}

function DutyCard({
  duty,
  weekStart,
  onClick,
}: {
  duty: EditableDuty;
  weekStart: DutyCalendar["weekStart"];
  onClick?: () => void;
}) {
  const badge =
    duty.status === "PAUSED" ? "一時停止" : duty.status === "ARCHIVED" ? "アーカイブ" : null;
  const summary =
    duty.status === "PAUSED" ? "一時停止中" : summarizeSchedule(duty.scheduleConfig, weekStart);
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-zumi-base text-zumi-ink">
        <DutyIcon name={duty.icon} className="size-[19px]" strokeWidth={1.6} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-[14.5px] font-bold">{duty.name}</span>
        <span className="truncate text-[11.5px] text-zumi-soft">{summary}</span>
      </span>
      {badge && (
        <span className="shrink-0 rounded-[20px] bg-zumi-pill px-[7px] py-0.5 text-[9.5px] font-bold text-zumi-soft">
          {badge}
        </span>
      )}
    </>
  );
  const className = cn(
    "flex w-full items-center gap-3 rounded-2xl border border-zumi-line bg-zumi-card px-3.5 py-[13px] text-left",
    duty.status !== "ACTIVE" && "opacity-[.55]",
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
