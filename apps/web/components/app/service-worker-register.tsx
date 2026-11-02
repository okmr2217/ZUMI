"use client";

import { useEffect } from "react";
import { isPushSupported, registerServiceWorker, saveSubscription } from "@/lib/push-client";

/**
 * `/app` を開いたときに Service Worker を登録する。
 * この端末がすでに購読していれば、サーバーにも保存し直す。同じブラウザで別の
 * アカウントにログインし直した場合に、購読を今のユーザーに付け替えるため。
 * 失敗しても画面の操作には影響しないので、エラーは握りつぶす。
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!isPushSupported()) return;

    registerServiceWorker()
      .then(async (registration) => {
        if (Notification.permission !== "granted") return;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await saveSubscription(subscription);
      })
      .catch(() => {});
  }, []);

  return null;
}
