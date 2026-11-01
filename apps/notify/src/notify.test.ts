import { describe, expect, it, vi } from "vitest";
import type { NotifyDuty } from "./digest";
import { runNotificationTick, type NotifyDeps, type PushSender } from "./notify";
import type { NotifySettings } from "./schedule";
import type { NotifyStore } from "./store";
import type { PushResult } from "./webpush";

// 2026-11-08（日）20:00 東京 = 11:00 UTC
const SUNDAY_2000_JST = new Date("2026-11-08T11:00:00Z");

const settings = (userId: string, overrides: Partial<NotifySettings> = {}): NotifySettings => ({
  userId,
  timezone: "Asia/Tokyo",
  morningNotifyEnabled: false,
  morningNotifyAt: null,
  eveningNotifyEnabled: true,
  eveningNotifyAt: "20:00",
  weeklySummaryEnabled: false,
  weeklySummaryAt: "20:00",
  weekStart: 1,
  ...overrides,
});

const protein: NotifyDuty = {
  name: "プロテイン",
  sortOrder: 0,
  schedule: {
    duty: {
      scheduleConfig: { type: "DAILY" },
      createdAt: new Date("2026-10-01T00:00:00+09:00"),
      archivedAt: null,
    },
    logs: [],
    pauses: [],
    timeZone: "Asia/Tokyo",
    weekStart: 1,
  },
};

const subscription = (id: string) => ({
  id,
  endpoint: `https://push.example.com/${id}`,
  p256dh: "p256dh",
  auth: "auth",
});

function setup(options: {
  settings: NotifySettings[];
  duties?: Record<string, NotifyDuty[]>;
  subscriptions?: Record<string, ReturnType<typeof subscription>[]>;
  send?: PushSender | null;
}) {
  const store = {
    findSettingsAt: vi.fn<NotifyStore["findSettingsAt"]>(async () => options.settings),
    loadDuties: vi.fn<NotifyStore["loadDuties"]>(
      async (s) => options.duties?.[s.userId] ?? [protein],
    ),
    listSubscriptions: vi.fn<NotifyStore["listSubscriptions"]>(
      async (userId) => options.subscriptions?.[userId] ?? [subscription(`${userId}-a`)],
    ),
    deleteSubscription: vi.fn<NotifyStore["deleteSubscription"]>(async () => {}),
  };
  const send = vi.fn<PushSender>(async () => ({ type: "SENT" }) as PushResult);
  const events: { event: string; data: Record<string, unknown> }[] = [];
  const deps: NotifyDeps = {
    store,
    send: options.send === undefined ? send : options.send,
    log: (event, data) => events.push({ event, data }),
    captureException: vi.fn(),
    logMessageText: true,
    timeZones: ["Asia/Tokyo", "UTC"],
  };
  return { deps, store, send, events };
}

describe("runNotificationTick", () => {
  it("候補の時刻で設定を読み、一致したユーザーに文面を送る", async () => {
    const { deps, store, send } = setup({ settings: [settings("u1")] });
    const result = await runNotificationTick(deps, SUNDAY_2000_JST);

    expect(store.findSettingsAt).toHaveBeenCalledWith(["11:00", "20:00"]);
    // 朝・夜は今週の初日から読む
    expect(store.loadDuties).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
      "2026-11-02",
      "2026-11-08",
      SUNDAY_2000_JST,
    );
    expect(send).toHaveBeenCalledTimes(1);
    const [target, payload, pushOptions] = send.mock.calls[0]!;
    expect(target.endpoint).toBe("https://push.example.com/u1-a");
    expect(JSON.parse(payload)).toEqual({
      title: "まだ済んでいないもの 1件",
      body: "プロテイン",
      url: "/app",
      tag: "zumi-evening",
    });
    expect(pushOptions).toMatchObject({ topic: "zumi-evening" });
    expect(result).toEqual({ candidateTimes: 2, matchedUsers: 1, failedUsers: 0 });
  });

  it("週次サマリーは前の週の初日から読み、振り返りタブへの通知を送る", async () => {
    const { deps, store, send } = setup({
      settings: [settings("u1", { eveningNotifyEnabled: false, weeklySummaryEnabled: true })],
    });
    await runNotificationTick(deps, SUNDAY_2000_JST);
    expect(store.loadDuties.mock.calls[0]![1]).toBe("2026-10-26");
    expect(JSON.parse(send.mock.calls[0]![1])).toMatchObject({
      title: "今週は 0/7",
      body: "先週と同じ。シェア用のカードができています",
      url: "/app/review",
    });
  });

  it("D1 で拾っても現地時刻が一致しなければ何もしない", async () => {
    // UTC の 20:00 ではない（UTC 11:00）
    const { deps, store, send } = setup({ settings: [settings("u1", { timezone: "UTC" })] });
    await runNotificationTick(deps, SUNDAY_2000_JST);
    expect(store.loadDuties).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("対象がゼロなら送らず、購読も読まない", async () => {
    const { deps, store, send, events } = setup({
      settings: [settings("u1")],
      duties: { u1: [] },
    });
    await runNotificationTick(deps, SUNDAY_2000_JST);
    expect(store.listSubscriptions).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(events.map((e) => e.event)).toContain("notify.empty");
  });

  it("購読がなければ送らずにログだけ残す", async () => {
    const { deps, send, events } = setup({ settings: [settings("u1")], subscriptions: { u1: [] } });
    await runNotificationTick(deps, SUNDAY_2000_JST);
    expect(send).not.toHaveBeenCalled();
    expect(events.map((e) => e.event)).toEqual([
      "notify.message",
      "notify.no_subscription",
      "notify.tick",
    ]);
    expect(events[0]!.data).toMatchObject({
      title: "まだ済んでいないもの 1件",
      body: "プロテイン",
    });
  });

  it("ログに文面を出さない設定なら、件数だけを残す", async () => {
    const { deps, events } = setup({ settings: [settings("u1")] });
    await runNotificationTick({ ...deps, logMessageText: false }, SUNDAY_2000_JST);
    const message = events.find((e) => e.event === "notify.message")!;
    expect(message.data).not.toHaveProperty("title");
    expect(message.data).not.toHaveProperty("body");
  });

  it("送信手段がなければ（VAPID 鍵が未設定）、文面の生成までで止める", async () => {
    const { deps, events } = setup({ settings: [settings("u1")], send: null });
    await runNotificationTick(deps, SUNDAY_2000_JST);
    expect(events.map((e) => e.event)).toContain("notify.send_disabled");
  });

  it("全端末に送り、404/410 の購読は削除して以降は送らない", async () => {
    const { deps, store, send } = setup({
      settings: [settings("u1", { weeklySummaryEnabled: true })],
      subscriptions: { u1: [subscription("ok"), subscription("gone"), subscription("err")] },
    });
    send.mockImplementation(async (target) => {
      if (target.endpoint.endsWith("/gone")) return { type: "GONE", status: 410 };
      if (target.endpoint.endsWith("/err")) return { type: "FAILED", status: 503, detail: "" };
      return { type: "SENT" };
    });
    await runNotificationTick(deps, SUNDAY_2000_JST);

    // 夜と週次の2通。gone は1通目で削除し、2通目は送らない
    expect(send.mock.calls.map(([target]) => target.endpoint.split("/").pop())).toEqual([
      "ok",
      "gone",
      "err",
      "ok",
      "err",
    ]);
    expect(store.deleteSubscription).toHaveBeenCalledTimes(1);
    expect(store.deleteSubscription).toHaveBeenCalledWith("gone");
    // 5xx は一時的な失敗として Sentry には送らない
    expect(deps.captureException).not.toHaveBeenCalled();
  });

  it("購読の削除に失敗しても、他の端末への送信は続ける", async () => {
    const { deps, store, send } = setup({
      settings: [settings("u1")],
      subscriptions: { u1: [subscription("gone"), subscription("ok")] },
    });
    send.mockImplementation(async (target) =>
      target.endpoint.endsWith("/gone") ? { type: "GONE", status: 410 } : { type: "SENT" },
    );
    store.deleteSubscription.mockRejectedValue(new Error("D1 error"));
    const result = await runNotificationTick(deps, SUNDAY_2000_JST);
    expect(send).toHaveBeenCalledTimes(2);
    expect(result.failedUsers).toBe(0);
    expect(deps.captureException).toHaveBeenCalledTimes(1);
  });

  it("鍵の設定ミスなど 4xx の失敗と通信エラーは Sentry に送り、他の端末への送信は続ける", async () => {
    const { deps, send } = setup({
      settings: [settings("u1")],
      subscriptions: { u1: [subscription("bad"), subscription("throw"), subscription("ok")] },
    });
    send.mockImplementation(async (target) => {
      if (target.endpoint.endsWith("/bad")) return { type: "FAILED", status: 403, detail: "x" };
      if (target.endpoint.endsWith("/throw")) throw new Error("network");
      return { type: "SENT" };
    });
    await runNotificationTick(deps, SUNDAY_2000_JST);
    expect(send).toHaveBeenCalledTimes(3);
    expect(deps.captureException).toHaveBeenCalledTimes(2);
  });

  it("1人の失敗（不正なタイムゾーン・D1 のエラー）で他のユーザーを止めない", async () => {
    const { deps, store, send } = setup({
      settings: [
        settings("bad-tz", { timezone: "Invalid/Zone" }),
        settings("db-error"),
        settings("u3"),
      ],
    });
    store.loadDuties.mockImplementation(async (s) => {
      if (s.userId === "db-error") throw new Error("D1 error");
      return [protein];
    });
    const result = await runNotificationTick(deps, SUNDAY_2000_JST);
    expect(result.failedUsers).toBe(2);
    expect(deps.captureException).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].endpoint).toBe("https://push.example.com/u3-a");
  });
});
