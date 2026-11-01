"use client";

import { useEffect, useId, useRef } from "react";
import { Clock, Minus, Plus } from "lucide-react";
import { PRESET_ICONS, getNextDue, type MonthlyNth } from "@zumi/types";
import { cn } from "@/lib/utils";
import { DUTY_NAME_MAX_LENGTH } from "@/lib/duty-input";
import {
  REPEAT_KIND_OPTIONS,
  toScheduleConfig,
  toggleWeekday,
  type ScheduleDraft,
} from "@/lib/schedule-draft";
import { WEEKDAY_LABELS, formatNextDue, formatNth, orderedWeekdays } from "@/lib/schedule-text";
import { DutyIcon } from "./duty-icon";
import type { DutyDraft, DutyFormContext } from "./duty-draft";

/**
 * Duty の入力項目（名前・アイコン・繰り返し・次の期日のプレビュー・前夜通知・メモ欄）。
 * 追加シート（Duty タブ・テンプレート画面・オンボーディング）と編集フォームで共通に使う。
 * 見た目は画面モックの DutyCreate / DutyEdit に合わせる。
 */
export function DutyFormFields({
  value,
  onChange,
  context,
}: {
  value: DutyDraft;
  onChange: (value: DutyDraft) => void;
  context: DutyFormContext;
}) {
  const nameId = useId();
  const iconRowRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof DutyDraft>(key: K, next: DutyDraft[K]) =>
    onChange({ ...value, [key]: next });

  // 開いたときだけ、選択中のアイコンが見えるよう横スクロールを合わせる（縦はスクロールさせない）
  useEffect(() => {
    const row = iconRowRef.current;
    const selected = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (row && selected) {
      row.scrollLeft = selected.offsetLeft - (row.clientWidth - selected.offsetWidth) / 2;
    }
  }, []);

  return (
    <>
      <div>
        <FieldLabel htmlFor={nameId}>名前</FieldLabel>
        <input
          id={nameId}
          value={value.name}
          onChange={(event) => set("name", event.target.value)}
          maxLength={DUTY_NAME_MAX_LENGTH}
          placeholder="例：換気扇の掃除"
          className="border-zumi-line bg-zumi-card placeholder:text-zumi-soft focus:border-zumi-shu w-full rounded-[14px] border px-3.5 py-[13px] text-[14.5px] font-semibold outline-none placeholder:font-normal"
        />
      </div>

      <div>
        <FieldLabel>アイコン</FieldLabel>
        <div
          ref={iconRowRef}
          role="radiogroup"
          aria-label="アイコン"
          className="-mx-[22px] flex gap-[9px] overflow-x-auto px-[22px] pb-1 [scrollbar-width:none]"
        >
          {PRESET_ICONS.map((icon) => {
            const selected = icon.name === value.icon;
            return (
              <button
                key={icon.name}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={icon.label}
                onClick={() => set("icon", icon.name)}
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-[13px] border-[1.6px]",
                  selected
                    ? "border-zumi-shu bg-zumi-tint text-zumi-shu"
                    : "border-zumi-line bg-zumi-card text-zumi-soft",
                )}
              >
                <DutyIcon name={icon.name} className="size-[19px]" strokeWidth={1.6} />
              </button>
            );
          })}
        </div>
      </div>

      <ScheduleFields
        value={value.schedule}
        onChange={(schedule) => set("schedule", schedule)}
        context={context}
      />

      <div>
        <ToggleRow
          title="前夜通知"
          description="当日朝では間に合わない Duty 用"
          checked={value.notifyPrevNight}
          onChange={(checked) => set("notifyPrevNight", checked)}
        />
        <ToggleRow
          className="mt-2"
          title="メモ欄を記録時に表示"
          description="「済」を押すときメモを残せるように"
          checked={value.noteEnabled}
          onChange={(checked) => set("noteEnabled", checked)}
        />
      </div>
    </>
  );
}

function ScheduleFields({
  value,
  onChange,
  context,
}: {
  value: ScheduleDraft;
  onChange: (value: ScheduleDraft) => void;
  context: DutyFormContext;
}) {
  const weekdays = orderedWeekdays(context.weekStart);
  const anchorId = useId();
  const config = toScheduleConfig(value);

  const preview = (() => {
    if (!config) return null;
    const nextDue = getNextDue(
      {
        duty: { scheduleConfig: config, createdAt: context.createdAt, archivedAt: null },
        logs: context.logs,
        pauses: context.pauses,
        timeZone: context.timeZone,
        weekStart: context.weekStart,
      },
      context.today,
    );
    return formatNextDue(nextDue, context.today) ?? "一時停止中は期日が来ません";
  })();

  return (
    <>
      <div>
        <FieldLabel>繰り返し</FieldLabel>
        <div role="radiogroup" aria-label="繰り返し" className="flex flex-wrap gap-2">
          {REPEAT_KIND_OPTIONS.map((option) => (
            <Pill
              key={option.kind}
              selected={value.kind === option.kind}
              onClick={() => onChange({ ...value, kind: option.kind })}
            >
              {option.label}
            </Pill>
          ))}
        </div>
      </div>

      {value.kind === "WEEKDAYS" && (
        <div className="flex flex-col gap-3">
          <WeekdayButtons
            weekdays={weekdays}
            isSelected={(day) => value.weekdays.includes(day)}
            onToggle={(day) => onChange(toggleWeekday(value, day, context.today))}
            label="曜日"
          />
          <ToggleRow
            title="隔週にする"
            description="1週おきに、選んだ曜日にやる"
            checked={value.biweekly}
            onChange={(biweekly) => onChange({ ...value, biweekly })}
          />
          {value.biweekly && (
            <div>
              <FieldLabel htmlFor={anchorId}>最初の日</FieldLabel>
              <input
                id={anchorId}
                type="date"
                value={value.anchor}
                onChange={(event) => {
                  if (event.target.value) {
                    onChange({ ...value, anchor: event.target.value, anchorTouched: true });
                  }
                }}
                className="border-zumi-line bg-zumi-card focus:border-zumi-shu w-full rounded-[14px] border px-3.5 py-[11px] text-[14.5px] outline-none"
              />
              <p className="text-zumi-soft mt-1.5 text-[11px]">
                この日を含む週から、1週おきになります
              </p>
            </div>
          )}
        </div>
      )}

      {value.kind === "MONTHLY" && (
        <div className="flex flex-col gap-3">
          <div role="radiogroup" aria-label="毎月の指定方法" className="flex gap-2">
            <Pill
              selected={value.monthlyMode === "DAY"}
              onClick={() => onChange({ ...value, monthlyMode: "DAY" })}
            >
              日付で決める
            </Pill>
            <Pill
              selected={value.monthlyMode === "NTH"}
              onClick={() => onChange({ ...value, monthlyMode: "NTH" })}
            >
              第◯◯曜日
            </Pill>
          </div>
          {value.monthlyMode === "DAY" ? (
            <div>
              <label className="border-zumi-line bg-zumi-card flex items-center justify-between rounded-[14px] border px-[15px] py-2.5 text-[13.5px] font-semibold">
                日付
                <span className="flex items-center gap-1.5">
                  毎月
                  <select
                    value={value.dayOfMonth}
                    onChange={(event) =>
                      onChange({ ...value, dayOfMonth: Number(event.target.value) })
                    }
                    className="border-zumi-line bg-zumi-bg rounded-[10px] border-[1.6px] px-2 py-1.5 text-[15px] font-bold tabular-nums"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  日
                </span>
              </label>
              {value.dayOfMonth >= 29 && (
                <p className="text-zumi-soft mt-1.5 text-[11px]">
                  その日がない月は、月末になります
                </p>
              )}
            </div>
          ) : (
            <>
              <div role="radiogroup" aria-label="第何週" className="flex flex-wrap gap-2">
                {([1, 2, 3, 4, -1] as MonthlyNth[]).map((nth) => (
                  <Pill
                    key={nth}
                    selected={value.nth === nth}
                    onClick={() => onChange({ ...value, nth })}
                  >
                    {formatNth(nth)}
                  </Pill>
                ))}
              </div>
              <WeekdayButtons
                weekdays={weekdays}
                isSelected={(day) => value.nthWeekday === day}
                onToggle={(nthWeekday) => onChange({ ...value, nthWeekday })}
                label="曜日"
                single
              />
            </>
          )}
        </div>
      )}

      {value.kind === "WEEKLY_COUNT" && (
        <Stepper
          prefix="週に"
          suffix="回"
          value={value.timesPerWeek}
          min={1}
          max={7}
          onChange={(timesPerWeek) => onChange({ ...value, timesPerWeek })}
        />
      )}

      {value.kind === "SINCE_LAST" && (
        <Stepper
          prefix="前回から"
          suffix="日空いたら"
          value={value.sinceDays}
          min={1}
          max={90}
          onChange={(sinceDays) => onChange({ ...value, sinceDays })}
        />
      )}

      <p
        aria-live="polite"
        className={cn(
          "flex items-center gap-2 rounded-xl px-[13px] py-2.5 text-[12.5px] font-semibold",
          preview ? "bg-zumi-tint text-zumi-shu-deep" : "bg-zumi-pill text-zumi-soft",
        )}
      >
        <Clock className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden />
        {preview ?? "曜日を選んでください"}
      </p>
    </>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  const className = "mb-2 block text-[11.5px] font-bold tracking-[.06em] text-zumi-soft";
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ) : (
    <p className={className}>{children}</p>
  );
}

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "rounded-[20px] border-[1.6px] px-3.5 py-[9px] text-[12.5px] font-semibold",
        selected
          ? "border-zumi-shu bg-zumi-tint text-zumi-shu"
          : "border-zumi-line bg-zumi-card text-zumi-ink",
      )}
    >
      {children}
    </button>
  );
}

function WeekdayButtons({
  weekdays,
  isSelected,
  onToggle,
  label,
  single = false,
}: {
  weekdays: number[];
  isSelected: (day: number) => boolean;
  onToggle: (day: number) => void;
  label: string;
  single?: boolean;
}) {
  return (
    <div role={single ? "radiogroup" : "group"} aria-label={label} className="flex gap-[7px]">
      {weekdays.map((day) => {
        const selected = isSelected(day);
        return (
          <button
            key={day}
            type="button"
            role={single ? "radio" : undefined}
            aria-checked={single ? selected : undefined}
            aria-pressed={single ? undefined : selected}
            onClick={() => onToggle(day)}
            className={cn(
              "flex aspect-square flex-1 items-center justify-center rounded-[11px] border-[1.6px] text-[12.5px] font-bold",
              selected
                ? "border-zumi-shu bg-zumi-shu text-white"
                : "border-zumi-line bg-zumi-card text-zumi-soft",
            )}
          >
            {WEEKDAY_LABELS[day]}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  prefix,
  suffix,
  value,
  min,
  max,
  onChange,
}: {
  prefix: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const buttonClass =
    "flex size-9 items-center justify-center rounded-full border-[1.6px] border-zumi-line bg-zumi-card text-zumi-ink disabled:opacity-40";
  return (
    <div className="border-zumi-line bg-zumi-card flex items-center justify-between rounded-[14px] border px-[15px] py-2.5">
      <span className="text-[13.5px] font-semibold">
        {prefix} <span className="text-[17px] font-bold tabular-nums">{value}</span> {suffix}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="減らす"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className={buttonClass}
        >
          <Minus className="size-4" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="増やす"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className={buttonClass}
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  className,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "border-zumi-line bg-zumi-card flex w-full items-center justify-between gap-3 rounded-[14px] border px-[15px] py-[13px] text-left",
        className,
      )}
    >
      <span>
        <span className="block text-[13.5px] font-semibold">{title}</span>
        <span className="text-zumi-soft mt-0.5 block text-[11px]">{description}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-[21px] w-9 shrink-0 rounded-[20px] transition-colors",
          checked ? "bg-zumi-shu" : "bg-zumi-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-[17px] rounded-full bg-white transition-[left]",
            checked ? "left-[17px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
