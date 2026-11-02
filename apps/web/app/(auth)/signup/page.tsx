import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { isSignupEnabled } from "@/lib/signup";

// SIGNUP_ENABLED はリクエスト時の Cloudflare env から読むため、ビルド時に静的生成しない。
export const dynamic = "force-dynamic";

export default function SignupPage() {
  if (!isSignupEnabled()) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">新規登録は準備中です</h1>
          <p className="text-sm text-muted-foreground">
            ZUMI
            は現在、公開に向けて準備を進めています。新規登録の受付開始まで、もうしばらくお待ちください。
          </p>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="underline">
            ログイン
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/" className="underline">
            トップページへ戻る
          </Link>
        </p>
      </div>
    );
  }

  return <SignupForm />;
}
