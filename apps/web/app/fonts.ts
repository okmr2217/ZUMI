import localFont from "next/font/local";
import { Zen_Kaku_Gothic_New } from "next/font/google";

// next/font/google はビルド時に Google Fonts から取り寄せて自前で配信する（実行時に Google へは通信しない）。
// 日本語のフォントは unicode-range で百数十に分割されており、ページで使う文字を含むファイルだけが
// 読まれる。分割が日本語の文字単位で subsets（latin 等）と対応しないため、preload はしない。
// どの書体も CSS 変数で渡し、tailwind.config.ts の fontFamily と lp.css から参照する。
// シェア画像・OGP 画像（Satori）は別の仕組み（lib/og-fonts.ts）で実行時に取得している。

/** 本文・見出し（アプリ全体と LP の見出し）。semibold（600）は 700 で描かれる */
export const zenKakuGothicNew = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700", "900"],
  display: "swap",
  preload: false,
  variable: "--font-zen-kaku",
});

/**
 * 「済」の朱印。この書体で描くのは「済」の1字だけなので、Google Fonts の全文字分（百数十の
 * @font-face）を載せず、「済」だけを含むサブセットを同梱する。Yuji Syuku は SIL Open Font
 * License 1.1。取り直すときは
 * `https://fonts.googleapis.com/css2?family=Yuji+Syuku&text=%E6%B8%88` の woff2 を保存する
 */
export const yujiSyuku = localFont({
  src: "./fonts/yuji-syuku-zumi.woff2",
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-yuji-syuku",
});
