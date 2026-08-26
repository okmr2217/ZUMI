import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">メールアドレスを確認してください</h1>
      <p className="text-sm text-muted-foreground">
        {email ? `${email} 宛に` : ""}
        確認メールを送信しました。メール内のリンクを開くとログインできるようになります。
      </p>
      <ResendVerificationForm email={email ?? ""} />
    </div>
  );
}
