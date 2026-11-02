// Service Worker: Web Push の受信・通知の表示・タップ時の遷移（docs/02-notifications.md）。
// `/app` スコープで登録する（lib/push-client.ts の registerServiceWorker）。
//
// オフライン対応は最小限にとどめる。キャッシュするのは public/offline.html（ユーザーデータを
// 含まない静的ページ）だけで、`/app` 配下のナビゲーションがネットワークエラーになったときに
// それを返す。認証が必要なページや API の応答はキャッシュしない。ログアウト後や
// 別アカウントで古い内容が出るため。ナビゲーション以外の要求（API・RSC・静的ファイル）には
// 手を出さず、ブラウザの通常の処理に任せる。
//
// push のペイロード（apps/notify が web-push で送る JSON）:
//   { "title": string, "body"?: string, "url"?: string, "tag"?: string }
//   - url: タップで開く同一オリジンのパス（例: "/app"、振り返りタブ）。省略時は "/app"
//   - tag: 同じ tag の通知は上書きされる（apps/notify は "zumi-morning" / "zumi-evening" / "zumi-weekly"）

const DEFAULT_URL = "/app";
const NOTIFICATION_ICON = "/icons/icon-192.png";

// public/offline.html を変えたら CACHE_VERSION を上げる。sw.js 自体が変わらないと
// ブラウザは worker を入れ直さず、古いオフライン用ページを返し続けるため。
const CACHE_PREFIX = "zumi-offline-";
const CACHE_VERSION = "v1";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const OFFLINE_URL = "/offline.html";

/** オフライン用ページを今の版のキャッシュに入れる。入っていれば true。 */
async function cacheOfflinePage() {
  const cache = await caches.open(CACHE_NAME);
  if (await cache.match(OFFLINE_URL)) return true;
  try {
    const response = await fetch(OFFLINE_URL, { cache: "reload" });
    if (!response.ok) return false;
    // 本番の Workers Assets は `/offline.html` を `/offline` へリダイレクトする（html_handling）。
    // リダイレクトを経た応答はナビゲーションへ返すとブラウザがエラーにするため、作り直して保存する。
    // 本文は展開済みなので、Content-Encoding・Content-Length は引き継がず Content-Type だけ写す。
    const headers = { "Content-Type": response.headers.get("Content-Type") ?? "text/html" };
    await cache.put(OFFLINE_URL, new Response(await response.blob(), { headers }));
    return true;
  } catch {
    return false;
  }
}

self.addEventListener("install", (event) => {
  // オフライン用ページの取得に失敗しても、インストール自体は止めない（止めると Web Push まで
  // 使えなくなるため）。取れなかった分は activate と、次にオンラインで開いたときに取り直す。
  event.waitUntil(cacheOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // このアプリが作った古い版のキャッシュだけを消す。今の版に入れられなかったときは、
      // オフライン時に返せるものがなくなるので古い版を残す。
      if (await cacheOfflinePage()) {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        );
      }
      // worker の起動を待たずにナビゲーションの要求を先に出させる（fetch ハンドラで遅くしないため）。
      await self.registration.navigationPreload?.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const response = (await event.preloadResponse) ?? (await fetch(event.request));
        // インストール時に取れなかった場合に備えて、オンラインのうちに入れておく（入っていれば何もしない）。
        event.waitUntil(cacheOfflinePage());
        return response;
      } catch {
        // 今の版になければ、activate で残した古い版から返す。
        const offline = await caches.match(OFFLINE_URL);
        return offline ?? Response.error();
      }
    })(),
  );
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
