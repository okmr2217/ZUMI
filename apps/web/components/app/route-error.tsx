"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorScreen } from "./error-screen";

/**
 * `error.tsx` の中身。描画中のエラーは Sentry の自動計装では拾われないため、ここで送る
 * （Sentry の Next.js SDK の推奨）。サーバーのエラーは `error.message` が伏せられて届くので、画面には出さない
 */
export function RouteError({
  error,
  retry,
  fullScreen,
}: {
  error: unknown;
  retry: () => void;
  fullScreen?: boolean;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorScreen
      title="うまく表示できませんでした"
      description="一時的な問題かもしれません。もう一度読み込んでも直らないときは、時間をおいて開き直してください。"
      primary={{ label: "もう一度読み込む", onClick: retry }}
      secondary={{ label: "今日の画面へ", href: "/app" }}
      fullScreen={fullScreen}
    />
  );
}
