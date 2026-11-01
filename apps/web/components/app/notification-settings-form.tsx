"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { NotificationSettings, NotificationSettingsPatch } from "@/lib/notification-settings";
import { usePushSubscription, type PushStatus } from "@/lib/use-push-subscription";
import { DEFAULT_EVENING_AT, DEFAULT_MORNING_AT } from "@/lib/notification-defaults";
import { cn } from "@/lib/utils";
import { getBrowserTimezone, isTimezoneManual, setTimezoneManual } from "./timezone-sync";

// 寸法は画面モック（Settings.dc.html）の通知グループに合わせている。
const INK = "text-zumi-ink";
const INK_SOFT = "text-zumi-soft";
const LINE = "border-zumi-line";
const PILL =
  "rounded-[20px] bg-zumi-base py-1 pl-2.5 pr-[9px] text-[11.5px] font-bold text-zumi-ink";

const AUTO_TIMEZONE = "auto";

type SettingsKey = keyof NotificationSettings;

function touchedKeys(patch: NotificationSettingsPatch): SettingsKey[] {
  const keys = Object.keys(patch) as SettingsKey[];
  if ("morningNotifyEnabled" in patch) keys.push("morningNotifyAt");
  if ("eveningNotifyEnabled" in patch) keys.push("eveningNotifyAt");
  return keys;
}

function pick(source: NotificationSettings, keys: SettingsKey[]): Partial<NotificationSettings> {
  return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

/**
 * 通知設定フォーム（この端末の許可・朝/夜/週次の ON/OFF と時刻・タイムゾーン）。
 * 変更はその場で保存する。設定モーダル（フェーズ7）にもこのまま載せられるよう、
 * ページの枠は持たず、グループ見出しとカードだけを描く。
 */
export function NotificationSettingsForm({
  initial,
  vapidPublicKey,
}: {
  initial: NotificationSettings;
  vapidPublicKey: string | null;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: NotificationSettingsPatch) {
    // 保存の結果で書き換えるのは、送った項目（と ON にしたときに埋まる時刻）だけ。
    // 他の行で編集中の時刻や、並行して保存中の項目を巻き戻さないため。
    const keys = touchedKeys(patch);
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const next: NotificationSettings = await response.json();
      setSaved((current) => ({ ...current, ...pick(next, keys) }));
      setDraft((current) => ({ ...current, ...pick(next, keys) }));
      return true;
    } catch (e) {
      console.error(e);
      setDraft((current) => ({ ...current, ...pick(saved, keys) }));
      setError("保存できませんでした。時間をおいて試してください。");
      return false;
    }
  }

  function commitTime(key: "morningNotifyAt" | "eveningNotifyAt" | "weeklySummaryAt") {
    const value = draft[key];
    if (value && value !== saved[key]) void save({ [key]: value });
    else setDraft((current) => ({ ...current, [key]: saved[key] }));
  }

  // 週次サマリーは週の最終日に送る（週の始まりが月曜なら日曜）。曜日は選ばせない。
  const weeklyDay = draft.weekStart === 1 ? "日曜" : "土曜";

  return (
    <section className="flex flex-col gap-2">
      <h2 className={cn("text-[11.5px] font-bold tracking-[.06em]", INK_SOFT)}>通知</h2>
      <div className={cn("bg-zumi-card overflow-hidden rounded-2xl border", LINE)}>
        <DevicePushRow vapidPublicKey={vapidPublicKey} />
        <ScheduleRow
          label="朝の通知"
          sub="今日の分をまとめて通知"
          enabled={draft.morningNotifyEnabled}
          time={draft.morningNotifyAt ?? DEFAULT_MORNING_AT}
          onToggle={(on) => save({ morningNotifyEnabled: on })}
          onTimeChange={(value) => setDraft((d) => ({ ...d, morningNotifyAt: value }))}
          onTimeCommit={() => commitTime("morningNotifyAt")}
        />
        <ScheduleRow
          label="夜の通知"
          sub="未完了があれば知らせる"
          enabled={draft.eveningNotifyEnabled}
          time={draft.eveningNotifyAt ?? DEFAULT_EVENING_AT}
          onToggle={(on) => save({ eveningNotifyEnabled: on })}
          onTimeChange={(value) => setDraft((d) => ({ ...d, eveningNotifyAt: value }))}
          onTimeCommit={() => commitTime("eveningNotifyAt")}
        />
        <ScheduleRow
          label="週次サマリー"
          sub="達成率とシェア用カード"
          dayLabel={weeklyDay}
          enabled={draft.weeklySummaryEnabled}
          time={draft.weeklySummaryAt}
          onToggle={(on) => save({ weeklySummaryEnabled: on })}
          onTimeChange={(value) => setDraft((d) => ({ ...d, weeklySummaryAt: value }))}
          onTimeCommit={() => commitTime("weeklySummaryAt")}
        />
        <TimezoneRow timezone={draft.timezone} onSave={(timezone) => save({ timezone })} />
      </div>
      {error && (
        <p role="alert" className="text-zumi-shu text-[11px]">
          {error}
        </p>
      )}
    </section>
  );
}

function Row({
  label,
  sub,
  children,
  footer,
}: {
  label: string;
  sub: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className={cn("border-b px-[15px] py-3 last:border-b-0", LINE)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className={cn("text-[13.5px] font-semibold", INK)}>{label}</div>
          <div className={cn("mt-0.5 text-[11px]", INK_SOFT)}>{sub}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">{children}</div>
      </div>
      {footer}
    </div>
  );
}

const DEVICE_SUB: Record<PushStatus, string> = {
  loading: "確認しています…",
  "ios-install": "ホーム画面に追加すると受け取れます",
  unsupported: "このブラウザは通知に対応していません",
  denied: "ブラウザの設定でブロックされています",
  off: "まだ許可されていません",
  on: "この端末に届きます",
};

function DevicePushRow({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const { status, busy, error, subscribe, unsubscribe } = usePushSubscription(vapidPublicKey);

  const footer =
    status === "ios-install" ? (
      <IosInstallGuide />
    ) : status === "denied" ? (
      <p className={cn("mt-2 text-[11px] leading-relaxed", INK_SOFT)}>
        アドレスバーのサイト設定から、通知を「許可」に変えてください。
      </p>
    ) : error ? (
      <p role="alert" className="text-zumi-shu mt-2 text-[11px]">
        {error}
      </p>
    ) : null;

  return (
    <Row label="この端末への通知" sub={DEVICE_SUB[status]} footer={footer}>
      {status === "off" && (
        <button
          type="button"
          onClick={subscribe}
          disabled={busy}
          className="bg-zumi-shu rounded-[20px] px-3 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-50"
        >
          許可する
        </button>
      )}
      {status === "on" && (
        <button
          type="button"
          onClick={unsubscribe}
          disabled={busy}
          className={cn(PILL, "disabled:opacity-50")}
        >
          オフにする
        </button>
      )}
    </Row>
  );
}

/** iOS の Safari ではホーム画面に追加しないと Web Push を受け取れない（docs/02）。 */
function IosInstallGuide() {
  return (
    <ol
      className={cn(
        "bg-zumi-bg mt-2 list-decimal space-y-0.5 rounded-xl py-2 pl-7 pr-3 text-[11px] leading-relaxed",
        INK,
      )}
    >
      <li>Safari の共有ボタンをタップ</li>
      <li>「ホーム画面に追加」を選ぶ</li>
      <li>「Webアプリとして開く」をオンのまま「追加」</li>
      <li>ホーム画面のアプリを開き、ログインし直してから通知を許可</li>
    </ol>
  );
}

function ScheduleRow({
  label,
  sub,
  dayLabel,
  enabled,
  time,
  onToggle,
  onTimeChange,
  onTimeCommit,
}: {
  label: string;
  sub: string;
  dayLabel?: string;
  enabled: boolean;
  time: string;
  onToggle: (on: boolean) => void;
  onTimeChange: (value: string) => void;
  onTimeCommit: () => void;
}) {
  return (
    <Row label={label} sub={sub}>
      <Toggle checked={enabled} onChange={onToggle} label={label} />
      <label
        className={cn(
          PILL,
          "inline-flex cursor-pointer items-center gap-[3px]",
          !enabled && "cursor-default opacity-40",
        )}
      >
        {dayLabel && <span>{dayLabel}</span>}
        <input
          type="time"
          value={time}
          disabled={!enabled}
          aria-label={`${label}の時刻`}
          onChange={(event) => onTimeChange(event.target.value)}
          onBlur={onTimeCommit}
          onClick={(event) => event.currentTarget.showPicker?.()}
          className="w-[42px] cursor-[inherit] bg-transparent p-0 font-[inherit] tabular-nums outline-none [&::-webkit-calendar-picker-indicator]:hidden"
        />
        <ChevronRight aria-hidden size={11} strokeWidth={2} className={INK_SOFT} />
      </label>
    </Row>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[21px] w-9 rounded-[20px] transition-colors",
        checked ? "bg-zumi-shu" : "bg-zumi-line",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-[17px] w-[17px] rounded-full bg-white transition-[left]",
          checked ? "left-[17px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function TimezoneRow({
  timezone,
  onSave,
}: {
  timezone: string;
  onSave: (timezone: string) => Promise<boolean>;
}) {
  // 手で選んだかどうかは端末の localStorage にあるため、マウント後に読む。
  const [manual, setManual] = useState(false);
  const [browserTimezone, setBrowserTimezone] = useState(timezone);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManual(isTimezoneManual());
    setBrowserTimezone(getBrowserTimezone());
  }, []);

  const options = useMemo(() => {
    const zones = Intl.supportedValuesOf("timeZone");
    return zones.includes(timezone) ? zones : [timezone, ...zones];
  }, [timezone]);

  async function handleChange(value: string) {
    const auto = value === AUTO_TIMEZONE;
    const previous = manual;
    // 保存中に選択が「自動」へ戻って見えないよう、先に切り替えて失敗したら戻す。
    setManual(!auto);
    if (await onSave(auto ? getBrowserTimezone() : value)) setTimezoneManual(!auto);
    else setManual(previous);
  }

  return (
    <Row label="タイムゾーン" sub={manual ? "手動で設定しています" : "通知の時刻の基準"}>
      <label className={cn(PILL, "inline-flex items-center gap-[3px]")}>
        <select
          value={manual ? timezone : AUTO_TIMEZONE}
          onChange={(event) => void handleChange(event.target.value)}
          aria-label="タイムゾーン"
          className="max-w-[150px] cursor-pointer appearance-none truncate bg-transparent font-[inherit] outline-none"
        >
          <option value={AUTO_TIMEZONE}>自動（{browserTimezone}）</option>
          {options.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <ChevronRight aria-hidden size={11} strokeWidth={2} className={INK_SOFT} />
      </label>
    </Row>
  );
}
