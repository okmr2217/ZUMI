import Link from "next/link";

/**
 * 利用規約・プライバシーポリシーの共通の組み版。LP のトーン（生成り地・朱色一色・事務的）に合わせ、
 * 本文は読みやすさを優先して 15px・行間広めの1段組にする。
 */

/**
 * 運営者情報。リリース前にオーナーが埋める（null のあいだは目立つプレースホルダーを出す）。
 * 規約・ポリシーの両方がここを参照するので、差し替えはこの1か所で済む。
 */
const OPERATOR: { name: string | null; email: string | null } = {
  name: null,
  email: null,
};

/** 制定日。改定したら「改定日」を足す */
export const LEGAL_ENACTED_AT = "2026年11月";

export function LegalDocument({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zumi-bg font-zumi text-zumi-ink">
      <header className="border-b border-zumi-line">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-5 py-4">
          <Link href="/" className="text-[15px] font-black tracking-[.04em] no-underline">
            ZUMI<span className="text-zumi-shu">（済）</span>
          </Link>
          <Link href="/app" className="text-[12.5px] font-bold text-zumi-soft">
            アプリを開く
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 pb-16 pt-10 text-[15px] leading-[1.95] [overflow-wrap:anywhere]">
        <h1 className="text-[26px] font-black tracking-[.02em]">{title}</h1>
        <div className="mt-4 h-[3px] w-10 bg-zumi-shu" aria-hidden />
        <p className="mt-4 text-[13px] text-zumi-soft">{LEGAL_ENACTED_AT} 制定</p>
        <div className="mt-8 flex flex-col gap-9">{children}</div>
      </main>

      <footer className="border-t border-zumi-line">
        <nav className="mx-auto flex max-w-[720px] flex-wrap gap-x-5 gap-y-2 px-5 pb-10 pt-6 text-[13px] text-zumi-soft">
          <Link href="/" className="hover:text-zumi-shu">
            トップ
          </Link>
          <Link href="/terms" className="hover:text-zumi-shu">
            利用規約
          </Link>
          <Link href="/privacy" className="hover:text-zumi-shu">
            プライバシーポリシー
          </Link>
        </nav>
      </footer>
    </div>
  );
}

/** 条・節の見出しと本文 */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-l-[3px] border-zumi-shu pl-3 text-[17px] font-bold leading-[1.6]">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** 番号付きの項。`<li>` を並べる */
export function LegalList({ children }: { children: React.ReactNode }) {
  return <ol className="flex list-decimal flex-col gap-2 pl-6">{children}</ol>;
}

/** 箇条書き（番号なし） */
export function LegalBullets({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-6 marker:text-zumi-shu">{children}</ul>;
}

/** 小見出しと内容の組（取得する情報・送信先の一覧など） */
export function LegalItem({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zumi-line bg-zumi-card px-4 py-3">
      <p className="text-[14.5px] font-bold">{term}</p>
      <div className="mt-1 flex flex-col gap-1.5 text-[14px] leading-[1.85]">{children}</div>
    </div>
  );
}

/** 未定の値。オーナーが埋めるまで、本文中で目立つように出す */
function Placeholder({ children }: { children: string }) {
  return (
    <mark className="rounded bg-zumi-shu-bg px-1 font-bold text-zumi-shu-deep">【{children}】</mark>
  );
}

export function OperatorName() {
  return OPERATOR.name ?? <Placeholder>運営者名</Placeholder>;
}

export function ContactEmail() {
  if (!OPERATOR.email) return <Placeholder>連絡先メールアドレス</Placeholder>;
  return (
    <a href={`mailto:${OPERATOR.email}`} className="text-zumi-shu-deep underline">
      {OPERATOR.email}
    </a>
  );
}
