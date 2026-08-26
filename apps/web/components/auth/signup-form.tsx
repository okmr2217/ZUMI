"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("利用規約・プライバシーポリシーへの同意が必要です。");
      return;
    }
    setError(null);
    setPending(true);
    const { error: signUpError } = await authClient.signUp.email({
      name: name || email.split("@")[0] || email,
      email,
      password,
      callbackURL: "/app",
    });
    setPending(false);
    if (signUpError) {
      setError(signUpError.message ?? "登録に失敗しました。");
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">アカウント作成</h1>
        <p className="text-sm text-muted-foreground">メールアドレスとパスワードで登録します。</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="name">名前</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
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
        <Label htmlFor="password">パスワード</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <Label htmlFor="agree" className="font-normal">
          <Link href="/terms" className="underline" target="_blank">
            利用規約
          </Link>
          と
          <Link href="/privacy" className="underline" target="_blank">
            プライバシーポリシー
          </Link>
          に同意します
        </Label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "登録中..." : "登録する"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="underline">
          ログイン
        </Link>
      </p>
    </form>
  );
}
