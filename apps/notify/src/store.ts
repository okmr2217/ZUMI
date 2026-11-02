import { and, eq, or, sql, type AnyColumn } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { loadScheduleInputs } from "@zumi/db/queries";
import * as schema from "@zumi/db/schema";
import { pushSubscriptions, userSettings } from "@zumi/db/schema";
import type { NotifyDuty } from "./digest";
import type { NotifySettings } from "./schedule";
import type { PushSubscriptionTarget } from "./webpush";

/**
 * 通知が D1 に求める読み書き。判定のテストでは、この interface の偽物を渡す
 * （クエリそのものは store.test.ts でローカルの D1 に対して確かめる）。
 */
export interface NotifyStore {
  /** `*_notify_at` が `localTimes` のどれかに一致し、その通知が有効な設定 */
  findSettingsAt(localTimes: readonly string[]): Promise<NotifySettings[]>;
  /**
   * ユーザーの Duty（一時停止・アーカイブを含む）と、`rangeStart`〜`today` のログ、一時停止期間。
   * `SINCE_LAST` には `rangeStart` より前の最新の DONE も含める（なければ催促扱いになるため）。
   */
  loadDuties(
    settings: Pick<NotifySettings, "userId" | "timezone" | "weekStart">,
    rangeStart: string,
    today: string,
    now: Date,
  ): Promise<NotifyDuty[]>;
  listSubscriptions(userId: string): Promise<(PushSubscriptionTarget & { id: string })[]>;
  deleteSubscription(id: string): Promise<void>;
}

/**
 * これより前にアーカイブした Duty は読まない。集計の範囲（前の週の初日〜今日）は最長 13 日前までで、
 * タイムゾーンのずれを足しても 15 日あれば有効期間に掛からない
 */
const ARCHIVED_LOOKBACK_MS = 15 * 86_400_000;

export function createD1Store(d1: D1Database): NotifyStore {
  const db = drizzle(d1, { schema });

  return {
    async findSettingsAt(localTimes) {
      if (localTimes.length === 0) return [];
      // D1 のバインド変数の上限（100）を避けるため、候補の時刻は JSON 1つで渡す
      const candidates = sql`(select value from json_each(${JSON.stringify(localTimes)}))`;
      // 3本の OR をそれぞれ `user_settings_*_idx`（`*_enabled = 1` の部分インデックス）で引かせる。
      // 部分インデックスの条件と突き合わせられるよう、`= 1` はバインド変数でなくリテラルで書く
      const enabled = (column: AnyColumn) => sql`${column} = 1`;
      return db
        .select({
          userId: userSettings.userId,
          timezone: userSettings.timezone,
          morningNotifyEnabled: userSettings.morningNotifyEnabled,
          morningNotifyAt: userSettings.morningNotifyAt,
          eveningNotifyEnabled: userSettings.eveningNotifyEnabled,
          eveningNotifyAt: userSettings.eveningNotifyAt,
          weeklySummaryEnabled: userSettings.weeklySummaryEnabled,
          weeklySummaryAt: userSettings.weeklySummaryAt,
          weekStart: userSettings.weekStart,
        })
        .from(userSettings)
        .where(
          or(
            and(
              enabled(userSettings.morningNotifyEnabled),
              sql`${userSettings.morningNotifyAt} in ${candidates}`,
            ),
            and(
              enabled(userSettings.eveningNotifyEnabled),
              sql`${userSettings.eveningNotifyAt} in ${candidates}`,
            ),
            and(
              enabled(userSettings.weeklySummaryEnabled),
              sql`${userSettings.weeklySummaryAt} in ${candidates}`,
            ),
          ),
        );
    },

    async loadDuties(settings, rangeStart, today, now) {
      // 今日タブ・振り返りと同じ読み込み（D1 の batch で1往復）
      const rows = await loadScheduleInputs(db, {
        users: [
          { userId: settings.userId, timeZone: settings.timezone, weekStart: settings.weekStart },
        ],
        from: rangeStart,
        to: today,
        archivedSince: new Date(now.getTime() - ARCHIVED_LOOKBACK_MS),
      });
      return rows.map(({ duty, schedule }) => ({
        name: duty.name,
        sortOrder: duty.sortOrder,
        schedule,
      }));
    },

    async listSubscriptions(userId) {
      return db
        .select({
          id: pushSubscriptions.id,
          endpoint: pushSubscriptions.endpoint,
          p256dh: pushSubscriptions.p256dh,
          auth: pushSubscriptions.auth,
        })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));
    },

    async deleteSubscription(id) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
    },
  };
}
