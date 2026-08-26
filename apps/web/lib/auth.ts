import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@zumi/db/schema";
import { getDb } from "./db";
import { sendEmail } from "./email";
import { verificationEmail, resetPasswordEmail, deleteAccountEmail } from "./email-templates";

/**
 * better-auth 設定（メール＋パスワード、Drizzle アダプタ経由で D1 に保存）。
 *
 * D1 バインディング・シークレット類は Cloudflare Workers のリクエストスコープ
 * でのみ取得できるため、`apps/web/lib/db.ts` と同様にリクエストごとに
 * インスタンスを構築する（`getAuth()`）。モジュールスコープでの
 * `betterAuth({...})` 呼び出しは行わない。
 */
export function getAuth() {
  const { env } = getCloudflareContext();

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "【ZUMI】パスワードの再設定",
          html: resetPasswordEmail(url),
        });
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "【ZUMI】メールアドレスの確認",
          html: verificationEmail(url),
        });
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
    },
    user: {
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: async ({ user, url }) => {
          await sendEmail({
            to: user.email,
            subject: "【ZUMI】アカウント削除の確認",
            html: deleteAccountEmail(url),
          });
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    plugins: [nextCookies()],
  });
}

/** Server Component / Route Handler からログイン中ユーザーのセッションを取得する。 */
export async function getServerSession() {
  return getAuth().api.getSession({ headers: await headers() });
}
