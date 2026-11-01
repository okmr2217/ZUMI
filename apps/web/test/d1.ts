import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";

const migrationsDir = fileURLToPath(new URL("../../../packages/db/migrations", import.meta.url));

/**
 * テスト用に、永続化しないローカル D1 を起動して migration を当てる。
 * 本番と同じ D1（SQLite）で動かすため、wrangler の `getPlatformProxy` を使う。
 */
export async function createTestD1() {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: fileURLToPath(new URL("../wrangler.toml", import.meta.url)),
    persist: false,
  });
  const db = proxy.env.DB;

  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const statements = readFileSync(`${migrationsDir}/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await db.prepare(statement).run();
    }
  }

  return { db, dispose: () => proxy.dispose() };
}

/** `user` と `user_settings` の行を作る（サインアップ時のフックと同じ状態）。 */
export async function insertTestUser(db: D1Database, id: string) {
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(id, id, `${id}@example.com`, now, now)
    .run();
  await db
    .prepare("INSERT INTO user_settings (id, user_id) VALUES (?, ?)")
    .bind(`settings-${id}`, id)
    .run();
}
