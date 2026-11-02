import { getDb } from "@/lib/db";
import { loadShareCard } from "@/lib/share";
import { renderShareImage } from "@/lib/share-image";

export const dynamic = "force-dynamic";

/**
 * シェア画像の PNG（docs/05「リポジトリ構成」の OG エンドポイント）。ログインは要らない。
 * トークンを知っている人だけが開ける。描くのは発行した時点で固定したサマリー（lib/share.ts）。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const card = await loadShareCard(getDb(), token);
  if (!card) return new Response("Not Found", { status: 404 });
  return renderShareImage(card, token);
}
