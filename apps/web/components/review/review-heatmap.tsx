import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HeatmapDutySelect } from "@/components/review/heatmap-duty-select";
import { formatDayLabel, WEEKDAY_LABELS } from "@/lib/date-label";
import type { HistoryDutyOption, MonthHeatmap, HeatmapDay } from "@/lib/review";
import { cn } from "@/lib/utils";

/**
 * 月次カレンダーヒートマップ（モック `ReviewHeatmap`）。日ごとの「済んだ数 / 予定の数」を、
 * 朱の濃淡で表す。セルをタップすると、その日の今日タブ（`/app?date=`）を開く。
 */
export function ReviewHeatmap({
  heatmap,
  today,
  weekStart,
  dutyOptions,
  dutyId,
  previousMonthHref,
  nextMonthHref,
  currentMonth,
}: {
  heatmap: MonthHeatmap;
  today: string;
  weekStart: 0 | 1;
  dutyOptions: HistoryDutyOption[];
  dutyId: string | null;
  previousMonthHref: string | null;
  nextMonthHref: string | null;
  currentMonth: string;
}) {
  const [year, month] = heatmap.month.split("-").map(Number) as [number, number];
  // 週の始まりに合わせて曜日の並びを回す（月曜始まりなら 月〜日）
  const weekdays = Array.from({ length: 7 }, (_, i) => WEEKDAY_LABELS[(weekStart + i) % 7]!);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <HeatmapDutySelect
          options={dutyOptions}
          value={dutyId}
          month={heatmap.month === currentMonth ? null : heatmap.month}
        />
      </div>

      <div className="rounded-[22px] border border-zumi-line bg-zumi-card p-5 shadow-[0_14px_32px_rgba(30,26,20,0.06)]">
        <div className="mb-4 flex items-center justify-between">
          <MonthLink href={previousMonthHref} label="前の月">
            <ChevronLeft className="size-[13px]" strokeWidth={2} aria-hidden />
          </MonthLink>
          <h2 className="text-base font-bold">
            {year}年{month}月
          </h2>
          <MonthLink href={nextMonthHref} label="次の月">
            <ChevronRight className="size-[13px]" strokeWidth={2} aria-hidden />
          </MonthLink>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-2" aria-hidden>
          {weekdays.map((label) => (
            <span key={label} className="text-center text-[10.5px] text-zumi-soft">
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: heatmap.leadingBlanks }, (_, i) => (
            <span key={`blank-${i}`} aria-hidden />
          ))}
          {heatmap.days.map((day) => (
            <HeatCell key={day.date} day={day} isToday={day.date === today} />
          ))}
        </div>

        <div className="mt-[18px] flex items-center justify-center gap-2">
          <span className="text-[10.5px] text-zumi-soft">未達成</span>
          <div className="flex gap-1" aria-hidden>
            <span className="size-3.5 rounded bg-zumi-pill" />
            {LEGEND_ALPHAS.map((alpha) => (
              <span
                key={alpha}
                className="size-3.5 rounded"
                style={{ backgroundColor: shu(alpha) }}
              />
            ))}
          </div>
          <span className="text-[10.5px] text-zumi-soft">全て済</span>
        </div>
        <p className="mt-3.5 text-center text-[11.5px] text-zumi-soft">
          タップすると、その日の記録・予定ページを開けます
        </p>
      </div>
    </div>
  );
}

/** 朱（`zumi-shu` = #C8402A）の濃さ。凡例とセルで同じ段階を使う */
const LEGEND_ALPHAS = [0.2, 0.5, 0.85, 1] as const;
const shu = (alpha: number) => `rgba(200,64,42,${alpha})`;

/** 済んだ割合から濃さを決める。0 は「未達成」の色（`bg-zumi-pill`）で、濃さは付けない */
function heatAlpha({ done, total }: HeatmapDay): number | null {
  if (total === 0 || done === 0) return null;
  const ratio = done / total;
  if (ratio >= 1) return LEGEND_ALPHAS[3];
  if (ratio > 2 / 3) return LEGEND_ALPHAS[2];
  if (ratio > 1 / 3) return LEGEND_ALPHAS[1];
  return LEGEND_ALPHAS[0];
}

function HeatCell({ day, isToday }: { day: HeatmapDay; isToday: boolean }) {
  const alpha = heatAlpha(day);
  const fraction = day.total === 0 ? "–" : `${day.done}/${day.total}`;
  const label =
    day.total === 0
      ? `${formatDayLabel(day.date)} 予定なし`
      : `${formatDayLabel(day.date)} ${day.total}件中${day.done}件済`;
  return (
    <Link
      // 今日は `/app`（`?date=` に今日を付けると `/app` へ戻されるため、はじめから今日の URL にする）
      href={isToday ? "/app" : `/app?date=${day.date}`}
      aria-label={label}
      aria-current={isToday ? "date" : undefined}
      style={alpha === null ? undefined : { backgroundColor: shu(alpha) }}
      className={cn(
        "flex aspect-square items-center justify-center rounded-[9px] text-[10px] font-bold tracking-[-.02em]",
        alpha === null ? "bg-zumi-pill" : "",
        alpha !== null && alpha >= 0.5 ? "text-[#FBEFEA]" : "text-zumi-soft",
        day.total === 0 && "opacity-60",
        isToday && "ring-2 ring-zumi-ink ring-offset-1 ring-offset-zumi-card",
      )}
    >
      {fraction}
    </Link>
  );
}

function MonthLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "flex size-[30px] items-center justify-center rounded-full border border-zumi-line bg-zumi-bg text-zumi-soft";
  if (href === null) {
    return (
      <span className={cn(className, "opacity-40")} aria-hidden>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} scroll={false} aria-label={label} className={className}>
      {children}
    </Link>
  );
}
