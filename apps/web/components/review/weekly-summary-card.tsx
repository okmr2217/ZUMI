import { DutyIcon } from "@/components/duty/duty-icon";
import { formatPeriod } from "@/lib/date-label";
import type { WeeklySummary, WeeklySummaryDuty } from "@/lib/review";
import { cn } from "@/lib/utils";

/**
 * 週次サマリーカード（モック `ReviewSummary` のカード）。シェア画像（S10）と同じ見た目を想定し、
 * 表示する値はすべて `WeeklySummary` から取る。
 */
export function WeeklySummaryCard({ summary }: { summary: WeeklySummary }) {
  return (
    <div className="rounded-[22px] border border-zumi-line bg-zumi-card px-6 pb-5 pt-7 shadow-[0_14px_32px_rgba(30,26,20,0.06)]">
      <div className="mb-[22px] flex items-baseline justify-between text-[13.5px] text-zumi-soft">
        <span className="tracking-[.06em]">{formatPeriod(summary.weekStart, summary.weekEnd)}</span>
        <span className="opacity-65">第{summary.weekNumber}週</span>
      </div>

      <div className="mb-1.5 flex items-baseline gap-2.5">
        <span className="text-[52px] font-medium leading-none">{summary.done}</span>
        <span className="text-[21px] text-zumi-soft">/ {summary.total}</span>
        <DiffChip diff={summary.diff} />
      </div>
      <p className="mb-5 text-sm text-zumi-soft">{summary.caption}</p>

      {summary.duties.length > 0 && (
        <ul className="border-t border-zumi-line">
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

      <div className="mt-4 flex items-center justify-between border-t border-zumi-line pt-4">
        <span className="text-sm font-bold tracking-[.12em]">ZUMI</span>
        <span className="text-[10.5px] text-zumi-soft">zumi.paritto.dev</span>
      </div>
    </div>
  );
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
    <li className="flex items-center gap-3 border-b border-zumi-line py-3.5 last:border-b-0">
      <DutyIcon
        name={duty.icon}
        className="size-[19px] shrink-0 text-zumi-soft"
        strokeWidth={1.6}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-[15px]", missed && "text-zumi-soft")}>{duty.name}</span>
        <span className="mt-0.5 truncate text-xs text-zumi-soft">
          {duty.schedule} · {duty.done}/{duty.total}
        </span>
      </span>
      {complete ? (
        <span
          className={cn(
            "flex size-[42px] shrink-0 items-center justify-center rounded-full border-2 border-zumi-shu font-seal text-xl text-zumi-shu",
            SEAL_ROTATIONS[index % SEAL_ROTATIONS.length],
          )}
          role="img"
          aria-label="済"
        >
          済
        </span>
      ) : (
        <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-zumi-line text-[10.5px] font-bold text-zumi-soft">
          {isCurrentWeek ? `あと${duty.total - duty.done}` : "来週"}
        </span>
      )}
    </li>
  );
}
