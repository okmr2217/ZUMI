import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">ZUMI（済）</h1>
      <p className="text-muted-foreground">
        定期的にやってくる活動をリマインド・記録する。完了操作は「済」の朱印をワンタップ。
      </p>
      <Button>はじめる</Button>
    </main>
  );
}
