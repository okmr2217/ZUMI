import Image from "next/image";
import Link from "next/link";

// 高さは svh（アドレスバーが出ている状態の高さ）にする。dvh だとスクロールでバーが縮むたびに中央寄せがずれる
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-8">
      <Link href="/" className="flex items-center gap-2.5 no-underline">
        {/* Workers では画像の最適化を使わないため、public のアイコンをそのまま出す */}
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={40}
          height={40}
          unoptimized
          preload
          className="rounded-[10px]"
        />
        <span className="text-[22px] font-black tracking-[.04em]">ZUMI</span>
      </Link>
      <div className="w-full max-w-sm space-y-6">{children}</div>
    </main>
  );
}
