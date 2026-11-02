import type { Metadata } from "next";
import { ErrorScreen } from "@/components/app/error-screen";

export const metadata: Metadata = {
  title: "ページが見つかりません — ZUMI（済）",
};

/** 404。ログインしていなければ、今日の画面へのリンクは proxy がログイン画面へ送る */
export default function NotFound() {
  return (
    <ErrorScreen
      title="ページが見つかりません"
      description="URL が間違っているか、ページが移動・削除された可能性があります。"
      primary={{ label: "今日の画面へ", href: "/app" }}
      secondary={{ label: "ZUMI のトップへ", href: "/" }}
    />
  );
}
