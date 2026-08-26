import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">ZUMI（済）</h1>
      <p className="text-muted-foreground">
        定期的にやってくる活動をリマインド・記録する。完了操作は「済」の朱印をワンタップ。
      </p>
      <div className="flex gap-3">
        <Link href="/signup" className={cn(buttonVariants())}>
          はじめる
        </Link>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }))}>
          ログイン
        </Link>
      </div>
    </main>
  );
}
