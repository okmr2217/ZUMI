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
        "flex select-none items-center gap-3 rounded-2xl border border-zumi-line bg-zumi-card p-3.5 [-webkit-touch-callout:none]",
        mode === "future" && "opacity-60",
      )}
    >
      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-xl bg-zumi-base text-zumi-ink">
        <DutyIcon name={item.icon} className="size-5" strokeWidth={1.6} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-[15px] font-bold">{item.name}</span>
        {warn ? (
          <span className="w-fit rounded-[20px] bg-zumi-warn-bg px-2 py-0.5 text-[11px] font-bold text-zumi-warn">
            {detail}
          </span>
        ) : (
          <span className="truncate text-xs text-zumi-soft">{detail}</span>
        )}
        {log?.note && <span className="truncate text-[11.5px] text-zumi-soft">{log.note}</span>}
      </span>
      {interactive && (
        <button type="button" onClick={onOpenDetail} className="sr-only">
          {item.name}の詳細
        </button>
      )}
      {!interactive ? (
        <span
          className="flex size-[30px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-zumi-line text-zumi-soft"
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
          <span className="rounded-[20px] bg-zumi-pill px-[9px] py-[3px] text-[10px] font-bold text-zumi-soft">
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
          <span className="size-[30px] rounded-full border-2 border-zumi-line" />
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
        "flex size-11 rotate-[-8deg] items-center justify-center rounded-full border-[2.5px] border-zumi-shu font-seal text-[21px] text-zumi-shu shadow-[inset_0_0_0_1px_rgba(200,64,42,0.25)]",
        animate && "motion-safe:animate-stamp",
      )}
    >
      済
    </span>
  );
}
