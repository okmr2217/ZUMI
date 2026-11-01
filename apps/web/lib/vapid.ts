import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Web Push の VAPID 公開鍵（base64url）。Server Component で読み、購読する
 * Client Component に props で渡す。秘密鍵は apps/notify だけが持つ。
 * 未設定なら null（購読ボタンはエラーを表示する）。
 */
export function getVapidPublicKey() {
  return getCloudflareContext().env.VAPID_PUBLIC_KEY || null;
}
