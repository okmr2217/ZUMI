/**
 * ブラウザ側の Web Push 購読処理（Service Worker の登録・購読・解除）。
 * Client Component からだけ使う。サーバーへの保存は `/api/push/subscription`。
 */

/** `public/sw.js` を `/app` 配下だけに効かせる。LP（`/`）は対象にしない。 */
const SW_URL = "/sw.js";
const SW_SCOPE = "/app";
const SUBSCRIPTION_API = "/api/push/subscription";

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iPhone / iPad（iPadOS は Mac の UA を名乗るため、タッチ対応で見分ける）。 */
export function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

/** ホーム画面に追加したアプリとして開いているか。 */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function registerServiceWorker() {
  return navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
}

async function getRegistration() {
  return (await navigator.serviceWorker.getRegistration(SW_SCOPE)) ?? registerServiceWorker();
}

/**
 * 購読には有効化済みの worker が要る。`navigator.serviceWorker.ready` は
 * 今のページがスコープ外だと解決しないため、登録そのものの状態を待つ。
 */
function waitForActive(registration: ServiceWorkerRegistration) {
  if (registration.active) return Promise.resolve();
  const worker = registration.installing ?? registration.waiting;
  if (!worker) return Promise.reject(new Error("Service Worker が見つかりません"));
  return new Promise<void>((resolve, reject) => {
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") resolve();
      if (worker.state === "redundant") reject(new Error("Service Worker の登録に失敗しました"));
    });
  });
}

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** VAPID 公開鍵（base64url）を `applicationServerKey` に渡せる形にする。 */
function decodeBase64Url(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array) {
  if (!a || a.byteLength !== b.byteLength) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
}

export async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch(SUBSCRIPTION_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!response.ok) throw new Error(`購読の保存に失敗しました（${response.status}）`);
}

/**
 * 通知の許可を求め、購読してサーバーに保存する。許可ダイアログを出すため、
 * ボタンのクリックなどユーザー操作の中から呼ぶこと。許可されなければ null を返す。
 */
export async function subscribePush(vapidPublicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await getRegistration();
  await waitForActive(registration);
  const applicationServerKey = decodeBase64Url(vapidPublicKey);

  let subscription = await registration.pushManager.getSubscription();
  // 鍵を作り直した後の古い購読は、新しい鍵では送れないので作り直す。
  if (subscription && !sameKey(subscription.options.applicationServerKey, applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  await saveSubscription(subscription);
  return subscription;
}

/** この端末の購読をサーバーとブラウザの両方から外す。購読がなければ何もしない。 */
export async function unsubscribePush() {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;

  // サーバー側の削除に失敗しても、ブラウザ側は外す。外した購読への送信は
  // プッシュサービスが 404/410 を返すので、そこで notify が行を消せる。
  try {
    await fetch(SUBSCRIPTION_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } finally {
    await subscription.unsubscribe();
  }
}
