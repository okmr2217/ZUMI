"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Duty の追加・編集、長押しの詳細、設定で共通のシート（docs/04「4-5. シート・モーダルの共通仕様」）。
 * 幅 768px 未満は下から出るドロワー（vaul）、それ以上は中央のモーダル（Radix Dialog）で開く。
 * ヘッダー（タイトルと×）は固定し、中身は `SheetBody`（スクロールする）と `SheetFooter`（固定）で組む。
 *
 * 入力途中の中身は `useSheetDirty(true)` を呼ぶ。その間はスワイプで閉じず、×・暗幕・Esc では破棄の確認を出す。
 * 中身はシートが開くたびにマウントし直されるので、前回の入力は残らない。
 */
export function ResponsiveSheet({
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
  // 開いている間は切り替えない。ドロワーとモーダルは別の木なので、切り替えると中身がマウントし直されて入力が消える
  const liveDesktop = useIsDesktop();
  const [openedDesktop, setOpenedDesktop] = useState(liveDesktop);
  if (!open && openedDesktop !== liveDesktop) setOpenedDesktop(liveDesktop);
  const isDesktop = open ? openedDesktop : liveDesktop;

  const [dirty, setDirty] = useState(false);
  // 破棄の確認を出している間の、「破棄する」を押したときの操作
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);
  if (!open && discardAction) setDiscardAction(null);

  function guard(action: () => void) {
    if (dirty) setDiscardAction(() => action);
    else action();
  }
  const requestClose = () => guard(onClose);

  // タイトルはドロワーとモーダルで別の部品（それぞれの Root の中でしか使えない）
  const content = (Title: typeof Dialog.Title | typeof Drawer.Title) => (
    <SheetContext.Provider value={{ setDirty, guard }}>
      {discardAction && (
        <DiscardConfirm
          onKeep={() => setDiscardAction(null)}
          onDiscard={() => {
            setDiscardAction(null);
            discardAction();
          }}
        />
      )}
      <div className="shrink-0 px-[22px] pb-[18px] pt-4 md:pt-5">
        {!isDesktop && (
          <div aria-hidden className="mx-auto -mt-1.5 mb-2.5 h-1 w-9 rounded-full bg-zumi-line" />
        )}
        <div className="flex items-center justify-between gap-3">
          <Title className="min-w-0 truncate text-[17px] font-bold">{title}</Title>
          <button
            type="button"
            onClick={requestClose}
            aria-label="閉じる"
            className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-zumi-card text-zumi-soft"
          >
            <X className="size-3.5" strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      </div>
      {children}
    </SheetContext.Provider>
  );

  const overlay = "fixed inset-0 z-50 bg-[rgba(43,38,32,0.42)]";
  const panel = "z-50 flex flex-col bg-zumi-bg font-zumi text-zumi-ink outline-none";

  if (isDesktop) {
    return (
      <Dialog.Root open={open} onOpenChange={(next) => !next && requestClose()}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={cn(
              overlay,
              "data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in",
            )}
          />
          <Dialog.Content
            aria-describedby={undefined}
            className={cn(
              panel,
              "fixed left-1/2 top-1/2 max-h-[90dvh] w-[calc(100%-32px)] max-w-[430px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[26px] shadow-[0_10px_40px_rgba(30,26,20,.25)]",
              "data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in",
            )}
          >
            {content(Dialog.Title)}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => !next && requestClose()}
      // 入力途中はスワイプ・暗幕・Esc で閉じない。暗幕と Esc は下の Content で破棄の確認に回す
      dismissible={!dirty}
    >
      <Drawer.Portal>
        <Drawer.Overlay className={overlay} />
        <Drawer.Content
          aria-describedby={undefined}
          onPointerDownOutside={() => dirty && requestClose()}
          onEscapeKeyDown={() => dirty && requestClose()}
          className={cn(
            panel,
            "fixed inset-x-0 bottom-0 mx-auto max-h-[94dvh] w-full max-w-[430px] rounded-t-[26px] shadow-[0_-10px_40px_rgba(30,26,20,.25)]",
          )}
        >
          {content(Drawer.Title)}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** スクロールする本文。フッターがないシートでは、下端にホームバーぶんの余白を取る */
export function SheetBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto overscroll-contain px-[22px] pb-4 last:pb-[calc(26px+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 固定のフッター（確定ボタン）。フォームの外に置くので、送信ボタンには `form` 属性でフォームを指す */
export function SheetFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-2.5 border-t border-zumi-line px-[22px] pb-[calc(22px+env(safe-area-inset-bottom))] pt-3.5">
      {children}
    </div>
  );
}

const SheetContext = createContext<{
  setDirty: (dirty: boolean) => void;
  guard: (action: () => void) => void;
}>({ setDirty: () => {}, guard: (action) => action() });

/**
 * シートの中身が開いた時点から変わっているかを伝える。変わっていれば、閉じる前に破棄の確認を出す。
 * 返す関数は、シートの外へ移る操作（リンクなど）を同じ確認にかける
 */
export function useSheetDirty(dirty: boolean) {
  const { setDirty, guard } = useContext(SheetContext);
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  return guard;
}

/**
 * 最後に渡された null でない値を返す。シートを閉じるとき、呼び出し側が対象を null に戻しても、
 * 閉じるアニメーションの間は中身を出したままにするために使う。
 */
export function useRetained<T>(value: T | null): T | null {
  const [retained, setRetained] = useState(value);
  if (value !== null && value !== retained) setRetained(value);
  return value ?? retained;
}

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// サーバーと初回の描画はスマホ（ドロワー）として扱う
function useIsDesktop() {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

function DiscardConfirm({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keepRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-labelledby="sheet-discard-title"
      className="absolute inset-x-0 bottom-0 z-10 rounded-t-[22px] border-t border-zumi-line bg-zumi-card px-[22px] pb-[calc(22px+env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_24px_rgba(30,26,20,.12)]"
    >
      <p id="sheet-discard-title" className="text-[13.5px] font-semibold">
        編集内容を破棄しますか？
      </p>
      <p className="mt-1 text-[11.5px] text-zumi-soft">入力した内容は保存されません。</p>
      <div className="mt-3 flex gap-2.5">
        <button
          ref={keepRef}
          type="button"
          onClick={onKeep}
          className="flex-1 rounded-2xl border border-zumi-line bg-zumi-bg p-3 text-[14px] font-bold"
        >
          編集を続ける
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="flex-1 rounded-2xl bg-zumi-shu-deep p-3 text-[14px] font-bold text-white"
        >
          破棄する
        </button>
      </div>
    </div>
  );
}
