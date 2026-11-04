"use client";

import { useState, useSyncExternalStore } from "react";
import {
  CircleCheck,
  Download,
  EllipsisVertical,
  LogIn,
  Share,
  SquarePlus,
  ToggleRight,
  type LucideIcon,
} from "lucide-react";
import { isIos, isStandalone } from "@/lib/push-client";
import { cn } from "@/lib/utils";

/**
 * ホーム画面に追加（PWA としてインストール）する案内。`/install` のページとオンボーディングの
 * ステップ1で共有する。判定と手順の構成は clipnote の案内（pwa-install-guide.tsx）にならう。
 */

export type InstallPlatform = "iosSafari" | "iosChrome" | "androidChrome";

/** Chromium 系だけが投げるイベント。標準の型定義にはないので必要な分だけ書く */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallState {
  /** サーバー描画とハイドレーション中は false（UA や表示モードはブラウザでしか分からない） */
  ready: boolean;
  /** UA から粗く判定した環境。初期表示のタブを決めるだけなので、外れても利用者が切り替えられる。PC は null */
  platform: InstallPlatform | null;
  /** ホーム画面アプリとして開いている（読み込み時点の値。あとから変わらない） */
  standalone: boolean;
  /** ホーム画面アプリとして開いている、またはこのページでインストールした */
  installed: boolean;
  /** `beforeinstallprompt` を受け取れたときだけ入る（iOS では常に null） */
  prompt: BeforeInstallPromptEvent | null;
}

const SERVER_STATE: InstallState = {
  ready: false,
  platform: null,
  standalone: false,
  installed: false,
  prompt: null,
};

let state = SERVER_STATE;
const listeners = new Set<() => void>();

function update(patch: Partial<InstallState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function detectPlatform(): InstallPlatform | null {
  if (/android/i.test(navigator.userAgent)) return "androidChrome";
  if (isIos()) return /CriOS/.test(navigator.userAgent) ? "iosChrome" : "iosSafari";
  return null;
}

// `beforeinstallprompt` はページの読み込み直後に来ることがあるため、コンポーネントのマウントを待たずに
// モジュールの読み込み時点で受け始める
if (typeof window !== "undefined") {
  const standalone = isStandalone();
  state = {
    ready: true,
    platform: detectPlatform(),
    standalone,
    installed: standalone,
    prompt: null,
  };
  window.addEventListener("beforeinstallprompt", (event) => {
    // ブラウザ既定のミニ情報バーは出さず、ページ内のボタンから出す
    event.preventDefault();
    update({ prompt: event as BeforeInstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => update({ installed: true, prompt: null }));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePwaInstall() {
  const current = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );

  /** インストールのダイアログを出す。`prompt()` は1イベント1回しか呼べないため、結果にかかわらず捨てる */
  async function install() {
    const event = state.prompt;
    if (!event) return;
    update({ prompt: null });
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") update({ installed: true });
  }

  return {
    ready: current.ready,
    platform: current.platform,
    standalone: current.standalone,
    installed: current.installed,
    canInstall: current.prompt !== null,
    install,
  };
}

interface PlatformGuide {
  label: string;
  requirement: string;
  steps: { icon: LucideIcon; text: string }[];
}

const RELOGIN_STEP = {
  icon: LogIn,
  text: "ホーム画面の ZUMI から開き、ログインし直す（ブラウザとはログイン状態が分かれています）",
};

const GUIDES: Record<InstallPlatform, PlatformGuide> = {
  iosSafari: {
    label: "iPhone・Safari",
    requirement: "iPhone・iPad に最初から入っている Safari で開いてください。",
    steps: [
      {
        icon: Share,
        text: "画面下の共有ボタン（四角から矢印）をタップ。iOS 26 以降はアドレスバー右の「…」から「共有」",
      },
      { icon: SquarePlus, text: "メニューを下にスクロールして「ホーム画面に追加」を選ぶ" },
      { icon: ToggleRight, text: "「Webアプリとして開く」はオンのまま、右上の「追加」をタップ" },
      RELOGIN_STEP,
    ],
  },
  iosChrome: {
    label: "iPhone・Chrome",
    requirement: "iOS 16.4 以降の Chrome で使えます。",
    steps: [
      { icon: Share, text: "アドレスバー右端の共有ボタンをタップ" },
      { icon: SquarePlus, text: "メニューから「ホーム画面に追加」を選ぶ" },
      { icon: ToggleRight, text: "右上の「追加」をタップ" },
      RELOGIN_STEP,
    ],
  },
  androidChrome: {
    label: "Android・Chrome",
    requirement: "Android の Chrome で開いてください。",
    steps: [
      {
        icon: EllipsisVertical,
        text: "画面下に「アプリをインストール」が出たらタップ。出ないときは右上の︙をタップ",
      },
      { icon: SquarePlus, text: "「ホーム画面に追加」を選び、「インストール」をタップ" },
      { icon: Download, text: "ホーム画面またはアプリ一覧の ZUMI から開く" },
    ],
  },
};

const PLATFORMS = Object.keys(GUIDES) as InstallPlatform[];

/** 環境ごとの手順。タブの初期値は検出した環境（PC などで分からなければ iPhone・Safari） */
export function PwaPlatformSteps({
  platform,
  className,
}: {
  platform: InstallPlatform | null;
  className?: string;
}) {
  const [selected, setSelected] = useState<InstallPlatform | null>(null);
  const current = selected ?? platform ?? "iosSafari";
  const guide = GUIDES[current];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div role="tablist" aria-label="お使いの端末" className="flex gap-1.5">
        {PLATFORMS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`install-tab-${key}`}
            aria-selected={current === key}
            aria-controls="install-steps"
            onClick={() => setSelected(key)}
            className={cn(
              "flex-1 rounded-[20px] border px-1 py-[9px] text-[11.5px] font-bold",
              current === key
                ? "border-zumi-shu bg-zumi-shu text-white"
                : "border-zumi-line bg-zumi-card text-zumi-ink",
            )}
          >
            {GUIDES[key].label}
            {key === platform && <span className="sr-only">（お使いの環境）</span>}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="install-steps"
        aria-labelledby={`install-tab-${current}`}
        className="flex flex-col gap-2"
      >
        <p className="text-[11.5px] leading-relaxed text-zumi-soft">
          {current === platform && (
            <span className="mr-1 font-bold text-zumi-shu">お使いの環境</span>
          )}
          {guide.requirement}
        </p>
        <ol className="overflow-hidden rounded-2xl border border-zumi-line bg-zumi-card">
          {guide.steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.text}
                className="flex items-center gap-3 border-b border-zumi-line px-[15px] py-3 last:border-b-0"
              >
                <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] bg-zumi-base">
                  <Icon className="size-[18px]" strokeWidth={1.7} aria-hidden />
                </span>
                <span className="text-[13px] font-semibold leading-relaxed">
                  <span className="mr-1.5 tabular-nums text-zumi-soft">{index + 1}</span>
                  {step.text}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** インストール済みの表示 */
export function InstalledNotice({ className }: { className?: string }) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-xl bg-zumi-pill px-[13px] py-2.5 text-[12.5px] font-semibold",
        className,
      )}
    >
      <CircleCheck className="size-4 shrink-0 text-zumi-shu" strokeWidth={1.8} aria-hidden />
      ホーム画面のアプリとして開いています
    </p>
  );
}

/** `/install` ページ用の組み立て。インストール済みの表示かインストールボタン、続けて手順 */
export function PwaInstallGuide() {
  const { ready, platform, installed, canInstall, install } = usePwaInstall();

  return (
    <div className="flex flex-col gap-4">
      {installed && <InstalledNotice />}
      {!installed && canInstall && (
        <button
          type="button"
          onClick={() => void install()}
          className="flex items-center justify-center gap-2 rounded-2xl bg-zumi-shu p-[15px] text-[15px] font-bold text-white"
        >
          <Download className="size-[18px]" strokeWidth={1.8} aria-hidden />
          ホーム画面に追加する
        </button>
      )}
      {ready && !platform && !installed && (
        <p className="text-[12.5px] leading-relaxed text-zumi-soft">
          スマートフォンで ZUMI を開き、次の手順で追加できます。
        </p>
      )}
      <PwaPlatformSteps platform={platform} />
    </div>
  );
}
