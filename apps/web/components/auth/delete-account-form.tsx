"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/** 設定モーダルの「退会」シートの中身。確認メールのリンクを開くと退会が完了する */
export function DeleteAccountForm() {
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
      <p role="status" className="text-[13px] leading-relaxed">
        確認メールを送りました。メール内のリンクを開くと退会が完了します。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed">
        退会すると、登録した
        Duty・記録などすべてのデータが完全に削除されます。この操作は取り消せません。
      </p>
      <p className="text-[12px] leading-relaxed text-zumi-soft">
        登録しているメールアドレスに確認メールを送ります。メール内のリンクを開くと退会が完了します。
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-zumi-pill px-[13px] py-2.5 text-[12.5px] font-semibold"
        >
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="w-full rounded-2xl border-[1.6px] border-zumi-shu-deep p-[13px] text-[14px] font-bold text-zumi-shu-deep disabled:opacity-40"
      >
        {pending ? "送信しています…" : "確認メールを送って退会する"}
      </button>
    </div>
  );
}
