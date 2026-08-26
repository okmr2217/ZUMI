"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirm) {
      setError("新しいパスワードが一致しません。");
      return;
    }
    setPending(true);
    const { error: changeError } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (changeError) {
      setError(changeError.message ?? "パスワードの変更に失敗しました。");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h2 className="text-sm font-semibold">パスワード変更</h2>

      <div className="space-y-1">
        <Label htmlFor="currentPassword">現在のパスワード</Label>
        <Input
          id="currentPassword"
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="newPassword">新しいパスワード</Label>
        <Input
          id="newPassword"
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="confirmNewPassword">新しいパスワード（確認）</Label>
        <Input
          id="confirmNewPassword"
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-muted-foreground">パスワードを変更しました。</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "変更中..." : "パスワードを変更"}
      </Button>
    </form>
  );
}
