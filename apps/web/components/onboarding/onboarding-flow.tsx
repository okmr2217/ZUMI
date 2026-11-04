"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toLocalDate, type DutyTemplate, type WeekStart } from "@zumi/types";
import type { OnboardingInput } from "@/lib/onboarding";
import { usePushSubscription } from "@/lib/use-push-subscription";
import { cn } from "@/lib/utils";
import { DutyCreateSheet, type DutyCalendar } from "@/components/duty/duty-create-sheet";
import { dutyDraftFromTemplate } from "@/components/duty/duty-draft";
import { TemplateGrid } from "@/components/duty/template-grid";
import {
  InstalledNotice,
  PwaPlatformSteps,
  usePwaInstall,
} from "@/components/app/pwa-install-guide";
import { getBrowserTimezone } from "@/components/app/timezone-sync";
import { Toggle } from "@/components/app/notification-settings-form";

type Step = "install" | "duties" | "notify" | "permission";

/** 何ステップ目か（上部の点の表示用） */
interface Position {
  index: number;
  total: number;
}

interface Times {
  morningNotifyAt: string;
  eveningNotifyAt: string;
  weeklySummaryAt: string;
}

/**
 * オンボーディングの4ステップ。すべて飛ばせる（初回の離脱を防ぐため）。
 * 1（ホーム画面に追加）はホーム画面アプリとして開いているときは出さない。iOS では Safari で
 * 1 の手順どおりに追加し、ホーム画面のアプリでログインし直すと、ここから 2 以降を続けられる
 * （`onboardedAt` は 3 で記録するため、それまではアプリを開くたびにここへ送られる）。
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
  const install = usePwaInstall();
  const [chosen, setChosen] = useState<Step | null>(null);
  const [weekStart, setWeekStart] = useState<WeekStart>(calendar.weekStart);

  const finish = () => router.replace("/app");

  // ホーム画面アプリかどうかはブラウザでしか分からないため、ハイドレーションまでは何も出さない
  if (!install.ready) return <div className="min-h-svh" />;

  // 開いた時点でホーム画面アプリかどうかで決める（途中でインストールしても、点の数は変えない）
  const steps: Step[] = install.standalone
    ? ["duties", "notify", "permission"]
    : ["install", "duties", "notify", "permission"];
  const step = chosen ?? (install.standalone ? "duties" : "install");
  const position = { index: steps.indexOf(step), total: steps.length };

  return (
    <div className="mx-auto flex min-h-svh max-w-[430px] flex-col">
      {step === "install" && (
        <InstallStep position={position} onNext={() => setChosen("duties")} {...install} />
      )}
      {step === "duties" && (
        <DutiesStep
          position={position}
          calendar={{ ...calendar, weekStart }}
          onNext={() => setChosen("notify")}
        />
      )}
      {step === "notify" && (
        <NotifyStep
          position={position}
          initialTimes={initialTimes}
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
          onDone={() => setChosen("permission")}
        />
      )}
      {step === "permission" && (
        <PermissionStep position={position} vapidPublicKey={vapidPublicKey} onFinish={finish} />
      )}
    </div>
  );
}

/** 上部の見出し（モックの topbar: padding 30px 24px 4px、アイブロウ 12px、見出し 20px / 700） */
function StepHeader({
  position,
  eyebrow,
  title,
}: {
  position: Position;
  eyebrow: string;
  title: React.ReactNode;
}) {
  return (
    <header className="px-6 pb-1 pt-[30px]">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[12px] font-bold tracking-[.08em] text-zumi-soft">{eyebrow}</p>
        <ol className="flex gap-1.5" aria-label={`${position.index + 1} / ${position.total}`}>
          {Array.from({ length: position.total }, (_, index) => (
            <li
              key={index}
              className={cn(
                "size-1.5 rounded-full",
                index === position.index ? "bg-zumi-shu" : "bg-zumi-line",
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
    <footer className="sticky bottom-0 mt-auto flex flex-col items-center gap-2.5 bg-zumi-bg px-[22px] pb-[calc(30px+env(safe-area-inset-bottom))] pt-[18px]">
      {children}
    </footer>
  );
}

const PRIMARY =
  "bg-zumi-shu w-full rounded-2xl p-[15px] text-[15px] font-bold text-white disabled:opacity-40";
const SECONDARY = "text-zumi-soft text-[12.5px] underline underline-offset-2 disabled:opacity-40";

// ステップ1: ホーム画面に追加（ホーム画面アプリで開いているときは出さない） ------------

function InstallStep({
  position,
  onNext,
  platform,
  installed,
  canInstall,
  install,
}: {
  position: Position;
  onNext: () => void;
} & Pick<ReturnType<typeof usePwaInstall>, "platform" | "installed" | "canInstall" | "install">) {
  return (
    <>
      <StepHeader
        position={position}
        eyebrow="ようこそ"
        title={
          <>
            まずは、ホーム画面に
            <br />
            追加しましょう
          </>
        }
      />
      <p className="px-6 text-[12.5px] leading-relaxed text-zumi-soft">
        アプリのように1タップで開けます。iPhone・iPad
        では、追加すると通知も受け取れるようになります。
        {!installed && !platform && " スマートフォンで ZUMI を開き、次の手順で追加できます。"}
      </p>

      <div className="flex flex-col gap-3 px-[22px] pt-[18px]">
        {installed ? <InstalledNotice /> : <PwaPlatformSteps platform={platform} />}
      </div>

      <StepFooter>
        {!installed && canInstall ? (
          <>
            <button type="button" onClick={() => void install()} className={PRIMARY}>
              ホーム画面に追加する
            </button>
            <button type="button" onClick={onNext} className={SECONDARY}>
              あとで
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onNext} className={PRIMARY}>
              次へ
            </button>
            <p className="text-[11px] text-zumi-soft">
              手順は設定の「ホーム画面に追加する」からいつでも見られます。
            </p>
          </>
        )}
      </StepFooter>
    </>
  );
}

// ステップ2: やることを選ぶ ---------------------------------------------------------------

/**
 * 追加シートで開いている中身。`template: null` は「自由に追加する」。
 * サーバーのタイムゾーンはまだ初期値（`TimezoneSync` が保存する前）のことがあるため、
 * 開いた時点のブラウザのタイムゾーンで「今日」を決め直す。
 */
type Selection = { template: DutyTemplate | null; calendar: DutyCalendar };

function browserCalendar(calendar: DutyCalendar): DutyCalendar {
  const timeZone = getBrowserTimezone() || calendar.timeZone;
  return { ...calendar, timeZone, today: toLocalDate(new Date(), timeZone) };
}

function DutiesStep({
  position,
  calendar,
  onNext,
}: {
  position: Position;
  calendar: DutyCalendar;
  onNext: () => void;
}) {
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
        position={position}
        eyebrow={position.index === 0 ? "ようこそ" : "やること"}
        title={
          <>
            まずは、やることを
            <br />
            選びましょう
          </>
        }
      />
      <p className="px-6 text-[12.5px] text-zumi-soft">
        選ぶと、内容が入った状態で追加画面が開きます。同じものを何件でも追加できます。
      </p>

      <div className="px-5 pt-[18px]">
        <TemplateGrid
          onSelect={(template) => setSelection({ template, calendar: browserCalendar(calendar) })}
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
          onClick={() => setSelection({ template: null, calendar: browserCalendar(calendar) })}
          className={SECONDARY}
        >
          自由に追加する
        </button>
      </StepFooter>

      <DutyCreateSheet
        open={selection !== null}
        onClose={() => setSelection(null)}
        onCreated={handleCreated}
        calendar={selection?.calendar ?? calendar}
        initialDraft={
          selection?.template
            ? dutyDraftFromTemplate(selection.template, selection.calendar.today)
            : undefined
        }
      />
    </>
  );
}

// ステップ3: 通知の時刻・週の始まり ------------------------------------------------------

function NotifyStep({
  position,
  initialTimes,
  weekStart,
  onWeekStartChange,
  onDone,
}: {
  position: Position;
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
        position={position}
        eyebrow="通知"
        title={
          <>
            お知らせする時刻を
            <br />
            決めましょう
          </>
        }
      />
      <p className="px-6 text-[12.5px] text-zumi-soft">あとから設定でいつでも変えられます。</p>

      <div className="flex flex-col gap-4 px-[22px] pt-[18px]">
        <div className="overflow-hidden rounded-2xl border border-zumi-line bg-zumi-card">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-3 border-b border-zumi-line px-[15px] py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold">{row.label}</div>
                <div className="mt-0.5 text-[11px] text-zumi-soft">{row.sub}</div>
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
                  className="rounded-[20px] bg-zumi-base px-2.5 py-1 text-[13px] font-bold tabular-nums outline-none disabled:opacity-40"
                />
                <Toggle
                  checked={enabled[row.key]}
                  label={row.label}
                  onChange={(on) => setEnabled((e) => ({ ...e, [row.key]: on }))}
                />
              </div>
            </div>
          ))}
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-[11.5px] font-bold tracking-[.06em] text-zumi-soft">週の始まり</h2>
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
                    ? "border-zumi-shu bg-zumi-shu text-white"
                    : "border-zumi-line bg-zumi-card text-zumi-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zumi-soft">
            「週に何回か」と振り返りの達成率の区切りです。
          </p>
        </section>

        <p className="text-[11px] text-zumi-soft">
          タイムゾーン: {timezone || "Asia/Tokyo"}（この端末から自動で設定します）
        </p>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-zumi-pill px-[13px] py-2.5 text-[12.5px] font-semibold"
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

// ステップ4: 通知の許可 ---------------------------------------------------------------

function PermissionStep({
  position,
  vapidPublicKey,
  onFinish,
}: {
  position: Position;
  vapidPublicKey: string | null;
  onFinish: () => void;
}) {
  const { status, busy, error, subscribe } = usePushSubscription(vapidPublicKey);

  const message =
    status === "on"
      ? "この端末に通知が届きます。"
      : status === "denied"
        ? "ブラウザの設定で通知がブロックされています。アドレスバーのサイト設定から「許可」に変えると届くようになります。"
        : status === "ios-install"
          ? "iPhone・iPad では、ホーム画面に追加したアプリから通知を許可できます。アプリを開いてログインし直したら、今日タブのお知らせから許可してください。"
          : status === "unsupported"
            ? "このブラウザは通知に対応していません。今日タブを開いて確かめてください。"
            : "設定した時刻に、その日のやることや済んでいないものをお知らせします。";

  return (
    <>
      <StepHeader
        position={position}
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
          className="mx-[22px] mt-3 rounded-xl bg-zumi-pill px-[13px] py-2.5 text-[12.5px] font-semibold"
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
