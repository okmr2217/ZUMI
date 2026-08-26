"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setPending(false);
    // メール存在の有無に関わらず同じ表示にする（メールアドレス列挙対策）
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">確認メールを送信しました</h1>
        <p className="text-sm text-muted-foreground">
          {email} 宛にパスワード再設定用のリンクを送信しました。メールをご確認ください。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">パスワードをお忘れの場合</h1>
        <p className="text-sm text-muted-foreground">
          登録済みのメールアドレスに再設定用のリンクを送信します。
        </p>
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

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "送信中..." : "再設定メールを送信"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline">
          ログインに戻る
        </Link>
      </p>
    </form>
  );
}
