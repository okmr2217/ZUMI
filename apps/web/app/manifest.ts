import type { MetadataRoute } from "next";

// iOS で Web Push を受け取るにはホーム画面に追加したスタンドアロン起動が必要なため、
// display は standalone 固定。配色は LP・OGP と同じ生成り地（PAPER）に揃える。
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "ZUMI（済）",
    short_name: "ZUMI",
    description: "定期的にやってくる活動をリマインド・記録する",
    lang: "ja",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#faf6ef",
    theme_color: "#faf6ef",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
