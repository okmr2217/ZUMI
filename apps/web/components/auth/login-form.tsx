"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setPending(true);
    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/app",
    });
    setPending(false);
    if (signInError) {
      if (signInError.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
      } else {
        setError(signInError.message ?? "ログインに失敗しました。");
      }
      return;
    }
    router.push("/app");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">ログイン</h1>
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">パスワード</Label>
          <Link href="/forgot-password" className="text-xs underline text-muted-foreground">
            パスワードを忘れた場合
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {needsVerification && (
        <p className="text-sm text-destructive">
          メールアドレスが未確認です。
          <Link href={`/verify-email?email=${encodeURIComponent(email)}`} className="underline">
            確認メールを再送する
          </Link>
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "ログイン中..." : "ログイン"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        アカウントをお持ちでない方は{" "}
        <Link href="/signup" className="underline">
          新規登録
        </Link>
      </p>
    </form>
  );
}
