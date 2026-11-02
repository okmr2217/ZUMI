"use client";

import { Lock } from "lucide-react";
import { DutyIcon } from "@/components/duty/duty-icon";
import type { DayMode, TodayItem, TodayLog } from "@/lib/today";
import { cn } from "@/lib/utils";
import { useLongPress } from "./use-long-press";

/**
 * 今日タブの Duty 行（モックの `.row`）。右端の空円をタップすると即「済」、
 * 朱印・スキップの印をタップすると取り消す。行の長押しで詳細モーダルを開く。
 * 未来日は確認のみで、錠前を出して操作を受け付けない。
 */
export function TodayRow({
  item,
  log,
  mode,
  stamped,
  onStamp,
  onUnstamp,
  onOpenDetail,
}: {
  item: TodayItem;
  log: TodayLog | null;
  mode: DayMode;
  /** 押した直後か（押印のアニメーションを出す） */
  stamped: boolean;
  onStamp: () => void;
  onUnstamp: () => void;
  onOpenDetail: () => void;
}) {
  const interactive = mode !== "future";
  const { handlers, consumeLongPress } = useLongPress(onOpenDetail, interactive);
  // 過去日はモック（MainPast）どおり、未記録なら「未記録」と出す
  const detail = mode === "past" && !log ? "未記録" : item.detail;
  const warn = mode === "today" && item.section === "SOON";

  /** 長押しの指を離したときの click では押さない */
  const guard = (action: () => void) => () => {
    if (!consumeLongPress()) action();
  };

  return (
    <div
      {...handlers}
      className={cn(
        "border-zumi-line bg-zumi-card flex select-none items-center gap-3 rounded-2xl border p-3.5 [-webkit-touch-callout:none]",
        mode === "future" && "opacity-60",
      )}
    >
      <span className="bg-zumi-base text-zumi-ink flex size-[42px] shrink-0 items-center justify-center rounded-xl">
        <DutyIcon name={item.icon} className="size-5" strokeWidth={1.6} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-[15px] font-bold">{item.name}</span>
        {warn ? (
          <span className="bg-zumi-warn-bg text-zumi-warn w-fit rounded-[20px] px-2 py-0.5 text-[11px] font-bold">
            {detail}
          </span>
        ) : (
          <span className="text-zumi-soft truncate text-xs">{detail}</span>
        )}
        {log?.note && <span className="text-zumi-soft truncate text-[11.5px]">{log.note}</span>}
      </span>
      {interactive && (
        <button type="button" onClick={onOpenDetail} className="sr-only">
          {item.name}の詳細
        </button>
      )}
      {!interactive ? (
        <span
          className="border-zumi-line text-zumi-soft flex size-[30px] shrink-0 items-center justify-center rounded-full border-2 border-dashed"
          aria-label="先の予定のため、まだ記録できません"
          role="img"
        >
          <Lock className="size-3" strokeWidth={1.7} aria-hidden />
        </span>
      ) : log?.status === "DONE" ? (
        <button
          type="button"
          onClick={guard(onUnstamp)}
          aria-label={`${item.name}の「済」を取り消す`}
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <Hanko animate={stamped} />
        </button>
      ) : log?.status === "SKIP" ? (
        <button
          type="button"
          onClick={guard(onUnstamp)}
          aria-label={`${item.name}のスキップを取り消す`}
          className="flex h-11 shrink-0 items-center"
        >
          <span className="bg-zumi-pill text-zumi-soft rounded-[20px] px-[9px] py-[3px] text-[10px] font-bold">
            スキップ
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={guard(onStamp)}
          aria-label={`${item.name}を済にする`}
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <span className="border-zumi-line size-[30px] rounded-full border-2" />
        </button>
      )}
    </div>
  );
}

/** 「済」の朱印（モックの `.hanko`） */
function Hanko({ animate }: { animate: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "border-zumi-shu text-zumi-shu font-seal flex size-11 rotate-[-8deg] items-center justify-center rounded-full border-[2.5px] text-[21px] shadow-[inset_0_0_0_1px_rgba(200,64,42,0.25)]",
        animate && "motion-safe:animate-stamp",
      )}
    >
      済
    </span>
  );
}
