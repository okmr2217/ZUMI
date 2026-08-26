import { getServerSession } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { DeleteAccountForm } from "@/components/auth/delete-account-form";

export default async function SettingsPage() {
  const session = await getServerSession();

  return (
    <main className="mx-auto max-w-sm space-y-8 p-6">
      <h1 className="text-xl font-semibold">設定</h1>

      <section className="space-y-1">
        <h2 className="text-sm font-semibold">アカウント</h2>
        <p className="text-sm text-muted-foreground">{session?.user.email}</p>
      </section>

      <section className="border-t border-border pt-6">
        <ChangePasswordForm />
      </section>

      <section className="border-t border-border pt-6">
        <DeleteAccountForm />
      </section>
    </main>
  );
}
