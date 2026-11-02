"use client";

import { RouteError } from "@/components/app/route-error";

/**
 * `/app` の各タブで起きたエラー。レイアウトの中に出すので、タブバーは残り、ほかのタブへは移れる。
 * レイアウト自体（セッションの取得など）のエラーはルートの `app/error.tsx` が受ける
 */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} fullScreen={false} />;
}
