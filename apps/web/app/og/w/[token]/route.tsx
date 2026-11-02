import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { isShareToken, loadShareCard, shareImagePath } from "@/lib/share";
import { renderShareImage } from "@/lib/share-image";

export const dynamic = "force-dynamic";

/** Workers のエッジキャッシュ。`next dev`（Node）には `caches` が無いので undefined */
function edgeCache(): Cache | undefined {
  if (typeof caches === "undefined") return undefined;
  // tsconfig の lib に dom があり、`caches` の型がブラウザの CacheStorage（`default` が無い）になるため
  return (caches as unknown as { default?: Cache }).default;
}

/**
 * シェア画像の PNG（docs/05「リポジトリ構成」の OG エンドポイント）。ログインは要らない。
 * トークンを知っている人だけが開ける。描くのは発行した時点で固定したサマリー（lib/share.ts）。
 *
 * 拡散されたときに毎回 Satori の描画とフォント取得が走らないよう、`caches.default` に入れる
 * （docs/03「シェア画像の運用」）。入れるのはフォントがそろった画像だけで、404 も入れない。
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isShareToken(token)) return new Response("Not Found", { status: 404 });

  const cache = edgeCache();
  // クエリ文字列は鍵に含めない（付け替えてキャッシュを素通りさせられないように）
  const cacheKey = new Request(new URL(shareImagePath(token), request.url));
  const cached = await cache?.match(cacheKey);
  if (cached) return cached;

  const card = await loadShareCard(getDb(), token);
  if (!card) return new Response("Not Found", { status: 404 });
  const { image, complete } = await renderShareImage(card, token);
  if (cache && complete) {
    getCloudflareContext().ctx.waitUntil(cache.put(cacheKey, image.clone()));
  }
  return image;
}
