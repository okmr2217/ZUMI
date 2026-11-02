/**
 * ローカル D1（wrangler d1 execute --local）向けの開発用シードスクリプト。
 * 本番/リモート D1 に対しては実行しない想定。
 *
 * 使い方（先に `npm run db:migrate:local` で migration を当てておく）:
 *   npm run db:seed
 *
 * 何度実行してもよい。前回のシードユーザーは消してから入れ直す（関連する行は外部キーの cascade で消える）。
 *
 * 実体は `wrangler d1 execute zumi-db --local --persist-to ../../apps/web/.wrangler/state --file=...` を
 * 呼び出すラッパー。TypeScript 側で ID 生成や日付計算を行ってから SQL を
 * 組み立てたいケースに備えて tsx スクリプトとして用意している。
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const now = Math.floor(Date.now() / 1000);
const nowMs = Date.now();
const userId = randomUUID();
const dutyId = randomUUID();

const sql = `
DELETE FROM user WHERE email = 'seed@example.com';

INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
VALUES ('${userId}', 'Seed User', 'seed@example.com', 1, ${nowMs}, ${nowMs});

INSERT INTO user_settings (id, user_id, timezone)
VALUES ('${randomUUID()}', '${userId}', 'Asia/Tokyo');

INSERT INTO duties (id, user_id, name, icon, schedule_type, schedule_config, sort_order, status, created_at)
VALUES (
  '${dutyId}',
  '${userId}',
  '燃えるゴミ',
  'trash-2',
  'WEEKDAYS',
  '{"type":"WEEKDAYS","weekdays":[1,4]}',
  0,
  'ACTIVE',
  ${now}
);
`;

const dir = mkdtempSync(join(tmpdir(), "zumi-seed-"));
const file = join(dir, "seed.sql");
writeFileSync(file, sql, "utf8");

// next dev（apps/web）が読むローカル D1 に投入する（migrate:local と同じ置き場所）。
execFileSync(
  "wrangler",
  [
    "d1",
    "execute",
    "zumi-db",
    "--local",
    "--persist-to",
    "../../apps/web/.wrangler/state",
    `--file=${file}`,
  ],
  { stdio: "inherit", cwd: new URL("..", import.meta.url).pathname },
);
