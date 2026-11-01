import { DutyIcon } from "@/components/duty/duty-icon";
import type { WeeklySummary, WeeklySummaryDuty } from "@/lib/review";
import { cn } from "@/lib/utils";

/**
 * 週次サマリーカード（モック `ReviewSummary` のカード）。シェア画像（S10）と同じ見た目を想定し、
 * 表示する値はすべて `WeeklySummary` から取る。
 */
export function WeeklySummaryCard({ summary }: { summary: WeeklySummary }) {
  return (
    <div className="border-zumi-line bg-zumi-card rounded-[22px] border px-6 pb-5 pt-7 shadow-[0_14px_32px_rgba(30,26,20,0.06)]">
      <div className="text-zumi-soft mb-[22px] flex items-baseline justify-between text-[13.5px]">
        <span className="tracking-[.06em]">{formatPeriod(summary.weekStart, summary.weekEnd)}</span>
        <span className="opacity-65">第{summary.weekNumber}週</span>
      </div>

      <div className="mb-1.5 flex items-baseline gap-2.5">
        <span className="text-[52px] font-medium leading-none">{summary.done}</span>
        <span className="text-zumi-soft text-[21px]">/ {summary.total}</span>
        <DiffChip diff={summary.diff} />
      </div>
      <p className="text-zumi-soft mb-5 text-sm">{summary.caption}</p>

      {summary.duties.length > 0 && (
        <ul className="border-zumi-line border-t">
          {summary.duties.map((duty, index) => (
            <SummaryRow
              key={duty.id}
              duty={duty}
              index={index}
              isCurrentWeek={summary.isCurrentWeek}
            />
          ))}
        </ul>
      )}

      <div className="border-zumi-line mt-4 flex items-center justify-between border-t pt-4">
        <span className="text-sm font-bold tracking-[.12em]">ZUMI</span>
        <span className="text-zumi-soft text-[10.5px]">zumi.paritto.dev</span>
      </div>
    </div>
  );
}

/** 「2026.08.17 — 08.23」。年をまたぐ週は終わりにも年を付ける */
function formatPeriod(start: string, end: string): string {
  const dotted = (date: string) => date.replaceAll("-", ".");
  return `${dotted(start)} — ${start.slice(0, 4) === end.slice(0, 4) ? dotted(end.slice(5)) : dotted(end)}`;
}

/** 前週との差分（済んだ数の差）。減ったときも責める色にはしない */
function DiffChip({ diff }: { diff: number }) {
  return (
    <span
      className={cn(
        "ml-auto rounded-[20px] px-2.5 py-1 text-[13px] font-bold",
        diff > 0 ? "bg-zumi-success-bg text-zumi-success" : "bg-zumi-pill text-zumi-soft",
      )}
    >
      {diff === 0 ? "先週と同じ" : `先週 ${diff > 0 ? "+" : "−"}${Math.abs(diff)}`}
    </span>
  );
}

/** 朱印の傾き。手で押したように行ごとにずらす（モックの -9° / 6° / -4°） */
const SEAL_ROTATIONS = ["-rotate-[9deg]", "rotate-[6deg]", "-rotate-[4deg]"] as const;

function SummaryRow({
  duty,
  index,
  isCurrentWeek,
}: {
  duty: WeeklySummaryDuty;
  index: number;
  isCurrentWeek: boolean;
}) {
  const complete = duty.done >= duty.total;
  // 未達の名前を薄くするのは終わった週だけ（今週はまだ途中のため）
  const missed = !complete && !isCurrentWeek;
  return (
    <li className="border-zumi-line flex items-center gap-3 border-b py-3.5 last:border-b-0">
      <DutyIcon
        name={duty.icon}
        className="text-zumi-soft size-[19px] shrink-0"
        strokeWidth={1.6}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-[15px]", missed && "text-zumi-soft")}>{duty.name}</span>
        <span className="text-zumi-soft mt-0.5 truncate text-xs">
          {duty.schedule} · {duty.done}/{duty.total}
        </span>
      </span>
      {complete ? (
        <span
          className={cn(
            "border-zumi-shu text-zumi-shu flex size-[42px] shrink-0 items-center justify-center rounded-full border-2 font-['Yuji_Syuku',serif] text-xl",
            SEAL_ROTATIONS[index % SEAL_ROTATIONS.length],
          )}
          role="img"
          aria-label="済"
        >
          済
        </span>
      ) : (
        <span className="border-zumi-line text-zumi-soft flex size-[42px] shrink-0 items-center justify-center rounded-full border-2 border-dashed text-[10.5px] font-bold">
          {isCurrentWeek ? `あと${duty.total - duty.done}` : "来週"}
        </span>
      )}
    </li>
  );
}
