import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// 全面的な CSP は Sentry・next/font・Next.js のインラインスクリプトと衝突しやすいため入れず、
// 埋め込みの禁止（frame-ancestors）だけにとどめる。シェア画像（/og/w/:token）は SNS の
// クローラーが直接読むだけで、これらのヘッダーの影響を受けない。
// Worker を通らない静的アセットには public/_headers で同じ値を付ける（値は揃えること）。
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // frame-ancestors を解さない古いブラウザ向け
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 並行する worktree の dev サーバーを `<セッション名>.localhost:<ポート>` で開き分けるため
  // （Cookie はポートで分かれない。CLAUDE.md「ローカルの dev サーバー」）。dev 時のみ効く
  allowedDevOrigins: ["*.localhost"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

// Cloudflare Workers 上でのローカル開発時に `getCloudflareContext` 等が
// 使えるよう、@opennextjs/cloudflare の dev バインディング初期化を行う。
// 本番ビルドには影響しない（dev 時のみ動作）。
initOpenNextCloudflareForDev();

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    // Sentryへアップロード後、ビルド成果物からソースマップを削除する。
    // 削除しないと .open-next/assets 経由で本番サイトから .js.map が
    // 誰でも閲覧できる状態でホスティングされてしまう。
    deleteSourcemapsAfterUpload: true,
  },
});
