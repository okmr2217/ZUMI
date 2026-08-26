import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

// `getCloudflareContext` はリクエストスコープでのみ使えるため、
// `/app` 配下は静的プリレンダリング対象から外す。
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link href="/app" className="font-semibold">
          ZUMI（済）
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/app/settings" className="text-sm text-muted-foreground">
            設定
          </Link>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
