"use client";

import { RouteError } from "@/components/app/route-error";
import { yujiSyuku, zenKakuGothicNew } from "./fonts";
import "./globals.css";

/**
 * ルートのレイアウト自体で起きたエラー。レイアウトの代わりに描かれるため、`<html>`・書体・CSS を自分で持つ。
 * Sentry の Next.js SDK は、描画中のエラーをここで送ることを求めている（RouteError が送る）
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="ja" className={`${zenKakuGothicNew.variable} ${yujiSyuku.variable}`}>
      <body>
        <title>エラー — ZUMI（済）</title>
        <RouteError error={error} retry={retry} />
      </body>
    </html>
  );
}
