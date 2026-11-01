import type { DutyInput } from "@/lib/duty-input";

/** Duty API の呼び出し（ブラウザ側）。失敗時はエラーコードを返し、文言は画面側で決める */
export type DutyApiResult = { ok: true } | { ok: false; error: string };

async function send(url: string, method: string, body: unknown): Promise<DutyApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

export const createDutyRequest = (input: DutyInput) => send("/api/duties", "POST", input);

export const updateDutyRequest = (id: string, input: DutyInput) =>
  send(`/api/duties/${encodeURIComponent(id)}`, "PATCH", input);

export const changeDutyStatusRequest = (id: string, action: "pause" | "resume" | "archive") =>
  send(`/api/duties/${encodeURIComponent(id)}/status`, "POST", { action });

export const LIMIT_MESSAGE = "Duty は10件までです。アーカイブすると枠が空きます。";

export function errorMessage(error: string): string {
  switch (error) {
    case "limit_reached":
      return LIMIT_MESSAGE;
    case "invalid_input":
      return "入力内容を確認してください。";
    case "not_found":
      return "この Duty は見つかりませんでした。画面を読み込み直してください。";
    case "invalid_state":
      return "この Duty の状態が変わっています。画面を読み込み直してください。";
    case "network":
      return "通信できませんでした。電波の良いところでもう一度お試しください。";
    default:
      return "保存できませんでした。時間をおいてもう一度お試しください。";
  }
}
