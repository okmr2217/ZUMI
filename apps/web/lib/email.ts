import { getCloudflareContext } from "@opennextjs/cloudflare";

const FROM_ADDRESS = "ZUMI（済） <noreply@paritto.dev>";

/**
 * Resend 経由でメールを送信する。認証フロー（確認メール・パスワードリセット・
 * 退会確認）専用。通知配信用のメール送信は apps/notify 側で別途扱う。
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const { env } = getCloudflareContext();

  // ローカルと E2E ではキーを空にしておき、外部に出さない（本文は確認リンクを含むため出さない）
  if (!env.RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY が未設定のためメールを送りません: to=${to} subject=${subject}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend へのメール送信に失敗しました (${res.status}): ${body}`);
  }
}
