import { addDays, getWeekRange } from "@zumi/types";
import { collectNotificationItems, summarizeWeek, type NotifyDuty } from "./digest";
import {
  buildEveningMessage,
  buildMorningMessage,
  buildWeeklyMessage,
  type PushMessage,
} from "./messages";
import {
  getCandidateLocalTimes,
  getDueNotifications,
  type NotificationKind,
  type NotifySettings,
} from "./schedule";
import type { NotifyStore } from "./store";
import type { PushOptions, PushResult, PushSubscriptionTarget } from "./webpush";

/**
 * Cron 1回分の処理。D1・送信・ログ・Sentry は引数で受け取り、テストでは偽物を渡す。
 */

export type PushSender = (
  subscription: PushSubscriptionTarget,
  payload: string,
  options: PushOptions,
) => Promise<PushResult>;

export interface NotifyDeps {
  store: NotifyStore;
  /** null なら送信しない（VAPID 鍵が未設定のローカル開発など）。文面の生成とログまでは行う */
  send: PushSender | null;
  log: (event: string, data: Record<string, unknown>) => void;
  captureException: (error: unknown, context: Record<string, unknown>) => void;
  /** ログに文面（Duty 名を含む）を出すか。本番では出さない */
  logMessageText: boolean;
  /** テスト用。候補の時刻を求めるタイムゾーンの一覧 */
  timeZones?: readonly string[] | null;
}

/**
 * プッシュサービスが配信を待つ秒数。端末がオフラインのまま時間が経った通知は意味が変わるため短めにする
 * （夜の「まだ済んでいないもの」が翌朝に届くと、前日の話になってしまう）
 */
const PUSH_OPTIONS: Record<NotificationKind, PushOptions> = {
  MORNING: { ttl: 6 * 60 * 60, urgency: "normal", topic: "zumi-morning" },
  EVENING: { ttl: 3 * 60 * 60, urgency: "normal", topic: "zumi-evening" },
  WEEKLY: { ttl: 24 * 60 * 60, urgency: "low", topic: "zumi-weekly" },
};

/** 同時に処理するユーザー数。Workers の同時接続数（6）に合わせる */
const CONCURRENCY = 6;

export interface TickResult {
  candidateTimes: number;
  matchedUsers: number;
  failedUsers: number;
}

export async function runNotificationTick(deps: NotifyDeps, instant: Date): Promise<TickResult> {
  const localTimes = getCandidateLocalTimes(instant, deps.timeZones);
  const settingsList = await deps.store.findSettingsAt(localTimes);
  let failedUsers = 0;

  await forEachConcurrently(settingsList, CONCURRENCY, async (settings) => {
    try {
      await notifyUser(deps, settings, instant);
    } catch (error) {
      // 1人の失敗（不正なタイムゾーンなど）で他のユーザーを止めない
      failedUsers++;
      deps.log("notify.user_failed", { userId: settings.userId, error: String(error) });
      deps.captureException(error, { userId: settings.userId, timezone: settings.timezone });
    }
  });

  const result = {
    candidateTimes: localTimes.length,
    matchedUsers: settingsList.length,
    failedUsers,
  };
  deps.log("notify.tick", { at: instant.toISOString(), ...result });
  return result;
}

/** 通知の種類ごとの文面。対象がゼロなら null（送らない） */
export function buildMessage(
  kind: NotificationKind,
  duties: readonly NotifyDuty[],
  today: string,
): PushMessage | null {
  switch (kind) {
    case "MORNING":
      return buildMorningMessage(collectNotificationItems(duties, today), today);
    case "EVENING":
      return buildEveningMessage(collectNotificationItems(duties, today), today);
    case "WEEKLY":
      return buildWeeklyMessage(summarizeWeek(duties, today));
  }
}

async function notifyUser(deps: NotifyDeps, settings: NotifySettings, instant: Date) {
  const { today, kinds } = getDueNotifications(settings, instant);
  if (kinds.length === 0) return;

  // 週次サマリーは前週比のため前の週から、朝・夜は WEEKLY_COUNT のため今週の初日から読む
  const rangeStart = kinds.includes("WEEKLY")
    ? getWeekRange(addDays(today, -7), settings.weekStart).start
    : getWeekRange(today, settings.weekStart).start;
  const duties = await deps.store.loadDuties(settings, rangeStart, today, instant);

  const messages: { kind: NotificationKind; message: PushMessage }[] = [];
  for (const kind of kinds) {
    const message = buildMessage(kind, duties, today);
    deps.log(message ? "notify.message" : "notify.empty", {
      userId: settings.userId,
      kind,
      today,
      ...(message && deps.logMessageText ? { title: message.title, body: message.body } : {}),
    });
    if (message) messages.push({ kind, message });
  }
  if (messages.length === 0) return;

  const subscriptions = await deps.store.listSubscriptions(settings.userId);
  if (subscriptions.length === 0) {
    deps.log("notify.no_subscription", { userId: settings.userId });
    return;
  }
  if (!deps.send) {
    deps.log("notify.send_disabled", {
      userId: settings.userId,
      subscriptions: subscriptions.length,
    });
    return;
  }

  const gone = new Set<string>();
  for (const { kind, message } of messages) {
    const payload = JSON.stringify(message);
    for (const subscription of subscriptions) {
      if (gone.has(subscription.id)) continue;
      const result = await sendSafely(deps.send, subscription, payload, PUSH_OPTIONS[kind]);
      const context = { userId: settings.userId, kind, subscriptionId: subscription.id };
      switch (result.type) {
        case "SENT":
          deps.log("notify.sent", context);
          break;
        case "GONE":
          gone.add(subscription.id);
          await deps.store.deleteSubscription(subscription.id);
          deps.log("notify.subscription_removed", { ...context, status: result.status });
          break;
        case "FAILED":
          deps.log("notify.send_failed", {
            ...context,
            status: result.status,
            detail: result.detail,
          });
          // 429・5xx はプッシュサービス側の一時的な失敗。それ以外（鍵の設定ミスなど）は Sentry に送る
          if (result.status !== 429 && result.status < 500) {
            deps.captureException(new Error(`Web Push の送信に失敗しました（${result.status}）`), {
              ...context,
              status: result.status,
              detail: result.detail,
            });
          }
          break;
      }
    }
  }
}

/** 通信エラー（fetch の例外）は1端末の失敗として扱い、他の端末への送信を続ける */
async function sendSafely(
  send: PushSender,
  subscription: PushSubscriptionTarget,
  payload: string,
  options: PushOptions,
): Promise<PushResult> {
  try {
    return await send(subscription, payload, options);
  } catch (error) {
    return { type: "FAILED", status: 0, detail: String(error) };
  }
}

async function forEachConcurrently<T>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}
