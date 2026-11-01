"use client";

import { useCallback, useEffect, useRef } from "react";

/** 長押しと判定するまでの時間と、指がこれ以上動いたらスクロールとみなす距離 */
const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * 長押しの検出。指・マウスの長押しに加え、右クリックとキーボードのコンテキストメニューでも発火する。
 * 長押しの指を離したときに続く click は、`consumeLongPress()` が true を返すので無視すること。
 */
export function useLongPress(onLongPress: () => void, enabled: boolean) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const fire = useCallback(() => {
    clear();
    fired.current = true;
    onLongPress();
  }, [clear, onLongPress]);

  const handlers: React.HTMLAttributes<HTMLElement> = enabled
    ? {
        onPointerDown(event) {
          fired.current = false;
          if (event.button !== 0) return;
          origin.current = { x: event.clientX, y: event.clientY };
          clear();
          timer.current = window.setTimeout(fire, LONG_PRESS_MS);
        },
        onPointerMove(event) {
          const start = origin.current;
          if (
            start &&
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE_PX
          ) {
            clear();
          }
        },
        onPointerUp: clear,
        onPointerCancel: clear,
        onPointerLeave: clear,
        onContextMenu(event) {
          // Android の長押しでも contextmenu が来るため、タイマーで発火済みなら二重に開かない
          event.preventDefault();
          if (!fired.current) fire();
        },
      }
    : {};

  const consumeLongPress = useCallback(() => {
    const value = fired.current;
    fired.current = false;
    return value;
  }, []);

  return { handlers, consumeLongPress };
}
