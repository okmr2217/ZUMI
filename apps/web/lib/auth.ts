import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "@zumi/db/schema";

/**
 * better-auth 設定（メール＋パスワード、Drizzle アダプタ経由で D1 に保存）。
 * フェーズ1でメール認証・パスワードリセット等の詳細設定を詰める。
 * `user`/`session`/`account`/`verification` テーブルは
 * packages/db/src/auth-schema.ts で管理し、実設定確定後に
 * `npx @better-auth/cli generate` で再生成する。
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
});
