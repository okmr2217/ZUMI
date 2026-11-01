"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const INPUT =
  "border-zumi-line bg-zumi-card focus:border-zumi-shu w-full rounded-[14px] border px-3.5 py-[11px] text-[14.5px] outline-none";
const LABEL = "text-zumi-soft mb-2 block text-[11.5px] font-bold tracking-[.06em]";

/** 設定モーダルの「パスワード変更」シートの中身。変更すると他の端末のセッションは切れる */
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="currentPassword" className={LABEL}>
          現在のパスワード
        </label>
        <input
          id="currentPassword"
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="newPassword" className={LABEL}>
          新しいパスワード（8文字以上）
        </label>
        <input
          id="newPassword"
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="confirmNewPassword" className={LABEL}>
          新しいパスワード（確認）
        </label>
        <input
          id="confirmNewPassword"
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className={INPUT}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="bg-zumi-pill rounded-xl px-[13px] py-2.5 text-[12.5px] font-semibold"
        >
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-zumi-soft text-[12.5px]">
          パスワードを変更しました。他の端末ではログインし直してください。
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-zumi-shu w-full rounded-2xl p-[15px] text-[15px] font-bold text-white disabled:opacity-40"
      >
        {pending ? "変更しています…" : "パスワードを変更する"}
      </button>
    </form>
  );
}
