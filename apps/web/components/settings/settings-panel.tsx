"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { WeekStart } from "@zumi/types";
import type { NotificationSettings } from "@/lib/notification-settings";
import { BottomSheet } from "@/components/app/bottom-sheet";
import { NotificationSettingsForm } from "@/components/app/notification-settings-form";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { DeleteAccountForm } from "@/components/auth/delete-account-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { cn } from "@/lib/utils";
import { RepeatHelp } from "./repeat-help";
import { SETTINGS_PILL, SettingsGroup, SettingsLinkRow, SettingsRow } from "./settings-group";

export interface SettingsPanelData {
  email: string;
  notificationSettings: NotificationSettings;
  vapidPublicKey: string | null;
}

type SubSheet = "password" | "delete" | "help" | null;

/**
 * 設定の中身（docs/04「4-4. 設定（モーダル）」、モックの Settings.dc.html）。
 * 並びはモックの 通知 → 表示 → アカウント → データ に、モックにないヘルプ（ホーム画面に追加する手順など）と退会を足したもの。
 * 今日タブの歯車から開くモーダルと、`/app/settings` を直接開いたときのページで共通。
 */
export function SettingsPanel({ email, notificationSettings, vapidPublicKey }: SettingsPanelData) {
  const [weekStart, setWeekStart] = useState<WeekStart>(notificationSettings.weekStart);
  const [subSheet, setSubSheet] = useState<SubSheet>(null);

  return (
    <div className="flex flex-col gap-4">
      <NotificationSettingsForm
        initial={notificationSettings}
        vapidPublicKey={vapidPublicKey}
        weekStart={weekStart}
      />

      <SettingsGroup title="表示">
        <WeekStartRow value={weekStart} onChange={setWeekStart} />
      </SettingsGroup>

      <SettingsGroup title="アカウント">
        <SettingsRow label="メールアドレス">
          <span className="max-w-[180px] truncate">{email}</span>
        </SettingsRow>
        <SettingsLinkRow label="パスワード変更" onClick={() => setSubSheet("password")} />
        <SignOutButton className="flex w-full border-b border-zumi-line px-[15px] py-3 text-left text-[13.5px] font-semibold last:border-b-0 disabled:opacity-40" />
      </SettingsGroup>

      {/* エクスポートは v1.1（docs/07）。モックにある項目なので、準備中として出しておく */}
      <SettingsGroup title="データ">
        <SettingsLinkRow label="データをエクスポート" value="準備中" disabled />
      </SettingsGroup>

      <SettingsGroup title="ヘルプ">
        <SettingsLinkRow label="ホーム画面に追加する" sub="アプリとして使う手順" href="/install" />
        <SettingsLinkRow
          label="繰り返し設定について"
          sub="5つの決め方と「そろそろ」の考え方"
          onClick={() => setSubSheet("help")}
        />
        <SettingsLinkRow label="利用規約" href="/terms" />
        <SettingsLinkRow label="プライバシーポリシー" href="/privacy" />
      </SettingsGroup>

      <button
        type="button"
        onClick={() => setSubSheet("delete")}
        className="self-center py-1 text-[12.5px] font-semibold text-zumi-shu-deep"
      >
        退会する
      </button>

      <BottomSheet
        open={subSheet === "password"}
        onClose={() => setSubSheet(null)}
        title="パスワード変更"
      >
        <ChangePasswordForm />
      </BottomSheet>
      <BottomSheet
        open={subSheet === "help"}
        onClose={() => setSubSheet(null)}
        title="繰り返し設定について"
      >
        <RepeatHelp />
      </BottomSheet>
      <BottomSheet open={subSheet === "delete"} onClose={() => setSubSheet(null)} title="退会">
        <DeleteAccountForm />
      </BottomSheet>
    </div>
  );
}

const WEEK_START_LABEL: Record<WeekStart, string> = { 1: "月曜日", 0: "日曜日" };

/** 週の始まり（月曜 / 日曜）。選んだらその場で保存し、失敗したら元に戻す */
function WeekStartRow({
  value,
  onChange,
}: {
  value: WeekStart;
  onChange: (value: WeekStart) => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: WeekStart) {
    const previous = value;
    onChange(next);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/display", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: next }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      // 今日タブ・振り返りの週の区切りが変わるので、裏の画面を読み直す
      router.refresh();
    } catch (e) {
      console.error(e);
      onChange(previous);
      setError("保存できませんでした。時間をおいて試してください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-b border-zumi-line px-[15px] py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold">週の始まり</div>
          <div className="mt-0.5 text-[11px] text-zumi-soft">週次サマリー・達成率の区切り</div>
        </div>
        <label
          className={cn(
            SETTINGS_PILL,
            "inline-flex items-center gap-[3px]",
            saving && "opacity-60",
          )}
        >
          <select
            value={value}
            disabled={saving}
            onChange={(event) => void handleChange(Number(event.target.value) as WeekStart)}
            aria-label="週の始まり"
            className="cursor-pointer appearance-none bg-transparent font-[inherit] outline-none"
          >
            {([1, 0] as const).map((option) => (
              <option key={option} value={option}>
                {WEEK_START_LABEL[option]}
              </option>
            ))}
          </select>
          <ChevronRight aria-hidden size={11} strokeWidth={2} className="text-zumi-soft" />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[11px] text-zumi-shu">
          {error}
        </p>
      )}
    </div>
  );
}
