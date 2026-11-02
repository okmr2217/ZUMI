import { Noto_Sans_JP } from "next/font/google";
import { isSignupEnabled } from "@/lib/signup";
import { LandingPage } from "./landing";

// LP の本文だけが使う書体。アプリ側のページに @font-face を載せないよう、LP のルートでだけ読む
// （読み込み方の方針は app/fonts.ts）。太さごとの静的フォントを3つ載せると @font-face も3倍に
// なるため、可変フォント1つにする。静的フォントのときは 600 が 700 で描かれていたため、lp.css で
// Noto で描く要素は 400・500・700 だけを指定する
const notoSansJp = Noto_Sans_JP({
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-jp",
});

// SIGNUP_ENABLED はリクエスト時の Cloudflare env から読むため、ビルド時に静的生成しない。
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    // CSS 変数を渡すだけの要素なので、レイアウトには関わらせない
    <div className={`${notoSansJp.variable} contents`}>
      <LandingPage signupEnabled={isSignupEnabled()} />
    </div>
  );
}
