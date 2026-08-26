// Service Worker: Web Push 受信 + 通知表示（フェーズ4で実装）。
// docs/05-tech-stack.md の配信設計に対応する最小スケルトン。

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "ZUMI", {
      body: payload.body,
      icon: "/icon.png",
      data: payload.data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/app";
  event.waitUntil(self.clients.openWindow(url));
});
