"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * 画面下から出るシート（モックの DutyCreate / DutyEdit）。ネイティブの `<dialog>` を
 * モーダルで開き、フォーカスの閉じ込めと Esc での閉じを任せる。背景のタップでも閉じる。
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={(event) => {
        // React は close を親の要素へも伝えるため、中に重ねたシートが閉じたときは無視する
        if (event.target === event.currentTarget) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[94dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[26px] bg-zumi-bg p-0 font-zumi text-zumi-ink shadow-[0_-10px_40px_rgba(30,26,20,.25)] backdrop:bg-[rgba(43,38,32,0.42)]"
    >
      {open && (
        <div className="flex flex-col gap-[18px] px-[22px] pb-[calc(26px+env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="flex size-[30px] items-center justify-center rounded-full bg-zumi-card text-zumi-soft"
            >
              <X className="size-3.5" strokeWidth={1.8} aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
