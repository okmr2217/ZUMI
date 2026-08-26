// `wrangler types` で wrangler.toml のバインディングから自動生成できるが、
// フェーズ0時点では手書きしておく。wrangler.toml にバインディングを追加したら
// 都度ここも更新するか、`npx wrangler types` で置き換える。
interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  NEXT_PUBLIC_APP_ENV: string;
}
