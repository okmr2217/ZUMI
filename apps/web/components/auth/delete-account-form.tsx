"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function DeleteAccountForm() {
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    const { error: deleteError } = await authClient.deleteUser({
      callbackURL: "/",
    });
    setPending(false);
    if (deleteError) {
      setError(deleteError.message ?? "退会処理に失敗しました。");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        確認メールを送信しました。メール内のリンクを開くと退会が完了します。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-destructive">退会</h2>
      <p className="text-sm text-muted-foreground">
        退会すると、登録した Duty・記録などすべてのデータが完全に削除されます。この操作は取り消せません。
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {confirming ? (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
            キャンセル
          </Button>
          <Button
            size="sm"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? "送信中..." : "本当に退会する"}
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
          退会する
        </Button>
      )}
    </div>
  );
}
