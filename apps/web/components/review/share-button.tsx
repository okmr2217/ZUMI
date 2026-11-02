"use client";

import { useRef, useState } from "react";
import { Share2 } from "lucide-react";

type ShareState = "idle" | "preparing" | "ready" | "error";

const LABELS: Record<ShareState, string> = {
  idle: "共有",
  preparing: "準備中",
  // 画像の用意に時間がかかり、ブラウザがタップ直後の共有として扱わなかったとき
  ready: "共有する",
  error: "もう一度",
};

/**
 * 週次サマリーのシェアボタン（モック `ReviewSummary` の「共有」チップ）。
 * 画像を発行して取り寄せ、Web Share API で画像ファイルとして渡す。ファイルを共有できない環境ではダウンロードする。
 */
export function ShareButton({ week }: { week: string }) {
  const [state, setState] = useState<ShareState>("idle");
  const fileRef = useRef<{ week: string; file: File } | null>(null);

  async function prepareFile(): Promise<File> {
    if (fileRef.current?.week === week) return fileRef.current.file;
    const issued = await fetch("/api/review/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week }),
    });
    if (!issued.ok) throw new Error(`share token: ${issued.status}`);
    const { imageUrl } = (await issued.json()) as { imageUrl: string };
    const image = await fetch(imageUrl);
    if (!image.ok) throw new Error(`share image: ${image.status}`);
    const file = new File([await image.blob()], `zumi-${week}.png`, { type: "image/png" });
    fileRef.current = { week, file };
    return file;
  }

  async function handleClick() {
    if (state === "preparing") return;
    setState("preparing");
    let file: File;
    try {
      file = await prepareFile();
    } catch {
      setState("error");
      return;
    }

    if (!navigator.canShare?.({ files: [file] })) {
      download(file);
      setState("idle");
      return;
    }
    try {
      await navigator.share({ files: [file] });
      setState("idle");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setState("idle");
      } else if (error instanceof DOMException && error.name === "NotAllowedError") {
        // 取り寄せている間にタップの扱いが切れた（iOS の Safari など）。次のタップですぐ共有する
        setState("ready");
      } else {
        download(file);
        setState("idle");
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "preparing"}
      aria-label="週次サマリーを画像で共有"
      className="bg-zumi-shu-bg text-zumi-shu ml-1 inline-flex items-center gap-[5px] rounded-[20px] px-[11px] py-[5px] text-[11.5px] font-bold disabled:opacity-60"
    >
      <Share2 className="size-[13px]" strokeWidth={1.7} aria-hidden />
      <span aria-live="polite">{LABELS[state]}</span>
    </button>
  );
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // クリック直後に解放すると、ブラウザによってはダウンロードが始まらない
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
