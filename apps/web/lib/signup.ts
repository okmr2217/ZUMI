import { getCloudflareContext } from "@opennextjs/cloudflare";
import { APIError, createAuthMiddleware } from "better-auth/api";

/**
 * 公開前のサインアップ制限（docs/05-tech-stack.md「ドメイン構成」）。
 *
 * `SIGNUP_ENABLED` がちょうど `"true"` のときだけ開く。未設定・typo・空文字は
 * すべて閉じる側に倒し、設定漏れで本番のサインアップが開いてしまうことを防ぐ。
 * ローカル開発では `apps/web/.dev.vars` に `SIGNUP_ENABLED=true` を書いて開ける。
 */
export function isSignupEnabled(): boolean {
  return getCloudflareContext().env.SIGNUP_ENABLED === "true";
}

/**
 * better-auth の `hooks.before`。閉じている間は `/sign-up/email` を 403 で拒否する。
 * ルーティング後の正規化されたパス（`ctx.path`）で判定するため、URL の表記揺れで
 * すり抜けられず、`auth.api.signUpEmail` をサーバーから直接呼んだ場合も止まる。
 */
export const signupGate = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/sign-up/email" && !isSignupEnabled()) {
    throw new APIError("FORBIDDEN", {
      code: "SIGNUP_DISABLED",
      message: "現在、新規登録の受付を停止しています。",
    });
  }
});
