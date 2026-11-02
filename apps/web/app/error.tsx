"use client";

import { RouteError } from "@/components/app/route-error";

/** ルートのレイアウトの中で起きたエラー（LP・ログイン・オンボーディング、`/app` のレイアウト自体など） */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} />;
}
