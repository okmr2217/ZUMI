import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@zumi/db/schema";

/**
 * Cloudflare Workers の D1 バインディング（wrangler.toml の `DB`）から
 * Drizzle クライアントを取得する。Route Handler / Server Component から
 * `const db = getDb()` で使う。
 */
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

// サーバー起動時に一度だけ解決したい箇所向けの遅延シングルトン。
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof getDb>];
  },
});
