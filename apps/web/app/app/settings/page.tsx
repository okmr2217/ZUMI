import { getServerSession } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { DeleteAccountForm } from "@/components/auth/delete-account-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationSettingsForm } from "@/components/app/notification-settings-form";
import { getNotificationSettings } from "@/lib/notification-settings";
import { getVapidPublicKey } from "@/lib/vapid";

export default async function SettingsPage() {
  const session = await getServerSession();
  const notificationSettings = session ? await getNotificationSettings(session.user.id) : null;

  return (
    <main className="mx-auto max-w-sm space-y-8 p-6">
      <h1 className="text-xl font-semibold">設定</h1>

      {notificationSettings && (
        <NotificationSettingsForm
          initial={notificationSettings}
          vapidPublicKey={getVapidPublicKey()}
        />
      )}

      <section className="space-y-1">
        <h2 className="text-sm font-semibold">アカウント</h2>
        <p className="text-sm text-muted-foreground">{session?.user.email}</p>
        {/* ヘッダーをタブごとの見出しに置き換えたため、ログアウトはここに置く */}
        <div className="pt-2">
          <SignOutButton />
        </div>
      </section>

      <section className="border-border border-t pt-6">
        <ChangePasswordForm />
      </section>

      <section className="border-border border-t pt-6">
        <DeleteAccountForm />
      </section>
    </main>
  );
}
