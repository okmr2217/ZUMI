"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { unsubscribePush } from "@/lib/push-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    // ログアウトした端末に通知が届き続けないよう、購読を外してからセッションを切る。
    // 失敗してもログアウトは止めない（購読が残っても、次にログインしたユーザーに付け替わる）。
    await unsubscribePush().catch(() => {});
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSignOut}>
      ログアウト
    </Button>
  );
}
