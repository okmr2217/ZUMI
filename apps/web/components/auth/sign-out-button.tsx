"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { unsubscribePush } from "@/lib/push-client";

/** ログアウト。見た目（設定モーダルのアカウント欄の行）は `className` で渡す */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      // ログアウトした端末に通知が届き続けないよう、購読を外してからセッションを切る。
      // 失敗してもログアウトは止めない（購読が残っても、次にログインしたユーザーに付け替わる）。
      await unsubscribePush().catch(() => {});
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch (e) {
      // 通信できなかったときは押し直せるようにする
      console.error(e);
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={handleSignOut} disabled={pending} className={className}>
      {pending ? "ログアウトしています…" : "ログアウト"}
    </button>
  );
}
