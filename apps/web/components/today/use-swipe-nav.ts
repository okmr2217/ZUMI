"use client";

import { useEffect, useRef } from "react";

/** 横スワイプと判定するまでの移動量。縦スクロール・長押し（10px）より大きくして取り違えを避ける */
const START_PX = 12;
/** 横方向が縦方向のこの倍以上動いたときだけ横スワイプとみなす */
const AXIS_RATIO = 1.5;
/** 指を離したとき、この距離を超えていれば移動する */
const COMMIT_PX = 72;
/** 距離が短くても、この速さ（px/ms）で、かつ `FLICK_MIN_PX` 以上動いていれば移動する */
const FLICK_SPEED = 0.5;
const FLICK_MIN_PX = 28;
/** 画面の左右端から、この幅の中で始まった操作は無視する（iOS の「戻る」ジェスチャーと競合するため） */
const EDGE_PX = 24;
/** 指に追従させる最大の移動量 */
const MAX_DRAG_PX = 120;

const ANIM_MS = 140;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 今日タブの本体を左右にスワイプして日付を動かす。
 * - 指（touch）とペンだけ。マウスのドラッグは文字選択と紛らわしいので対象外
 * - 縦スクロールはブラウザに任せる（`touch-action: pan-y` を要素に付ける）。横に動いたと確定してから、初めてポインターを掴む
 * - スワイプの後に続く click（行の押印など）は握りつぶす
 * - ダイアログ（ポータル）内の操作は、要素が `ref` の外にあるので拾わない
 * 戻り値の `dir` は、スワイプ（指の動き）が確定したときの向き。`-1` は前の日、`1` は次の日。
 * 指を右に動かすと前の日の内容が左から出てくる、という「内容を引っ張る」向きにそろえている
 */
export function useSwipeNav(onSwipe: (dir: -1 | 1) => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const onSwipeRef = useRef(onSwipe);
  useEffect(() => {
    onSwipeRef.current = onSwipe;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let start: { id: number; x: number; y: number; t: number } | null = null;
    let dragging = false;
    let suppressClick = false;

    const reset = (animate: boolean) => {
      const from = el.style.transform;
      el.style.transform = "";
      el.style.opacity = "";
      if (animate && from && !reducedMotion()) {
        el.animate([{ transform: from }, { transform: "none" }], {
          duration: ANIM_MS,
          easing: "ease-out",
        });
      }
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      if (!(event.target instanceof Node) || !el.contains(event.target)) return;
      if (event.clientX < EDGE_PX || event.clientX > window.innerWidth - EDGE_PX) return;
      start = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp };
      dragging = false;
    };

    const onMove = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dy) > START_PX && Math.abs(dy) > Math.abs(dx)) {
          start = null; // 縦スクロール
          return;
        }
        if (Math.abs(dx) < START_PX || Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) return;
        dragging = true;
        el.setPointerCapture(event.pointerId);
        // 掴むと、元の行には pointerleave が届き、長押しのタイマー（use-long-press）が止まる
      }
      const shift = Math.max(-MAX_DRAG_PX, Math.min(MAX_DRAG_PX, dx));
      el.style.transform = `translateX(${shift}px)`;
      el.style.opacity = String(1 - Math.abs(shift) / (MAX_DRAG_PX * 3));
    };

    const onUp = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const speed = Math.abs(dx) / Math.max(1, event.timeStamp - start.t);
      const wasDragging = dragging;
      start = null;
      dragging = false;
      if (!wasDragging) return;
      suppressClick = true;
      window.setTimeout(() => (suppressClick = false), 0);
      const commit =
        Math.abs(dx) >= COMMIT_PX || (Math.abs(dx) >= FLICK_MIN_PX && speed >= FLICK_SPEED);
      if (!commit) {
        reset(true);
        return;
      }
      const dir = dx > 0 ? -1 : 1;
      if (reducedMotion()) {
        reset(false);
        onSwipeRef.current(dir);
        return;
      }
      const out = el.animate(
        [
          { transform: el.style.transform, opacity: el.style.opacity || "1" },
          { transform: `translateX(${Math.sign(dx) * 80}px)`, opacity: "0" },
        ],
        { duration: ANIM_MS, easing: "ease-in", fill: "forwards" },
      );
      void out.finished.then(
        () => {
          // 新しい日の内容に差し替わってから、取り除く
          onSwipeRef.current(dir);
          // React の描画が済んでから、新しい日を反対側から滑り込ませる
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              out.cancel();
              reset(false);
              el.animate(
                [
                  { transform: `translateX(${-Math.sign(dx) * 40}px)`, opacity: 0 },
                  { transform: "none", opacity: 1 },
                ],
                { duration: ANIM_MS, easing: "ease-out" },
              );
            }),
          );
        },
        () => reset(false),
      );
    };

    const onCancel = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      const wasDragging = dragging;
      start = null;
      dragging = false;
      if (wasDragging) reset(true);
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [enabled]);

  return ref;
}
