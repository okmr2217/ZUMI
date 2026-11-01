import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { userSettings } from "@zumi/db/schema";
import { getDb } from "./db";
import { notificationSettingsFields } from "./notification-settings";
import { DEFAULT_EVENING_AT, DEFAULT_MORNING_AT } from "./notification-defaults";

/**
 * オンボーディングのステップ2（通知の時刻・週の始まり）で送る値。飛ばしたときは空で送る。
 * タイムゾーンは送らない（`TimezoneSync` がブラウザの値で別に保存する）。
 */
export const onboardingInputSchema = notificationSettingsFields
  .omit({ timezone: true })
  .extend({ weekStart: z.union([z.literal(0), z.literal(1)]) })
  .partial()
  .strict();

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;

/** `onboardedAt` が null（行がない場合も含む）なら、`/app` からオンボーディングへ送る。 */
export async function needsOnboarding(userId: string) {
  const row = await getDb()
    .select({ onboardedAt: userSettings.onboardedAt })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .get();
  return !row?.onboardedAt;
}

/**
 * ステップ2の値を保存し、`onboardedAt` を記録する。記録済みなら最初の日時を残す
 * （オンボーディングを開き直して保存しても、完了日時は変わらない）。
 * 時刻を送らずに通知を ON にしたときは、未設定の時刻だけ初期値で埋める（notify は時刻が null の行を送れない）。
 */
export async function completeOnboarding(userId: string, input: OnboardingInput, now: Date) {
  const { morningNotifyAt, eveningNotifyAt, ...rest } = input;
  const fill = (enabled: boolean | undefined, value: string | undefined, fallback: string) =>
    value ?? (enabled ? fallback : undefined);

  const insertValues = {
    ...rest,
    morningNotifyAt: fill(input.morningNotifyEnabled, morningNotifyAt, DEFAULT_MORNING_AT),
    eveningNotifyAt: fill(input.eveningNotifyEnabled, eveningNotifyAt, DEFAULT_EVENING_AT),
  };

  const set: Record<string, unknown> = {
    ...rest,
    onboardedAt: sql`coalesce(${userSettings.onboardedAt}, ${Math.floor(now.getTime() / 1000)})`,
  };
  if (morningNotifyAt) set.morningNotifyAt = morningNotifyAt;
  else if (input.morningNotifyEnabled)
    set.morningNotifyAt = sql`coalesce(${userSettings.morningNotifyAt}, ${DEFAULT_MORNING_AT})`;
  if (eveningNotifyAt) set.eveningNotifyAt = eveningNotifyAt;
  else if (input.eveningNotifyEnabled)
    set.eveningNotifyAt = sql`coalesce(${userSettings.eveningNotifyAt}, ${DEFAULT_EVENING_AT})`;

  await getDb()
    .insert(userSettings)
    .values({ id: crypto.randomUUID(), userId, ...insertValues, onboardedAt: now })
    .onConflictDoUpdate({ target: userSettings.userId, set });
}
