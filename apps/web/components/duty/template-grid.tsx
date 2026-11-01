"use client";

import { Check } from "lucide-react";
import { DUTY_TEMPLATES, type DutyTemplate, type WeekStart } from "@zumi/types";
import { cn } from "@/lib/utils";
import { summarizeSchedule } from "@/lib/schedule-text";
import { DutyIcon } from "./duty-icon";

/**
 * テンプレートの2列のカード（モックの Onboarding のレイアウト）。テンプレート画面とオンボーディングで共通。
 * カードをタップしても即登録はせず、`onSelect` で内容が入った追加シートを開く。
 * 同じカードは何度でもタップできる（ゴミ出しを種類ごとに登録するケースのため）。
 *
 * - `markedIds`: 追加済みの印（朱の丸にチェック）を付けるテンプレート。オンボーディングで使う
 */
export function TemplateGrid({
  onSelect,
  weekStart,
  markedIds,
  disabled = false,
}: {
  onSelect: (template: DutyTemplate) => void;
  weekStart: WeekStart;
  markedIds?: ReadonlySet<string>;
  disabled?: boolean;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {DUTY_TEMPLATES.map((template) => {
        const marked = markedIds?.has(template.id) ?? false;
        return (
          <li key={template.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(template)}
              className={cn(
                "relative flex size-full flex-col items-start gap-2.5 rounded-[18px] border-[1.6px] px-3 py-4 text-left disabled:opacity-40",
                marked ? "border-zumi-shu bg-zumi-tint" : "border-zumi-line bg-zumi-card",
              )}
            >
              <span
                className={cn(
                  "flex size-[38px] items-center justify-center rounded-[11px]",
                  marked ? "bg-zumi-shu text-white" : "bg-zumi-base text-zumi-ink",
                )}
              >
                <DutyIcon name={template.icon} className="size-[18px]" strokeWidth={1.7} />
              </span>
              <span className="text-[13.5px] font-bold">{template.name}</span>
              <span className="text-zumi-soft -mt-1 text-[10.5px]">
                {summarizeSchedule(template.scheduleConfig, weekStart)}
              </span>
              {marked && (
                <span className="bg-zumi-shu absolute right-3 top-3 flex size-5 items-center justify-center rounded-full text-white">
                  <Check className="size-3" strokeWidth={2.6} aria-label="追加済み" />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
