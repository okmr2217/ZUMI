import { cache } from "react";
import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@zumi/db/schema";
import { getDb } from "./db";
import { signupGate } from "./signup";
import { sendEmail } from "./email";
import { verificationEmail, resetPasswordEmail, deleteAccountEmail } from "./email-templates";
import { createUserSettings } from "./user-settings";

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
    hooks: { before: signupGate },
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
    advanced: {
      // better-auth の既定は x-forwarded-for だけを見るが、Workers では Cloudflare が
      // 付ける cf-connecting-ip にクライアントの IP が入る。これがないと session.ip_address が
      // 空になり、IP ごとに数える rate limit も全員で1つの枠を共有してしまう。
      // cf-connecting-ip は Cloudflare が上書きするので、クライアントが偽装しても届かない
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    databaseHooks: {
      user: {
        create: {
          // 失敗してもサインアップ（確認メール送信）は止めない。行がなければ
          // アプリを開いたときのタイムゾーン同期（syncUserTimezone）で作り直される。
          after: async (user) => {
            await createUserSettings(user.id).catch((error) => {
              console.error("user_settings の作成に失敗しました", error);
            });
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

/**
 * Server Component / Route Handler からログイン中ユーザーのセッションを取得する。
 * レイアウトとページの両方から呼ばれるため、同じリクエスト内では `cache` で1回にまとめる。
 */
export const getServerSession = cache(async () => {
  return getAuth().api.getSession({ headers: await headers() });
});
