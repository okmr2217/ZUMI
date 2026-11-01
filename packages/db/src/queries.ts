import { getTableName, sql } from "drizzle-orm";
import { duties, logs } from "./schema";

/**
 * web・notify で共有するクエリの部品。期日計算の入力を読むクエリが両者でずれると、
 * 「通知は来たのに画面に出ていない」不整合になるため、同じ部品を使う。
 */

/**
 * 相関サブクエリから外側の `duties.id` を指す参照。drizzle は単一テーブルの select 句で
 * 列名からテーブル名を省くため、`${duties.id}` のままだと内側の `logs.id` と解決されてしまう
 */
const OUTER_DUTY_ID = sql`${sql.identifier(getTableName(duties))}.${sql.identifier(duties.id.name)}`;

/**
 * `before` より前の最新の DONE の対象日（なければ null）。`duties` を from にした select の列に使う。
 * `SINCE_LAST` の期日計算は、読み込んだ期間より前の前回 DONE が欠けると「DONE が1件もない」とみなすため、
 * 期間のログと合わせてこれも読む（`DutyScheduleInput.logs`）。
 * Duty ごとに (duty_id, target_date) のインデックスを新しい順にたどり、最初の DONE だけを読む。
 */
export const lastDoneBefore = (before: string) =>
  sql<string | null>`(
    select ${logs.targetDate} from ${logs}
    where ${logs.dutyId} = ${OUTER_DUTY_ID}
      and ${logs.status} = 'DONE'
      and ${logs.targetDate} < ${before}
    order by ${logs.targetDate} desc
    limit 1
  )`;
