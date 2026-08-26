"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function ResendVerificationForm({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleResend() {
    setPending(true);
    await authClient.sendVerificationEmail({
      email,
      callbackURL: "/app",
    });
    setPending(false);
    setSent(true);
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" className="w-full" onClick={handleResend} disabled={pending || !email}>
        {pending ? "送信中..." : "確認メールを再送する"}
      </Button>
      {sent && <p className="text-center text-xs text-muted-foreground">再送しました。メールをご確認ください。</p>}
    </div>
  );
}
