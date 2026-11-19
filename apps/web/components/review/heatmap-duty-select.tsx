"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { HistoryDutyOption } from "@/lib/review";

/** ヒートマップの「全体 / Duty」切り替え（モックの `dutysel-chip`）。選ぶと同じ月のまま Duty だけ変わる */
export function HeatmapDutySelect({
  options,
  value,
  month,
}: {
  options: HistoryDutyOption[];
  value: string | null;
  /** 開いている月。今月なら null */
  month: string | null;
}) {
  const router = useRouter();
  return (
    <label className="relative inline-flex items-center rounded-[20px] border border-zumi-line bg-zumi-card text-xs font-bold text-zumi-ink">
      <span className="sr-only">Duty を選ぶ</span>
      <select
        value={value ?? ""}
        onChange={(event) => {
          const query = new URLSearchParams({ view: "heatmap" });
          if (month) query.set("month", month);
          if (event.target.value) query.set("duty", event.target.value);
          router.push(`/app/review?${query}`, { scroll: false });
        }}
        className="max-w-[200px] cursor-pointer appearance-none truncate rounded-[20px] bg-transparent py-1.5 pl-3 pr-7 outline-none focus-visible:ring-2 focus-visible:ring-zumi-shu"
      >
        <option value="">全体</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 size-[11px]"
        strokeWidth={2}
        aria-hidden
      />
    </label>
  );
}
