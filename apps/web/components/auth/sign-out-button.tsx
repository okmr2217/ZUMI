"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { unsubscribePush } from "@/lib/push-client";
import { setTimezoneManual } from "@/components/app/timezone-sync";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    // ログアウトした端末に通知が届き続けないよう、購読を外してからセッションを切る。
    // 失敗してもログアウトは止めない（購読が残っても、次にログインしたユーザーに付け替わる）。
    await unsubscribePush().catch(() => {});
    // 手で選んだタイムゾーンの印は端末に残るので、次にログインする人のために消す。
    setTimezoneManual(false);
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
