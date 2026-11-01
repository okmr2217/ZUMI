"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCurrentSubscription,
  isIos,
  isPushSupported,
  isStandalone,
  subscribePush,
  unsubscribePush,
} from "./push-client";

/**
 * この端末の通知の状態。
 * - `ios-install`: iOS でホーム画面に追加していない（Safari では Web Push を受け取れない）
 * - `unsupported`: それ以外の理由でブラウザが Web Push に対応していない
 * - `denied`: ブラウザの設定で通知がブロックされている（ページからは許可を求め直せない）
 * - `off`: 未購読（許可前、またはこの端末でオフにした）
 * - `on`: 購読済み
 */
export type PushStatus = "loading" | "ios-install" | "unsupported" | "denied" | "off" | "on";

function detectUnavailable(): PushStatus | null {
  if (isIos() && !isStandalone()) return "ios-install";
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return null;
}

/**
 * 通知設定フォームと今日タブの通知許可バナーで共有する購読フック。
 * `subscribe` は許可ダイアログを出すので、ボタンの onClick から呼ぶこと。
 */
export function usePushSubscription(vapidPublicKey: string | null) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const unavailable = detectUnavailable();
    if (unavailable) {
      setStatus(unavailable);
      return;
    }
    const subscription = await getCurrentSubscription().catch(() => null);
    setStatus(subscription && Notification.permission === "granted" ? "on" : "off");
  }, []);

  useEffect(() => {
    // マウント時にブラウザの状態を読むだけで、外部への書き込みはしない。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!vapidPublicKey) {
      setError("通知の設定が読み込めませんでした。時間をおいて試してください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await subscribePush(vapidPublicKey);
    } catch (e) {
      console.error(e);
      setError("通知をオンにできませんでした。時間をおいて試してください。");
    } finally {
      await refresh();
      setBusy(false);
    }
  }, [vapidPublicKey, refresh]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await unsubscribePush();
    } catch (e) {
      console.error(e);
      setError("通知をオフにできませんでした。時間をおいて試してください。");
    } finally {
      await refresh();
      setBusy(false);
    }
  }, [refresh]);

  return { status, busy, error, subscribe, unsubscribe };
}
