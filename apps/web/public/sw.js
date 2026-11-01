// Service Worker: Web Push の受信・通知の表示・タップ時の遷移（docs/02-notifications.md）。
// `/app` スコープで登録する（lib/push-client.ts の registerServiceWorker）。
//
// fetch ハンドラは持たない。認証が必要なページや API をキャッシュすると、
// ログアウト後や別アカウントで古い内容が出るため、オフライン対応は入れていない。
//
// push のペイロード（apps/notify が web-push で送る JSON）:
//   { "title": string, "body"?: string, "url"?: string, "tag"?: string }
//   - url: タップで開く同一オリジンのパス（例: "/app"、振り返りタブ）。省略時は "/app"
//   - tag: 同じ tag の通知は上書きされる（例: "morning" / "evening" / "weekly"）

const DEFAULT_URL = "/app";
const NOTIFICATION_ICON = "/icon-192.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** 同一オリジンのパスだけを通す。外部 URL や不正な値は既定の `/app` にする。 */
function toSafePath(value) {
  if (typeof value !== "string") return DEFAULT_URL;
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return DEFAULT_URL;
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_URL;
  }
}

function readPayload(data) {
  if (!data) return {};
  try {
    const payload = data.json();
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return { body: data.text() };
  }
}

self.addEventListener("push", (event) => {
  const payload = readPayload(event.data);
  const title = typeof payload.title === "string" && payload.title ? payload.title : "ZUMI（済）";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof payload.body === "string" ? payload.body : undefined,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: typeof payload.tag === "string" ? payload.tag : undefined,
      data: { url: toSafePath(payload.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = toSafePath(event.notification.data?.url);
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // 同じページが開いていればそれを前面に、アプリのタブが開いていればそこで遷移する。
      const same = windows.find((client) => client.url === target);
      if (same) return same.focus();

      const appWindow = windows.find((client) => /^\/app(\/|$)/.test(new URL(client.url).pathname));
      // navigate() はこの worker が制御していないタブ（登録前から開いていたタブ）では
      // 失敗するので、そのときは新しいウィンドウで開く。
      const navigated = await appWindow?.navigate(target).catch(() => null);
      if (navigated) return navigated.focus();
      return self.clients.openWindow(target);
    })(),
  );
});

// プッシュサービス側で購読が更新されたとき（鍵の期限切れなど）に、新しい購読を保存し直す。
// ログイン中であれば Cookie が付くので、`/api/push/subscription` がそのユーザーに紐づける。
self.addEventListener("pushsubscriptionchange", (event) => {
  const oldSubscription = event.oldSubscription;
  const applicationServerKey = oldSubscription?.options?.applicationServerKey;
  if (!applicationServerKey) return;

  event.waitUntil(
    (async () => {
      const subscription =
        event.newSubscription ??
        (await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }));
      await fetch("/api/push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          oldEndpoint: oldSubscription.endpoint,
        }),
      });
    })(),
  );
});
