"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ token, invalidToken }: { token: string; invalidToken: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (invalidToken) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">リンクが無効です</h1>
        <p className="text-sm text-muted-foreground">
          このリンクは無効か、有効期限が切れています。もう一度パスワード再設定をお試しください。
        </p>
        <Link href="/forgot-password" className="text-sm underline">
          パスワード再設定をやり直す
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("パスワードが一致しません。");
      return;
    }
    setError(null);
    setPending(true);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);
    if (resetError) {
      setError(resetError.message ?? "パスワードの再設定に失敗しました。");
      return;
    }
    router.push("/login");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">新しいパスワードを設定</h1>
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">新しいパスワード</Label>
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

      <div className="space-y-1">
        <Label htmlFor="confirm">新しいパスワード（確認）</Label>
        <Input
          id="confirm"
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "設定中..." : "パスワードを再設定"}
      </Button>
    </form>
  );
}
