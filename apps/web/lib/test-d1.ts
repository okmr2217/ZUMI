import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@zumi/db/schema";
import { user } from "@zumi/db/schema";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../../packages/db/migrations");

/**
 * テスト用に、Miniflare のインメモリ D1 を立ち上げてマイグレーションを流す。
 * 本番と同じ SQLite（D1）で batch や外部キーの挙動まで確かめるため、モックは使わない。
 */
export async function createTestDb() {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: path.resolve(import.meta.dirname, "../wrangler.toml"),
    persist: false,
  });
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const statements = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await proxy.env.DB.prepare(statement).run();
    }
  }
  const db = drizzle(proxy.env.DB, { schema });

  return {
    db,
    /** D1 のバインディングそのもの（apps/notify の `createD1Store` に渡して突き合わせるため） */
    d1: proxy.env.DB,
    async createUser(id: string) {
      await db.insert(user).values({ id, name: id, email: `${id}@example.com` });
      return id;
    },
    dispose: () => proxy.dispose(),
  };
}
