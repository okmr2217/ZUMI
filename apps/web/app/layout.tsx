import type { Metadata, Viewport } from "next";
import { yujiSyuku, zenKakuGothicNew } from "./fonts";
import "./globals.css";

const title = "ZUMI（済）";
const description =
  "やったら「済」。忘れていたら、教えてくれる。毎日のことも、週に何回かのことも、月イチのことも。まだのものは、夜に通知が知らせてくれます。";

export const metadata: Metadata = {
  metadataBase: new URL("https://zumi.paritto.dev"),
  title,
  description,
  // manifest は app/manifest.ts、アイコンは app/favicon.ico・app/apple-icon.png から自動で <head> に入る
  appleWebApp: {
    capable: true,
    title: "ZUMI",
    // black-translucent だと本文がステータスバーの下に潜るため、既定の不透明なバーにする
    statusBarStyle: "default",
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "ZUMI（済）",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  other: {
    // Next は mobile-web-app-capable しか出力しない。iOS の古いバージョンは
    // apple- 付きの名前でしかスタンドアロン起動と判定しないため、併記する
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  // manifest の theme_color と同じ生成り地
  themeColor: "#faf6ef",
  // ホーム画面アプリでホームインジケーター等の safe-area を env() で取れるようにする。
  // 余白は globals.css の pt-safe / pb-safe / px-safe で各画面が付ける
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${zenKakuGothicNew.variable} ${yujiSyuku.variable}`}>
      <body>{children}</body>
    </html>
  );
}
