import { and, eq, getTableName, gte, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@zumi/db/schema";
import { dutyPauses, duties, logs, pushSubscriptions, userSettings } from "@zumi/db/schema";
import type { DutyLog } from "@zumi/types";
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

/**
 * 相関サブクエリから外側の `duties.id` を指す参照。drizzle は単一テーブルの select 句で
 * 列名からテーブル名を省くため、`${duties.id}` のままだと内側の `logs.id` と解決されてしまう
 */
const OUTER_DUTY_ID = sql`${sql.identifier(getTableName(duties))}.${sql.identifier(duties.id.name)}`;

export function createD1Store(d1: D1Database): NotifyStore {
  const db = drizzle(d1, { schema });

  return {
    async findSettingsAt(localTimes) {
      if (localTimes.length === 0) return [];
      // D1 のバインド変数の上限（100）を避けるため、候補の時刻は JSON 1つで渡す
      const candidates = sql`(select value from json_each(${JSON.stringify(localTimes)}))`;
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
              eq(userSettings.morningNotifyEnabled, true),
              sql`${userSettings.morningNotifyAt} in ${candidates}`,
            ),
            and(
              eq(userSettings.eveningNotifyEnabled, true),
              sql`${userSettings.eveningNotifyAt} in ${candidates}`,
            ),
            and(
              eq(userSettings.weeklySummaryEnabled, true),
              sql`${userSettings.weeklySummaryAt} in ${candidates}`,
            ),
          ),
        );
    },

    async loadDuties(settings, rangeStart, today, now) {
      // 4本とも user_id で絞る。D1 の batch で1往復にまとめる
      const [dutyRows, pauseRows, logRows, lastDoneRows] = await db.batch([
        db
          .select()
          .from(duties)
          .where(
            and(
              eq(duties.userId, settings.userId),
              or(
                isNull(duties.archivedAt),
                gte(duties.archivedAt, new Date(now.getTime() - ARCHIVED_LOOKBACK_MS)),
              ),
            ),
          ),
        db
          .select({
            dutyId: dutyPauses.dutyId,
            startDate: dutyPauses.startDate,
            endDate: dutyPauses.endDate,
          })
          .from(dutyPauses)
          .innerJoin(duties, eq(duties.id, dutyPauses.dutyId))
          .where(eq(duties.userId, settings.userId)),
        db
          .select({ dutyId: logs.dutyId, targetDate: logs.targetDate, status: logs.status })
          .from(logs)
          .where(
            and(
              eq(logs.userId, settings.userId),
              gte(logs.targetDate, rangeStart),
              lte(logs.targetDate, today),
            ),
          ),
        // SINCE_LAST の前回 DONE。Duty ごとに (duty_id, target_date) のインデックスを
        // 新しい順にたどり、最初の DONE だけを読む
        db
          .select({
            dutyId: duties.id,
            targetDate: sql<string | null>`(
              select ${logs.targetDate} from ${logs}
              where ${logs.dutyId} = ${OUTER_DUTY_ID}
                and ${logs.status} = 'DONE'
                and ${logs.targetDate} < ${rangeStart}
              order by ${logs.targetDate} desc
              limit 1
            )`,
          })
          .from(duties)
          .where(and(eq(duties.userId, settings.userId), eq(duties.scheduleType, "SINCE_LAST"))),
      ]);

      return dutyRows.map((duty) => {
        const dutyLogs: Pick<DutyLog, "targetDate" | "status">[] = logRows.filter(
          (log) => log.dutyId === duty.id,
        );
        const lastDone = lastDoneRows.find((row) => row.dutyId === duty.id)?.targetDate;
        if (lastDone) dutyLogs.push({ targetDate: lastDone, status: "DONE" });
        return {
          name: duty.name,
          sortOrder: duty.sortOrder,
          schedule: {
            duty,
            logs: dutyLogs,
            pauses: pauseRows.filter((pause) => pause.dutyId === duty.id),
            timeZone: settings.timezone,
            weekStart: settings.weekStart,
          },
        };
      });
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
