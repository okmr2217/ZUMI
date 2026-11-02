import * as Sentry from "@sentry/cloudflare";
import { runNotificationTick, type PushSender } from "./notify";
import { createD1Store } from "./store";
import { createVapidSigner, sendPush, type VapidSigner } from "./webpush";

export interface Env {
  DB: D1Database;
  NEXT_PUBLIC_APP_ENV: string;
  SENTRY_DSN?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  /** VAPID の連絡先（`https:` か `mailto:`） */
  VAPID_SUBJECT: string;
  /** "true" のときだけ、ログに通知の文面（Duty 名を含む）を出す。ローカル確認用 */
  LOG_NOTIFICATION_TEXT?: string;
}

const MS_PER_MINUTE = 60_000;

/** Sentry の Cron Monitor。初回のチェックインで MONITOR_CONFIG の内容で作られる（upsert） */
const MONITOR_SLUG = "zumi-notify-tick";
const MONITOR_CONFIG = {
  // wrangler.toml の `[triggers] crons` と同じ（Cron Trigger は UTC）
  schedule: { type: "crontab", value: "* * * * *" },
  timezone: "Etc/UTC",
  // 予定の分から1分以内にチェックインがなければ「取りこぼし」
  checkinMargin: 1,
  maxRuntime: 5,
  // Cron がまれに1回飛ぶ程度ではアラートを出さず、3分続いたら Issue にする
  failureIssueThreshold: 3,
  recoveryThreshold: 1,
} satisfies NonNullable<Parameters<typeof Sentry.withMonitor>[2]>;

export default Sentry.withSentry<ExportedHandler<Env>>(
  (env) => ({ dsn: env.SENTRY_DSN, environment: env.NEXT_PUBLIC_APP_ENV }),
  {
    /**
     * 毎分起動（wrangler.toml の `[triggers] crons`）。朝・夜・週次の通知時刻が
     * 現地時刻と一致するユーザーを抽出し、Web Push で送る（docs/02・docs/05「通知配信の設計」）。
     *
     * 「いま」には実行時刻ではなく Cron の予定時刻（`scheduledTime`）を使う。
     * 起動が遅れても、本来の分のユーザーに送れるようにするため。
     *
     * Sentry の Cron Monitors でチェックインし、Cron が止まった・失敗し続けたときに気づけるようにする。
     * ユーザー単位の送信の失敗は runNotificationTick の中で拾うため、失敗になるのは抽出（D1）など全体が落ちたとき。
     */
    async scheduled(controller, env) {
      const instant = new Date(
        Math.floor(controller.scheduledTime / MS_PER_MINUTE) * MS_PER_MINUTE,
      );
      await Sentry.withMonitor(
        MONITOR_SLUG,
        async () =>
          runNotificationTick(
            {
              store: createD1Store(env.DB),
              send: await createSender(env, instant),
              log: (event, data) => console.log(JSON.stringify({ event, ...data })),
              captureException: (error, context) =>
                Sentry.captureException(error, { extra: context }),
              logMessageText: env.LOG_NOTIFICATION_TEXT === "true",
            },
            instant,
          ),
        MONITOR_CONFIG,
      );
    },
  },
);

/**
 * VAPID 鍵が未設定・不正なら null（送信せず、文面の生成とログまで行う）。
 * 鍵の形式ミスで抽出まで止まると、何が送られるはずだったかも分からなくなるため
 */
async function createSender(env: Env, now: Date): Promise<PushSender | null> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn("zumi-notify: VAPID 鍵が未設定のため送信しません");
    return null;
  }
  let signer: VapidSigner;
  try {
    signer = await createVapidSigner({
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
    });
  } catch (error) {
    console.error("zumi-notify: VAPID 鍵が不正なため送信しません", error);
    Sentry.captureException(error);
    return null;
  }
  return (subscription, payload, options) => sendPush(subscription, payload, signer, options, now);
}
