import { defineConfig } from "drizzle-kit";

/**
 * `npm run db:generate` でマイグレーション SQL を生成する。
 * D1 への適用は `wrangler d1 migrations apply` を使うため、dbCredentials は
 * ローカル生成専用（driver: "d1-http" 等は使わずファイルベースで完結させる）。
 */
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_D1_TOKEN ?? "",
  },
});
