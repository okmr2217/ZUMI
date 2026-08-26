# @zumi/db

Drizzle スキーマ・マイグレーション置き場。`apps/web` と `apps/notify` の両方から
`@zumi/db` として参照する（詳細は `docs/05-tech-stack.md`）。

## ローカル D1 セットアップ

```bash
# マイグレーション SQL を生成（schema.ts 変更後に実行）
npm run db:generate

# ローカル D1（Miniflare, .wrangler/state 配下）にマイグレーションを適用
npm run db:migrate:local

# better-auth のテーブルは別途 better-auth CLI で生成 or 上記マイグレーションに含める
# (フェーズ1で apps/web/lib/auth.ts の実設定を追加した後に対応)

# 開発用シードデータを投入
npm run db:seed
```

## リモート D1 への反映

実際の D1 データベース作成・`database_id` の取得はアカウント操作が必要なため、
このリポジトリ内では行わない。手順は `docs/05-tech-stack.md` とリポジトリルート
README の「オーナーが手動で行う必要があるタスク」を参照。

```bash
# 例（オーナーが手元で実行）
wrangler d1 create zumi-db
wrangler d1 migrations apply zumi-db --remote
```
