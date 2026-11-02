/** 各タブ上部の見出し行（モックのトップバー: padding 26px 22px 4px、タイトル 22px / 700） */
export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between px-[22px] pb-1 pt-[26px]">
      <h1 className="text-[22px] font-bold">{title}</h1>
      {action}
    </header>
  );
}
