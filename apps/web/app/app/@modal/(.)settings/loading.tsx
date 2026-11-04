/** 設定の中身を読み込んでいる間、シートの中に出す仮の中身（並びは通知 → 表示 → アカウント） */
export default function SettingsModalLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="読み込み中" className="flex flex-col gap-4">
      {[3, 1, 3].map((rows, group) => (
        <section key={group} className="flex flex-col gap-2">
          <div className="h-3 w-14 rounded bg-zumi-pill" />
          <div className="overflow-hidden rounded-2xl border border-zumi-line bg-zumi-card">
            {Array.from({ length: rows }, (_, row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-3 border-b border-zumi-line px-[15px] py-3 last:border-b-0"
              >
                <div className="h-3.5 w-28 animate-pulse rounded bg-zumi-pill" />
                <div className="h-6 w-14 animate-pulse rounded-full bg-zumi-pill" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
