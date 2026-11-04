import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Smartphone, Store } from "lucide-react";
import { PwaInstallGuide } from "@/components/app/pwa-install-guide";

export const metadata: Metadata = {
  title: "ホーム画面に追加 — ZUMI（済）",
  description: "ZUMI をホーム画面に追加して、アプリのように使う手順です。",
};

const BENEFITS = [
  {
    icon: Smartphone,
    title: "1タップで開ける",
    text: "ホーム画面のアイコンから、今日の分にすぐ届きます。",
  },
  {
    icon: Bell,
    title: "通知が届く",
    text: "iPhone・iPad では、ホーム画面に追加すると通知を受け取れるようになります。",
  },
  { icon: Store, title: "ストア不要・無料", text: "アプリストアからのダウンロードはいりません。" },
] as const;

const NOTES = [
  "ホーム画面のアプリを開くと、今日タブから始まります。ログインしていなければログイン画面が出ます。",
  "iPhone・iPad では、ホーム画面のアプリと Safari・Chrome でログイン状態が共有されません。はじめて開いたときは、アプリの中でログインし直してください。",
  "通知はホーム画面のアプリでログインしたあと、今日タブのお知らせか設定から許可できます。",
  "やめるときはアイコンを長押しして削除します。アプリを削除しても、記録した内容は消えません。",
  "PC の Chrome・Edge でも、アドレスバー右端のインストールのアイコンから追加できます。",
] as const;

/**
 * ホーム画面に追加する案内（公開ページ。ログイン前のスマホからも見られるように `/app` の外に置く）。
 * 設定のヘルプからリンクする。オンボーディングのステップ1も同じ手順を使う。
 */
export default function InstallPage() {
  return (
    <div className="min-h-dvh bg-zumi-bg font-zumi text-zumi-ink">
      <header className="border-b border-zumi-line">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-5 py-4">
          <Link href="/" className="text-[15px] font-black tracking-[.04em] no-underline">
            ZUMI<span className="text-zumi-shu">（済）</span>
          </Link>
          <Link href="/app" className="text-[12.5px] font-bold text-zumi-soft">
            アプリを開く
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-[480px] flex-col gap-8 px-5 pb-16 pt-10">
        <section>
          <p className="text-[12px] font-bold tracking-[.08em] text-zumi-soft">アプリとして使う</p>
          <h1 className="mt-1.5 text-[24px] font-black leading-snug tracking-[.02em]">
            ZUMI を
            <br />
            ホーム画面に追加する
          </h1>
          <div className="mt-4 h-[3px] w-10 bg-zumi-shu" aria-hidden />
          <p className="mt-4 text-[13.5px] leading-relaxed">
            ホーム画面に追加すると、ZUMI をアプリのように使えます。
          </p>
        </section>

        <ul className="overflow-hidden rounded-2xl border border-zumi-line bg-zumi-card">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <li
                key={benefit.title}
                className="flex items-start gap-3 border-b border-zumi-line px-[15px] py-3 last:border-b-0"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zumi-tint text-zumi-shu">
                  <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-bold">{benefit.title}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-zumi-soft">
                    {benefit.text}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        <section className="flex flex-col gap-3">
          <h2 className="text-[11.5px] font-bold tracking-[.06em] text-zumi-soft">追加の手順</h2>
          <PwaInstallGuide />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-[11.5px] font-bold tracking-[.06em] text-zumi-soft">補足</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-[12.5px] leading-relaxed">
            {NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-zumi-line">
        <nav className="mx-auto flex max-w-[720px] flex-wrap gap-x-5 gap-y-2 px-5 pb-10 pt-6 text-[13px] text-zumi-soft">
          <Link href="/" className="hover:text-zumi-shu">
            トップ
          </Link>
          <Link href="/terms" className="hover:text-zumi-shu">
            利用規約
          </Link>
          <Link href="/privacy" className="hover:text-zumi-shu">
            プライバシーポリシー
          </Link>
        </nav>
      </footer>
    </div>
  );
}
