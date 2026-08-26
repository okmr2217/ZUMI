import { drizzle } from "drizzle-orm/d1";
import * as schema from "@zumi/db/schema";

export interface Env {
  DB: D1Database;
  NEXT_PUBLIC_APP_ENV: string;
  SENTRY_DSN?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
}

export default {
  /**
   * 毎分起動（wrangler.toml の `[triggers] crons`）。
   * user_settings を timezone + 各 notify_at で絞り込み、現在時刻（UTC）を
   * 各ユーザーのタイムゾームに変換した上で一致するユーザーだけに配信する。
   * 期日計算は packages/types の純粋関数を web と共有し、判定のズレを防ぐ
   * （フェーズ4で実装。現時点は起動確認のみ）。
   */
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    const db = drizzle(env.DB, { schema });
    void db; // フェーズ4で対象ユーザー抽出クエリを実装する
    console.log("zumi-notify: scheduled tick", new Date().toISOString());
  },
};
