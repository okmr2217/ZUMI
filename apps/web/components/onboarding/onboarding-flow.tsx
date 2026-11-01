"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DutyTemplate, WeekStart } from "@zumi/types";
import type { OnboardingInput } from "@/lib/onboarding";
import { isIos, isStandalone } from "@/lib/push-client";
import { usePushSubscription } from "@/lib/use-push-subscription";
import { cn } from "@/lib/utils";
import { DutyCreateSheet, type DutyCalendar } from "@/components/duty/duty-create-sheet";
import { dutyDraftFromTemplate } from "@/components/duty/duty-draft";
import { TemplateGrid } from "@/components/duty/template-grid";
import { IosInstallGuide } from "@/components/app/ios-install-guide";
import { getBrowserTimezone } from "@/components/app/timezone-sync";

type Step = "duties" | "notify" | "install" | "permission";

interface Times {
  morningNotifyAt: string;
  eveningNotifyAt: string;
  weeklySummaryAt: string;
}

/**
 * オンボーディングの4ステップ。すべて飛ばせる（初回の離脱を防ぐため）。
 * 3（ホーム画面に追加）と 4（通知の許可）はどちらか一方だけを出す。
 * iOS の Safari ではホーム画面に追加しないと通知を許可できないため。
 */
export function OnboardingFlow({
  calendar,
  initialTimes,
  vapidPublicKey,
}: {
  calendar: DutyCalendar;
  initialTimes: Times;
  vapidPublicKey: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("duties");
  const [weekStart, setWeekStart] = useState<WeekStart>(calendar.weekStart);

  const finish = () => router.replace("/app");

  return (
    <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col">
      {step === "duties" && (
        <DutiesStep calendar={{ ...calendar, weekStart }} onNext={() => setStep("notify")} />
      )}
      {step === "notify" && (
        <NotifyStep
          initialTimes={initialTimes}
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
          onDone={() => setStep(isIos() && !isStandalone() ? "install" : "permission")}
        />
      )}
      {step === "install" && <InstallStep onFinish={finish} />}
      {step === "permission" && (
        <PermissionStep vapidPublicKey={vapidPublicKey} onFinish={finish} />
      )}
    </div>
  );
}

const STEP_INDEX: Record<Step, number> = { duties: 0, notify: 1, install: 2, permission: 2 };

/** 上部の見出し（モックの topbar: padding 30px 24px 4px、アイブロウ 12px、見出し 20px / 700） */
function StepHeader({
  step,
  eyebrow,
  title,
}: {
  step: Step;
  eyebrow: string;
  title: React.ReactNode;
}) {
  return (
    <header className="px-6 pb-1 pt-[30px]">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-zumi-soft text-[12px] font-bold tracking-[.08em]">{eyebrow}</p>
        <ol className="flex gap-1.5" aria-label={`${STEP_INDEX[step] + 1} / 3`}>
          {[0, 1, 2].map((index) => (
            <li
              key={index}
              className={cn(
                "size-1.5 rounded-full",
                index === STEP_INDEX[step] ? "bg-zumi-shu" : "bg-zumi-line",
              )}
            />
          ))}
        </ol>
      </div>
      <h1 className="text-[20px] font-bold leading-normal">{title}</h1>
    </header>
  );
}

/** 下部のボタン（モックの footer: padding 18px 22px 30px、主ボタン 15px / 700・角丸 16px） */
function StepFooter({ children }: { children: React.ReactNode }) {
  return (
    <footer className="bg-zumi-bg sticky bottom-0 mt-auto flex flex-col items-center gap-2.5 px-[22px] pb-[calc(30px+env(safe-area-inset-bottom))] pt-[18px]">
      {children}
    </footer>
  );
}

const PRIMARY =
  "bg-zumi-shu w-full rounded-2xl p-[15px] text-[15px] font-bold text-white disabled:opacity-40";
const SECONDARY = "text-zumi-soft text-[12.5px] underline underline-offset-2 disabled:opacity-40";

// ステップ1: やることを選ぶ ---------------------------------------------------------------

/** 追加シートで開いている中身。`template: null` は「自由に追加する」 */
type Selection = { template: DutyTemplate | null };

function DutiesStep({ calendar, onNext }: { calendar: DutyCalendar; onNext: () => void }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set());
  const [count, setCount] = useState(0);

  function handleCreated() {
    const template = selection?.template;
    if (template) setAddedIds((ids) => new Set(ids).add(template.id));
    setCount((n) => n + 1);
    setSelection(null);
  }

  return (
    <>
      <StepHeader
        step="duties"
        eyebrow="ようこそ"
        title={
          <>
            まずは、やることを
            <br />
            選びましょう
          </>
        }
      />
      <p className="text-zumi-soft px-6 text-[12.5px]">
        選ぶと、内容が入った状態で追加画面が開きます。同じものを何件でも追加できます。
      </p>

      <div className="px-5 pt-[18px]">
        <TemplateGrid
          onSelect={(template) => setSelection({ template })}
          weekStart={calendar.weekStart}
          markedIds={addedIds}
        />
      </div>

      <StepFooter>
        <button type="button" onClick={onNext} className={PRIMARY}>
          {count > 0 ? `次へ（${count}件）` : "あとで追加する"}
        </button>
        <button
          type="button"
          onClick={() => setSelection({ template: null })}
          className={SECONDARY}
        >
          自由に追加する
        </button>
      </StepFooter>

      <DutyCreateSheet
        open={selection !== null}
        onClose={() => setSelection(null)}
        onCreated={handleCreated}
        calendar={calendar}
        initialDraft={
          selection?.template
            ? dutyDraftFromTemplate(selection.template, calendar.today)
            : undefined
        }
      />
    </>
  );
}

// ステップ2: 通知の時刻・週の始まり ------------------------------------------------------

function NotifyStep({
  initialTimes,
  weekStart,
  onWeekStartChange,
  onDone,
}: {
  initialTimes: Times;
  weekStart: WeekStart;
  onWeekStartChange: (value: WeekStart) => void;
  onDone: () => void;
}) {
  const [times, setTimes] = useState(initialTimes);
  const [enabled, setEnabled] = useState({ morning: true, evening: true, weekly: true });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timezone] = useState(() => getBrowserTimezone());

  // このステップを終えるか飛ばした時点で `onboardedAt` を記録する（docs/03）
  async function submit(input: OnboardingInput) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      onDone();
    } catch (e) {
      console.error(e);
      setError("保存できませんでした。電波の良いところでもう一度お試しください。");
      setPending(false);
    }
  }

  function handleNext() {
    void submit({
      morningNotifyEnabled: enabled.morning,
      morningNotifyAt: times.morningNotifyAt,
      eveningNotifyEnabled: enabled.evening,
      eveningNotifyAt: times.eveningNotifyAt,
      weeklySummaryEnabled: enabled.weekly,
      weeklySummaryAt: times.weeklySummaryAt,
      weekStart,
    });
  }

  const rows = [
    { key: "morning", field: "morningNotifyAt", label: "朝の通知", sub: "今日の分をまとめて通知" },
    { key: "evening", field: "eveningNotifyAt", label: "夜の通知", sub: "未完了があれば知らせる" },
    {
      key: "weekly",
      field: "weeklySummaryAt",
      label: "週次サマリー",
      sub: `達成率とシェア用カード（${weekStart === 1 ? "日曜" : "土曜"}）`,
    },
  ] as const;

  return (
    <>
      <StepHeader
        step="notify"
        eyebrow="通知"
        title={
          <>
            お知らせする時刻を
            <br />
            決めましょう
          </>
        }
      />
      <p className="text-zumi-soft px-6 text-[12.5px]">あとから設定でいつでも変えられます。</p>

      <div className="flex flex-col gap-4 px-[22px] pt-[18px]">
        <div className="border-zumi-line bg-zumi-card overflow-hidden rounded-2xl border">
          {rows.map((row) => (
            <div
              key={row.key}
              className="border-zumi-line flex items-center justify-between gap-3 border-b px-[15px] py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold">{row.label}</div>
                <div className="text-zumi-soft mt-0.5 text-[11px]">{row.sub}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <input
                  type="time"
                  value={times[row.field]}
                  disabled={!enabled[row.key]}
                  required
                  aria-label={`${row.label}の時刻`}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value) setTimes((t) => ({ ...t, [row.field]: value }));
                  }}
                  className="bg-zumi-base rounded-[20px] px-2.5 py-1 text-[13px] font-bold tabular-nums outline-none disabled:opacity-40"
                />
                <Switch
                  checked={enabled[row.key]}
                  label={row.label}
                  onChange={(on) => setEnabled((e) => ({ ...e, [row.key]: on }))}
                />
              </div>
            </div>
          ))}
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-zumi-soft text-[11.5px] font-bold tracking-[.06em]">週の始まり</h2>
          <div role="radiogroup" aria-label="週の始まり" className="flex gap-2">
            {(
              [
                [1, "月曜日"],
                [0, "日曜日"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={weekStart === value}
                onClick={() => onWeekStartChange(value)}
                className={cn(
                  "flex-1 rounded-[20px] border px-1 py-[9px] text-[12px] font-bold",
                  weekStart === value
                    ? "bg-zumi-shu border-zumi-shu text-white"
                    : "border-zumi-line bg-zumi-card text-zumi-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-zumi-soft text-[11px]">
            「週に何回か」と振り返りの達成率の区切りです。
          </p>
        </section>

        <p className="text-zumi-soft text-[11px]">
          タイムゾーン: {timezone || "Asia/Tokyo"}（この端末から自動で設定します）
        </p>

        {error && (
          <p
            role="alert"
            className="bg-zumi-pill rounded-xl px-[13px] py-2.5 text-[12.5px] font-semibold"
          >
            {error}
          </p>
        )}
      </div>

      <StepFooter>
        <button type="button" onClick={handleNext} disabled={pending} className={PRIMARY}>
          {pending ? "保存しています…" : "次へ"}
        </button>
        <button
          type="button"
          onClick={() => void submit({})}
          disabled={pending}
          className={SECONDARY}
        >
          あとで設定する
        </button>
      </StepFooter>
    </>
  );
}

function Switch({
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
        "relative h-[21px] w-9 shrink-0 rounded-[20px] transition-colors",
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

// ステップ3: ホーム画面に追加（iOS の Safari だけ） -------------------------------------

function InstallStep({ onFinish }: { onFinish: () => void }) {
  return (
    <>
      <StepHeader
        step="install"
        eyebrow="ホーム画面に追加"
        title={
          <>
            ホーム画面に追加すると
            <br />
            通知が届きます
          </>
        }
      />
      <p className="text-zumi-soft px-6 text-[12.5px] leading-relaxed">
        iPhone・iPad では、Safari で開いたままだと通知を受け取れません。
      </p>
      <IosInstallGuide className="px-[22px] pt-[18px]" />
      <StepFooter>
        <button type="button" onClick={onFinish} className={PRIMARY}>
          はじめる
        </button>
        <p className="text-zumi-soft text-[11px]">あとからでも、同じ手順で追加できます。</p>
      </StepFooter>
    </>
  );
}

// ステップ4: 通知の許可（iOS 以外、またはホーム画面アプリ） ------------------------------

function PermissionStep({
  vapidPublicKey,
  onFinish,
}: {
  vapidPublicKey: string | null;
  onFinish: () => void;
}) {
  const { status, busy, error, subscribe } = usePushSubscription(vapidPublicKey);

  const message =
    status === "on"
      ? "この端末に通知が届きます。"
      : status === "denied"
        ? "ブラウザの設定で通知がブロックされています。アドレスバーのサイト設定から「許可」に変えると届くようになります。"
        : status === "unsupported" || status === "ios-install"
          ? "このブラウザは通知に対応していません。今日タブを開いて確かめてください。"
          : "朝にその日のやること、夜にまだ済んでいないものをお知らせします。";

  return (
    <>
      <StepHeader
        step="permission"
        eyebrow="通知の許可"
        title={
          <>
            通知をオンに
            <br />
            しましょう
          </>
        }
      />
      <p
        className="px-6 pt-2 text-[13px] leading-relaxed"
        role={status === "on" ? "status" : undefined}
      >
        {message}
      </p>
      {error && (
        <p
          role="alert"
          className="bg-zumi-pill mx-[22px] mt-3 rounded-xl px-[13px] py-2.5 text-[12.5px] font-semibold"
        >
          {error}
        </p>
      )}
      <StepFooter>
        {status === "off" || status === "loading" ? (
          <>
            <button
              type="button"
              onClick={subscribe}
              disabled={busy || status === "loading"}
              className={PRIMARY}
            >
              {busy ? "設定しています…" : "通知を許可する"}
            </button>
            <button type="button" onClick={onFinish} disabled={busy} className={SECONDARY}>
              あとで
            </button>
          </>
        ) : (
          <button type="button" onClick={onFinish} className={PRIMARY}>
            はじめる
          </button>
        )}
      </StepFooter>
    </>
  );
}
