import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { pushSubscriptions } from "@zumi/db/schema";
import { getDb } from "./db";

const base64Url = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+=*$/);

const endpoint = z
  .string()
  .max(2048)
  .refine((value) => URL.canParse(value) && new URL(value).protocol === "https:");

/** `PushSubscription.toJSON()` の形。 */
export const pushSubscriptionSchema = z.object({
  endpoint,
  keys: z.object({ p256dh: base64Url, auth: base64Url }),
});

export const saveSubscriptionBodySchema = z.object({
  subscription: pushSubscriptionSchema,
  // Service Worker の pushsubscriptionchange から、置き換え前の購読を消すために送る。
  oldEndpoint: endpoint.optional(),
});

export const deleteSubscriptionBodySchema = z.object({ endpoint });

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/**
 * 購読を保存する。`endpoint` はブラウザごとに一意なので、すでにあれば鍵と
 * ユーザーを更新する。別のユーザーの行でも今のユーザーに付け替える: 同じ
 * ブラウザでアカウントを切り替えた場合で、endpoint と鍵はそのブラウザの
 * PushManager からしか得られないため、送ってきた側をこの端末の持ち主とみなす。
 */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionInput,
  oldEndpoint?: string,
) {
  const db = getDb();
  const values = {
    userId,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  };

  await db
    .insert(pushSubscriptions)
    .values({
      id: crypto.randomUUID(),
      endpoint: subscription.endpoint,
      createdAt: new Date(),
      ...values,
    })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });

  if (oldEndpoint && oldEndpoint !== subscription.endpoint) {
    await deletePushSubscription(userId, oldEndpoint);
  }
}

/** 自分の購読だけを消す。他のユーザーの endpoint を指定しても何も消えない。 */
export async function deletePushSubscription(userId: string, endpoint: string) {
  await getDb()
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
}
