// ローカル開発用: ローカル D1 に保存された購読へ、テスト通知を送る。
//
//   npm run push:test --workspace=@zumi/web                     # 全員の購読へ
//   npm run push:test --workspace=@zumi/web -- you@example.com  # そのユーザーの購読へ
//   npm run push:test --workspace=@zumi/web -- you@example.com /app/settings  # タップ先を指定
//
// `next dev` と同じローカル D1（apps/web/.wrangler/state）と `.dev.vars` の VAPID 鍵を読む。
// 本番の D1 には接続しない（getPlatformProxy はローカルのシミュレーターだけを使う）。
// 本番の送信は apps/notify の担当。
import webpush from "web-push";
import { getPlatformProxy } from "wrangler";

const [email, url = "/app"] = process.argv.slice(2);
const proxy = await getPlatformProxy();

try {
  const { DB, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = proxy.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error(
      "apps/web/.dev.vars に VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY を設定してください",
    );
  }
  webpush.setVapidDetails(
    VAPID_SUBJECT || "https://zumi.paritto.dev",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );

  const query = email
    ? DB.prepare(
        "SELECT s.id, s.endpoint, s.p256dh, s.auth, u.email FROM push_subscriptions s JOIN user u ON u.id = s.user_id WHERE u.email = ?",
      ).bind(email)
    : DB.prepare(
        "SELECT s.id, s.endpoint, s.p256dh, s.auth, u.email FROM push_subscriptions s JOIN user u ON u.id = s.user_id",
      );
  const { results } = await query.all();
  if (results.length === 0) console.log("購読が見つかりません");

  const payload = JSON.stringify({
    title: "今日の Duty 3件",
    body: "ゴミ出し（可燃）・プロテイン・お風呂（そろそろ）",
    url,
    tag: "zumi-test",
  });

  for (const row of results) {
    try {
      const res = await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
      );
      console.log(`送信しました: ${row.email} (${res.statusCode})`);
    } catch (error) {
      // 404/410 は購読が無効になったという意味なので、行を消す（notify でも同じ扱いにする）。
      if (error.statusCode === 404 || error.statusCode === 410) {
        await DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(row.id).run();
        console.log(`無効な購読を削除しました: ${row.email} (${error.statusCode})`);
      } else {
        console.error(`送信に失敗しました: ${row.email}`, error.statusCode ?? error);
      }
    }
  }
} finally {
  await proxy.dispose();
}
