"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesColumn, Sun, Text, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean }[] =
  [
    {
      href: "/app",
      label: "今日",
      icon: Sun,
      // 設定は今日タブの歯車から開くため、今日タブの一部として扱う
      match: (path) => path === "/app" || path.startsWith("/app/settings"),
    },
    {
      href: "/app/review",
      label: "振り返り",
      icon: ChartNoAxesColumn,
      match: (path) => path.startsWith("/app/review"),
    },
    {
      href: "/app/duties",
      label: "Duty",
      icon: Text,
      match: (path) => path.startsWith("/app/duties"),
    },
  ];

/**
 * 下部タブ（docs/04-screens.md「4. 画面構成」）。高さはモックの 66px + セーフエリア。
 *
 * iOS のホーム画面アプリでは、ビューポートの下端がホームインジケーターの上で切れるのに
 * safe-area-inset-bottom は残るため、セーフエリアぶんの余白がバーの下にもう一度空いて背景が見える。
 * そこでバーをその分だけ下へずらし、それでも残る隙間は下に敷いたタブの地の色で埋める
 */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zumi-line bg-zumi-card pb-[max(12px,env(safe-area-inset-bottom))] after:absolute after:inset-x-0 after:top-full after:h-[100px] after:bg-zumi-card after:content-[''] ios-standalone:bottom-[calc(-1*env(safe-area-inset-bottom))]">
      <ul className="mx-auto flex h-[66px] max-w-[430px] items-center justify-around">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-16 flex-col items-center gap-1 py-1 text-[10px]",
                  active ? "font-bold text-zumi-shu" : "text-zumi-soft",
                )}
              >
                <Icon className="size-5" strokeWidth={1.8} aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
