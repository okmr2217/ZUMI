import type { LogInput } from "@/lib/log-input";

/** 記録 API の呼び出し（ブラウザ側）。失敗時はエラーコードを返し、文言は画面側で決める */
export type LogApiResult = { ok: true } | { ok: false; error: string };

async function send(url: string, method: "PUT" | "DELETE", body?: unknown): Promise<LogApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data: unknown = await res.json().catch(() => null);
    const error =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "unknown";
    return { ok: false, error };
  } catch {
    return { ok: false, error: "network" };
  }
}

const logUrl = (dutyId: string, date: string) =>
  `/api/duties/${encodeURIComponent(dutyId)}/logs/${date}`;

/** `LogInput` は送信前の形（`note` の空文字は API 側で null にする） */
export const recordLogRequest = (dutyId: string, date: string, input: LogInput) =>
  send(logUrl(dutyId, date), "PUT", input);

export const deleteLogRequest = (dutyId: string, date: string) =>
  send(logUrl(dutyId, date), "DELETE");

export function logErrorMessage(error: string): string {
  switch (error) {
    case "already_logged":
      return "その日にはすでに記録があります。";
    case "invalid_date":
      return "記録できるのは、作成した日から今日までです。";
    case "not_found":
    case "invalid_state":
      return "この Duty の状態が変わっています。画面を読み込み直してください。";
    case "network":
      return "通信できませんでした。電波の良いところでもう一度お試しください。";
    default:
      return "記録できませんでした。時間をおいてもう一度お試しください。";
  }
}
