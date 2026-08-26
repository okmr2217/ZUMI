import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "ZUMI（済）";
const description = "定期的な「やらなきゃ」を、可視化しよう。毎日のことも、月イチのことも。同じ場所で、押すだけ。";

export const metadata: Metadata = {
  metadataBase: new URL("https://zumi.paritto.dev"),
  title,
  description,
  manifest: "/manifest.webmanifest",
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "ZUMI（済）",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#1c1917",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
